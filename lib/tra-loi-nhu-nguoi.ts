import { getServiceClient } from "@/lib/supabase-server";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { handleInboundMessage } from "@/lib/zalo-agent";
import { findBanned } from "@/lib/banned-words";
import { lyDoDung } from "@/lib/dung-khan-cap";
import { pageToken } from "@/lib/fb-autoreply";
import { VO_NGHIA, CHI_KY_TU_LA } from "@/lib/ca-truc-ai";
import { agentLearningBrief } from "@/lib/agent-learning";

const HANG_DOI = "fb_hang_doi_tra_loi";
const NHAT_KY = "fb_may_da_tra_loi";
const CAI_DAT = "fb_may_truc";
const G = "https://graph.facebook.com/v21.0";

export type CaiDatMayTruc = {
  bat: boolean;
  choPhut: number;
  tranLuot: number;
};

export const CAI_DAT_MAC_DINH: CaiDatMayTruc = { bat: false, choPhut: 6, tranLuot: 3 };

const CHUYEN_NGUOI_RE = new RegExp(
  [
    "gi[áa]|bao nhi[êe]u ti[eề]n|nhi[êe]u ti[eề]n|m[áa]y ti[eề]n|c[oó] r[eẻ]|gi[aả]m gi[áa]|khuy[eế]n m[aã]i|voucher|m[ãa] gi[aả]m",
    "đ[ơo]n h[àa]ng|đ[ãa] g[uử]i ch[ưu]a|khi n[àa]o nh[ậâ]n|v[ậâ]n chuy[eể]n|ship|giao h[àa]ng|ho[àa]n ti[eề]n|đ[oổ]i tr[aả]",
    "khi[eế]u n[ạa]i|l[uừ]a|k[ée]m ch[aấ]t l[ưu][ợo]ng|h[oỏ]ng|d[oở]m|gi[aả] m[ạa]o",
    "c[óo] ph[aả]i ng[ưu][ờo]i|l[àa] ng[ưu][ờo]i hay m[áa]y|bot|ai tr[aả] l[ờo]i|ng[ưu][ờo]i th[ậâ]t",
    "đ[ạa]i l[ýy]|chi[eế]t kh[aấ]u|nh[ậâ]p s[iỉ]|c[ộo]ng t[áa]c vi[êe]n",
  ].join("|"),
  "i",
);

const DANG_DOAN_RE = /(có l[ẽe]|ch[ắa]c l[àa]|mình kh[ôo]ng ch[ắa]c|kh[ôo]ng r[õo]|t[uù]y|có th[eể] l[àa]|mình ngh[ĩi] l[àa])/i;

async function doc<T>(key: string, mac: T): Promise<T> {
  try { const v = await getConfigValue(key); return v ? JSON.parse(v) : mac; } catch { return mac; }
}

export async function caiDatMayTruc(): Promise<CaiDatMayTruc> {
  const c = await doc<Partial<CaiDatMayTruc>>(CAI_DAT, {});
  return { ...CAI_DAT_MAC_DINH, ...c };
}

