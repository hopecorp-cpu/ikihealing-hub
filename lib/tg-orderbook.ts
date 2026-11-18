import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { cheDuLieu } from "@/lib/tg-che";
import { APP_URL } from "@/lib/app-url";

export const KHOA_NHOM_DON = "tg_nhom_don";

export const KHOA_NHOM_LUU_CHU = "tg_nhom_luu_chu";

const NHOM_MAC_DINH = ["-1000000000002"];

const NHOM_LUU_CHU_MAC_DINH = [
  "-1000000000007",
  "-1000000000009",
  "-1000000000008",
  "-1000000000007",
  "-1000000000009",
  "-1000000000003",
  "-1000000000003",
  "-1000000000006",
  "-1000000000006",
  "-1000000000004",
  "-1000000000005",
];

const CHAT_DAI_LY = "-1000000000008";

function docMangId(raw: string | null): string[] | null {
  try {
    const ds = JSON.parse(raw || "null");
    if (Array.isArray(ds)) return ds.map((x) => String(x).trim()).filter((s) => /^-?\d+$/.test(s));
  } catch {  }
  return null;
}

export async function nhomDon(): Promise<string[]> {
  try {
    const ds = docMangId(await getConfigValue(KHOA_NHOM_DON));
    if (ds && ds.length) return ds;
  } catch {  }
  return NHOM_MAC_DINH;
}

export async function nhomLuuChu(): Promise<string[]> {
  try {
    const raw = await getConfigValue(KHOA_NHOM_LUU_CHU);
    if (raw == null || raw.trim() === "") return [...NHOM_LUU_CHU_MAC_DINH];
    const ds = docMangId(raw);
    if (ds) return ds;
  } catch {  }
  return [...NHOM_LUU_CHU_MAC_DINH];
}

export async function nhomCam(): Promise<string[]> {
  const cam = new Set<string>([CHAT_DAI_LY]);
  try {
    const raw = (await getConfigValue("brain_nhom_cam")) || "";
    const tuJson = docMangId(raw.trim().startsWith("[") ? raw : null);
    const ds = tuJson ?? raw.split(",").map((s) => s.trim()).filter((s) => /^-?\d+$/.test(s));
    for (const id of ds) cam.add(id);
  } catch {  }
  return [...cam];
}

export function chuoiLocChat(ids: readonly string[]): string {
  const sach = ids.map((s) => String(s).trim()).filter((s) => /^-?\d+$/.test(s));
  if (!sach.length) return "chat_id=eq.0";
  return `chat_id=in.(${sach.join(",")})`;
}

export async function luuTinDon(sb: any, msg: any, text: string): Promise<boolean> {
  try {
    const chatId = msg?.chat?.id != null ? String(msg.chat.id) : "";
    if (!chatId || !String(text || "").trim()) return false;

    if ((await nhomCam()).includes(chatId)) return false;

    const laDon = (await nhomDon()).includes(chatId);

    const laLuu = !laDon && (await nhomLuuChu()).includes(chatId);
    if (!laDon && !laLuu) return false;

    if (laLuu && msg?.from?.is_bot) return false;

    const ten = `${msg?.from?.first_name || ""} ${msg?.from?.last_name || ""}`.trim() || msg?.from?.username || "";
    const row: Record<string, unknown> = {
      chat_id: chatId,
      chat_name: msg?.chat?.title || "",
      message_id: Number(msg?.message_id || 0),
      from_name: ten,
      from_id: msg?.from?.id != null ? String(msg.from.id) : null,
      noi_dung: laLuu ? cheDuLieu(text) : text,
      sent_at: new Date((Number(msg?.date) || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    };

    if (laLuu) row.da_boc = true;
    const { error } = await sb.from("tg_messages").upsert(row, { onConflict: "chat_id,message_id" });
    if (error) return false;

    if (laDon) {
      await setConfigValue("nguon_so_don_tele", new Date().toISOString(), "Lần cuối sổ đơn Telegram nhận được tin (watchdog đọc khoá này)");
      await kichBocDon();
    }
    return true;
  } catch { return false; }
}

async function kichBocDon(): Promise<void> {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return;
  try {
    await fetch(`${APP_URL}/api/cron/tg-boc-don`, {
      headers: { authorization: `Bearer ${secret}` }, cache: "no-store", signal: AbortSignal.timeout(1500),
    });
  } catch {  }
}

export const KHOA_MAY_SALE = "tg_may_sale";
type LuatMay = { khop: string; sale: string; tu?: string; den?: string };

const MAY_MAC_DINH: LuatMay[] = [
  { khop: "8848", sale: "Cúc", tu: "2026-08-01" },
  { khop: "885", sale: "Đào", tu: "2026-07-01", den: "2026-08-03" },
  { khop: "885", sale: "Cúc", tu: "2026-08-04", den: "2026-08-20" },
  { khop: "885", sale: "Sơn", tu: "2026-08-21" },
];

export async function ganSaleTheoMay(nguoiGui: string, ngay: string): Promise<string | null> {
  let luat = MAY_MAC_DINH;
  try {
    const ds = JSON.parse((await getConfigValue(KHOA_MAY_SALE)) || "null");
    if (Array.isArray(ds) && ds.length) luat = ds;
  } catch {  }
  const ten = String(nguoiGui || "");
  for (const r of luat) {
    if (!r.khop || !ten.includes(r.khop)) continue;
    if (r.tu && ngay < r.tu) continue;
    if (r.den && ngay > r.den) continue;
    return r.sale;
  }
  return null;
}

export type DoanhThuNgay = { ngay: string; don: number; khachTra: number };
export type DoanhThuSale = { sale: string; don: number; khachTra: number; giamGia: number };

export async function doanhThuKhoang(sb: any, tu: string, den: string): Promise<{
  don: number; khachTra: number; giamGia: number;
  theoNgay: DoanhThuNgay[]; theoSale: DoanhThuSale[];
}> {
  const rows: any[] = [];
  for (let f = 0; f < 20000; f += 1000) {
    const { data, error } = await sb.from("tg_orders")
      .select("ngay, sale, khach_tra, giam_gia").gte("ngay", tu).lte("ngay", den)
      .order("ngay").range(f, f + 999);
    if (error || !data?.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  const gNgay: Record<string, DoanhThuNgay> = {};
  const gSale: Record<string, DoanhThuSale> = {};
  for (const r of rows) {
    const n = String(r.ngay);
    (gNgay[n] ??= { ngay: n, don: 0, khachTra: 0 });
    gNgay[n].don++; gNgay[n].khachTra += r.khach_tra || 0;
    const s = r.sale || "chưa rõ";
    (gSale[s] ??= { sale: s, don: 0, khachTra: 0, giamGia: 0 });
    gSale[s].don++; gSale[s].khachTra += r.khach_tra || 0; gSale[s].giamGia += r.giam_gia || 0;
  }
  return {
    don: rows.length,
    khachTra: rows.reduce((s, r) => s + (r.khach_tra || 0), 0),
    giamGia: rows.reduce((s, r) => s + (r.giam_gia || 0), 0),
    theoNgay: Object.values(gNgay).sort((a, b) => a.ngay.localeCompare(b.ngay)),
    theoSale: Object.values(gSale).sort((a, b) => b.khachTra - a.khachTra),
  };
}