function nhuNguoi(t: string): string {
  return t
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/[*_`#>]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}])\s*\1+/gu, "$1")
    .trim();
}

export type QuyetDinh =
  | { gui: true; text: string; nong: boolean }
  | { gui: false; chuyen: true; lyDo: string; cauHoi: string }
  | { gui: false; chuyen: false; lyDo: string };

export async function quyetDinhTraLoi(text: string, lichSu: Array<{ role: "user" | "assistant"; content: string }> = []): Promise<QuyetDinh> {
  const cau = (text || "").trim();
  if (!cau) return { gui: false, chuyen: false, lyDo: "tin rỗng" };

  if (VO_NGHIA.test(cau) || CHI_KY_TU_LA.test(cau)) {
    return { gui: false, chuyen: false, lyDo: "khách chưa hỏi gì (nhãn dán/ảnh/xã giao)" };
  }

  if (CHUYEN_NGUOI_RE.test(cau)) {
    return { gui: false, chuyen: true, cauHoi: cau, lyDo: "hỏi về giá, đơn hàng, vận chuyển, đại lý hoặc hỏi thẳng có phải người thật" };
  }

  const hoc = await agentLearningBrief("may-truc").catch(() => "");
  let r: any;

  try { r = await handleInboundMessage(cau, lichSu, hoc, "facebook", { kenh: "facebook" }); }
  catch (e: any) { return { gui: false, chuyen: true, cauHoi: cau, lyDo: `bộ não lỗi: ${String(e?.message || e).slice(0, 60)}` }; }

  const traLoi = nhuNguoi(String(r?.reply || ""));
  if (!traLoi || traLoi.length < 12) return { gui: false, chuyen: true, cauHoi: cau, lyDo: "không soạn được câu tử tế" };
  if (findBanned(traLoi).length) return { gui: false, chuyen: true, cauHoi: cau, lyDo: "câu soạn ra dính từ cấm" };
  if (DANG_DOAN_RE.test(traLoi)) return { gui: false, chuyen: true, cauHoi: cau, lyDo: "câu trả lời nghe như đang đoán" };

  if (r?.medical) return { gui: true, text: traLoi, nong: true };

  return { gui: true, text: traLoi, nong: !!r?.hot };
}

export async function nguoiDaTraLoi(pageId: string, psid: string): Promise<boolean> {
  try {
    const tok = await pageToken(pageId);
    if (!tok) return true;
    const u = `${G}/${pageId}/conversations?user_id=${encodeURIComponent(psid)}`
      + `&fields=messages.limit(1){from,created_time}&access_token=${encodeURIComponent(tok)}`;
    const j: any = await fetch(u, { cache: "no-store" }).then((r) => r.json());
    const m = j?.data?.[0]?.messages?.data?.[0];
    if (!m) return true;
    return String(m?.from?.id || "") === String(pageId);
  } catch { return true; }
}

export type MucHangDoi = { pageId: string; psid: string; ten: string; cau: string; vaoLuc: number; duHanLuc: number };

export async function xepHangDoi(pageId: string, psid: string, cau: string, ten = ""): Promise<void> {
  const c = await caiDatMayTruc();
  const ds = await doc<MucHangDoi[]>(HANG_DOI, []);
  const con = ds.filter((m) => !(m.pageId === pageId && m.psid === psid));
  con.push({ pageId, psid, ten, cau: String(cau).slice(0, 500), vaoLuc: Date.now(), duHanLuc: Date.now() + c.choPhut * 60e3 });
  await setConfigValue(HANG_DOI, JSON.stringify(con.slice(-400)), "Khách đang chờ máy trực trả lời");
}

async function soLuotMayDaNoi(psid: string): Promise<number> {
  const nk = await doc<Record<string, { n: number; at: number }>>(NHAT_KY, {});
  return Number(nk[psid]?.n || 0);
}
async function ghiNhatKy(psid: string): Promise<void> {
  const nk = await doc<Record<string, { n: number; at: number }>>(NHAT_KY, {});
  const cut = Date.now() - 14 * 864e5;
  for (const k of Object.keys(nk)) if ((nk[k]?.at || 0) < cut) delete nk[k];
  nk[psid] = { n: Number(nk[psid]?.n || 0) + 1, at: Date.now() };
  await setConfigValue(NHAT_KY, JSON.stringify(nk), "Máy trực đã nói mấy lượt với ai");
}

async function guiTin(pageId: string, psid: string, text: string): Promise<{ ok: boolean; error?: string; ngoaiCuaSo?: boolean }> {
  const dung = await lyDoDung("nhan_khach");
  if (dung) return { ok: false, error: dung };
  const tok = await pageToken(pageId);
  if (!tok) return { ok: false, error: "không lấy được khoá trang" };
  const r = await fetch(`${G}/${pageId}/messages?access_token=${encodeURIComponent(tok)}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: psid }, messaging_type: "RESPONSE", message: { text } }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (j?.error) {

    const code = Number(j.error.code || 0), sub = Number(j.error.error_subcode || 0);
    const ngoai = code === 10 || sub === 2018278 || /24-hour|outside.*window/i.test(String(j.error.message || ""));
    return { ok: false, error: String(j.error.message || "").slice(0, 160), ngoaiCuaSo: ngoai };
  }
  return { ok: true };
}

export type KetQuaTruc = {
  at: string; xet: number; gui: number; nhuongNguoi: number; chuyenSale: number; ngoaiCuaSo: number; loi: number;
  chiTiet: Array<{ ten: string; ket: string; lyDo?: string }>;
};

export async function nhipTruc(): Promise<KetQuaTruc> {
  const kq: KetQuaTruc = { at: new Date().toISOString(), xet: 0, gui: 0, nhuongNguoi: 0, chuyenSale: 0, ngoaiCuaSo: 0, loi: 0, chiTiet: [] };
  const c = await caiDatMayTruc();
  const ds = await doc<MucHangDoi[]>(HANG_DOI, []);
  if (!ds.length) return kq;

  const gio = Date.now();
  const denHan = ds.filter((m) => m.duHanLuc <= gio);
  const conCho = ds.filter((m) => m.duHanLuc > gio);
  if (!c.bat) {

    return { ...kq, xet: denHan.length, chiTiet: [{ ten: "(máy trực đang TẮT)", ket: "không gửi" }] };
  }

  const conLai: MucHangDoi[] = [...conCho];
  const sb = getServiceClient();

  for (const m of denHan.slice(0, 25)) {
    kq.xet++;
    try {
      if (await nguoiDaTraLoi(m.pageId, m.psid)) {
        kq.nhuongNguoi++; kq.chiTiet.push({ ten: m.ten || m.psid.slice(-6), ket: "nhường người" });
        continue;
      }
      if (await soLuotMayDaNoi(m.psid) >= c.tranLuot) {
        kq.chuyenSale++; kq.chiTiet.push({ ten: m.ten || m.psid.slice(-6), ket: "chuyển sale", lyDo: `máy đã nói ${c.tranLuot} lượt` });
        await taoViecChoSale(sb, m, `máy đã nói đủ ${c.tranLuot} lượt, cần người tiếp`);
        continue;
      }

      const qd = await quyetDinhTraLoi(m.cau);
      if (!qd.gui) {
        if ((qd as any).chuyen) {
          kq.chuyenSale++; kq.chiTiet.push({ ten: m.ten || m.psid.slice(-6), ket: "chuyển sale", lyDo: (qd as any).lyDo });
          await taoViecChoSale(sb, m, (qd as any).lyDo);
        } else {
          kq.chiTiet.push({ ten: m.ten || m.psid.slice(-6), ket: "bỏ qua", lyDo: (qd as any).lyDo });
        }
        continue;
      }

      const g = await guiTin(m.pageId, m.psid, qd.text);
      if (g.ok) {
        kq.gui++; await ghiNhatKy(m.psid);
        kq.chiTiet.push({ ten: m.ten || m.psid.slice(-6), ket: "đã trả lời" });
        if (qd.nong) await taoViecChoSale(sb, m, "khách có dấu hiệu muốn mua — vào chốt");
      } else if (g.ngoaiCuaSo) {
        kq.ngoaiCuaSo++; kq.chiTiet.push({ ten: m.ten || m.psid.slice(-6), ket: "ngoài cửa sổ 24h", lyDo: "Facebook chặn, phải dán tay" });
        await taoViecChoSale(sb, m, "quá 24h nên máy không nhắn được, cần người dán tay");
      } else {
        kq.loi++; kq.chiTiet.push({ ten: m.ten || m.psid.slice(-6), ket: "lỗi gửi", lyDo: g.error });
      }
    } catch (e: any) {
      kq.loi++; kq.chiTiet.push({ ten: m.ten || m.psid.slice(-6), ket: "lỗi", lyDo: String(e?.message || e).slice(0, 80) });
    }
  }

  await setConfigValue(HANG_DOI, JSON.stringify(conLai.slice(-400)), "Khách đang chờ máy trực trả lời");
  await setConfigValue("fb_may_truc_status", JSON.stringify({ ...kq, chiTiet: kq.chiTiet.slice(0, 20) }), "Nhịp trực gần nhất của máy");
  return kq;
}

async function taoViecChoSale(sb: any, m: MucHangDoi, lyDo: string): Promise<void> {
  try {
    await sb.from("leads").insert({
      customer_name: m.ten || "Khách Facebook",
      channel: "facebook",
      source: "máy trực chuyển",
      note: `[máy chuyển: ${lyDo}] ${m.cau.slice(0, 300)}`,
      status: "new",
      external_id: `fbmt:${m.psid}`,
      pancake_link: `https://pancake.vn/${m.pageId}?c_id=${m.pageId}_${m.psid}`,
    });
  } catch {  }
}
