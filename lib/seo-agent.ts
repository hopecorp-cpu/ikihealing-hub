import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { gscQuery } from "@/lib/seo-web";

export const KEY_CAI_DAT = "seo_agent_cai_dat";
export const KEY_THU_HANG = "seo_agent_thu_hang";
export const KEY_TU_KHOA = "seo_agent_tu_khoa";
export const KEY_DOI_THU = "seo_agent_doi_thu";
export const KEY_DE_XUAT = "seo_agent_de_xuat";
export const KEY_HANG_VIET = "seo_agent_hang_viet";
export const KEY_MAY_LAST = "seo_agent_last";
export const KEY_BAO_LAST = "seo_agent_bao_last";

export type CaiDat = { gioBaoCao: number[]; soDeXuat: number; doiThu: string[]; soBaiVietNgay: number; tuDong: boolean; nguongDiem: number };
export const KEY_NHAT_KY = "seo_agent_nhat_ky";
export const KEY_BAI_HOC = "seo_agent_bai_hoc";
export type NhatKy = { ngay: string; luc: string; slug: string; diem?: number; vong?: number; kq: "dang" | "cho" | "giu" | "chan" | "loi"; lyDo?: string; url?: string };
export type DongHang = { ten: string; viTri: number; clicks: number; impressions: number; truoc?: number };
export type ThuHang = {
  ngay: string; ky: { tu: string; den: string };
  tong: { clicks: number; impressions: number; clicksTruoc: number; impressionsTruoc: number; soTuKhoa: number };
  len: DongHang[]; xuong: DongHang[]; moi: DongHang[]; ganTrangMot: DongHang[]; itBam: DongHang[]; top: DongHang[]; trang?: DongHang[];
};
export type DeXuat = {
  id: number; loai: "viet" | "sua" | "keo"; tuKhoa: string; nhom?: string; tieuDe: string; lyDo: string;
  trang?: string; trangThai: "cho" | "duyet" | "bo";
};

export const TEN_BOT_SEO = "AI SEO example";
export const seoBotToken = () => (process.env.TELEGRAM_SEO_BOT_TOKEN || "").trim();
export async function guiBotSeo(text: string): Promise<{ ok: boolean; loi: string }> {
  const token = seoBotToken(), chat = (process.env.TELEGRAM_CHAT_ID || "").trim();
  if (!token || !chat) return { ok: false, loi: "thiếu TELEGRAM_SEO_BOT_TOKEN hoặc TELEGRAM_CHAT_ID" };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
      body: JSON.stringify({ chat_id: chat, text: text.slice(0, 4000), disable_web_page_preview: true }),
    });
    const j: any = await r.json().catch(() => ({}));
    return { ok: r.ok && j.ok === true, loi: String(j?.description || (r.ok ? "" : r.status)) };
  } catch (e: any) { return { ok: false, loi: String(e?.message || e) }; }
}

const MAC_DINH: CaiDat = { gioBaoCao: [7, 17], soDeXuat: 10, doiThu: [], soBaiVietNgay: 1, tuDong: false, nguongDiem: 95 };
const TRE_NGAY = 3;

async function docJson<T>(key: string, macDinh: T): Promise<T> {
  try { const v = await getConfigValue(key); return v ? (JSON.parse(v) as T) : macDinh; } catch { return macDinh; }
}

export async function docCaiDat(): Promise<CaiDat> {
  const c = await docJson<Partial<CaiDat>>(KEY_CAI_DAT, {});
  return {
    gioBaoCao: Array.isArray(c.gioBaoCao) && c.gioBaoCao.length ? c.gioBaoCao : MAC_DINH.gioBaoCao,
    soDeXuat: Math.min(20, Math.max(5, Number(c.soDeXuat) || MAC_DINH.soDeXuat)),
    doiThu: Array.isArray(c.doiThu) ? c.doiThu : [],

    soBaiVietNgay: Math.min(20, Math.max(1, Math.round(Number(c.soBaiVietNgay) || 1))),

    tuDong: c.tuDong === true,
    nguongDiem: Math.min(100, Math.max(80, Math.round(Number(c.nguongDiem) || 95))),
  };
}
const luuCaiDat = (c: CaiDat) => setConfigValue(KEY_CAI_DAT, JSON.stringify(c), "Cài đặt agent SEO: giờ báo cáo, số đề xuất/ngày, tên miền đối thủ");

export function gioVN(): number { return new Date(Date.now() + 7 * 3600_000).getUTCHours(); }
export function ngayVN(lui = 0): string {
  const d = new Date(Date.now() + 7 * 3600_000);
  d.setUTCDate(d.getUTCDate() - lui);
  return d.toISOString().slice(0, 10);
}

async function gscTheoTuKhoa(tu: string, den: string): Promise<Map<string, DongHang>> {
  const rows = await gscQuery({ startDate: tu, endDate: den, dimensions: ["query"], rowLimit: 1000 });
  const m = new Map<string, DongHang>();
  for (const r of rows) {
    const ten = String(r.keys?.[0] || "").slice(0, 100);
    if (ten) m.set(ten, { ten, viTri: Number((r.position || 0).toFixed(1)), clicks: Math.round(r.clicks || 0), impressions: Math.round(r.impressions || 0) });
  }
  return m;
}

export async function chupThuHang(): Promise<ThuHang> {
  const ky = { tu: ngayVN(TRE_NGAY + 6), den: ngayVN(TRE_NGAY) };
  const [nay, truoc] = await Promise.all([gscTheoTuKhoa(ky.tu, ky.den), gscTheoTuKhoa(ngayVN(TRE_NGAY + 13), ngayVN(TRE_NGAY + 7))]);
  if (!nay.size) throw new Error(`Search Console không trả từ khoá nào cho ${ky.tu}..${ky.den} — kiểm quyền Google, KHÔNG ghi đè ảnh chụp cũ.`);
  const tat = [...nay.values()];
  const tong = (m: Map<string, DongHang>, k: "clicks" | "impressions") => [...m.values()].reduce((s, d) => s + d[k], 0);

  const doi = tat.filter((d) => truoc.has(d.ten) && d.impressions >= 5 && truoc.get(d.ten)!.impressions >= 5)
    .map((d) => ({ ...d, truoc: truoc.get(d.ten)!.viTri }));
  const th: ThuHang = {
    ngay: ngayVN(), ky,
    tong: { clicks: tong(nay, "clicks"), impressions: tong(nay, "impressions"), clicksTruoc: tong(truoc, "clicks"), impressionsTruoc: tong(truoc, "impressions"), soTuKhoa: nay.size },
    len: doi.filter((d) => d.truoc! - d.viTri >= 1).sort((a, b) => (b.truoc! - b.viTri) - (a.truoc! - a.viTri)).slice(0, 10),
    xuong: doi.filter((d) => d.viTri - d.truoc! >= 1).sort((a, b) => (b.viTri - b.truoc!) - (a.viTri - a.truoc!)).slice(0, 10),
    moi: tat.filter((d) => !truoc.has(d.ten)).sort((a, b) => b.impressions - a.impressions).slice(0, 10),
    ganTrangMot: tat.filter((d) => d.viTri > 5 && d.viTri <= 20).sort((a, b) => b.impressions - a.impressions).slice(0, 15),
    itBam: tat.filter((d) => d.impressions >= 30 && d.clicks === 0 && d.viTri <= 15).sort((a, b) => b.impressions - a.impressions).slice(0, 10),
    top: tat.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions).slice(0, 40),
  };

  try {
    const rows = await gscQuery({ startDate: ky.tu, endDate: ky.den, dimensions: ["page"], rowLimit: 1000 });
    th.trang = rows.filter((r: any) => /\/blog\/[^/]+\.html/.test(String(r.keys?.[0] || "")))
      .map((r: any) => ({ ten: String(r.keys[0]).replace(/^https?:\/\/[^/]+/, "").slice(0, 140), viTri: Number((r.position || 0).toFixed(1)), clicks: Math.round(r.clicks || 0), impressions: Math.round(r.impressions || 0) }))
      .sort((a: DongHang, b: DongHang) => b.impressions - a.impressions).slice(0, 300);
  } catch {  }
  await setConfigValue(KEY_THU_HANG, JSON.stringify(th), "Agent SEO: thứ hạng từ khoá (Search Console, 7 ngày so 7 ngày trước)");
  return th;
}

const pt = (nay: number, truoc: number) => (truoc ? `${nay >= truoc ? "+" : ""}${Math.round(((nay - truoc) / truoc) * 100)}%` : "chưa có kỳ trước");
const tuoiGio = (at?: string) => (at ? Math.round((Date.now() - Date.parse(at)) / 3600_000) : null);
const NHAN_LOAI: Record<string, string> = { viet: "VIẾT MỚI", sua: "SỬA BÀI CŨ", keo: "KÉO TRAFFIC" };
const NHAN_NHOM: Record<string, string> = { sieuRong: "siêu rộng", dai: "dài", nganh: "ngành", sanPham: "sản phẩm", ngan: "ngắn", diaLy: "địa lý", trend: "xu hướng" };

export async function vietBaoCao(loiHang = ""): Promise<string> {
  const c = await docCaiDat();
  const [nk, hoc] = await Promise.all([docJson<NhatKy[]>(KEY_NHAT_KY, []), docJson<any>(KEY_BAI_HOC, null)]);
  const [th, tk, dt, dx, may, hang] = await Promise.all([
    docJson<ThuHang | null>(KEY_THU_HANG, null), docJson<any>(KEY_TU_KHOA, null), docJson<any>(KEY_DOI_THU, null),
    docJson<{ ngay: string; muc: DeXuat[] } | null>(KEY_DE_XUAT, null), docJson<any>(KEY_MAY_LAST, null), docJson<any[]>(KEY_HANG_VIET, []),
  ]);
  const d: string[] = [`AGENT SEO example.com — ${ngayVN().split("-").reverse().join("/")} ${gioVN()}h`];

  d.push("", `MÁY VIẾT — ${c.tuDong ? `đang chạy TỰ ĐỘNG, ${c.soBaiVietNgay} bài/ngày, chỉ đăng bài từ ${c.nguongDiem}/100` : "đang DỪNG tự động (bài nằm chờ duyệt). Bật lại: /chay"}`);
  for (const [nhan, ngay] of [["Hôm nay", ngayVN()], ["Hôm qua", ngayVN(1)]] as const) {
    const cuoi = new Map<string, NhatKy>();
    for (const x of nk.filter((x) => x.ngay === ngay)) cuoi.set(x.slug, x);
    const ds = [...cuoi.values()];
    if (!ds.length) { d.push(`${nhan}: chưa có bài nào được chấm.`); continue; }
    const dang = ds.filter((x) => x.kq === "dang"), cho = ds.filter((x) => x.kq === "cho"), giu = ds.filter((x) => x.kq === "giu" || x.kq === "chan" || x.kq === "loi");
    d.push(`${nhan}: đăng ${dang.length} bài, đang sửa tiếp ${cho.length}, giữ lại ${giu.length}.`);
    for (const x of dang.slice(0, 8)) d.push(`- ĐĂNG ${x.diem}/100 (${x.vong || 0} vòng sửa): example.com/blog/${x.slug}.html`);
    for (const x of [...cho, ...giu].slice(0, 5)) d.push(`- ${x.kq === "cho" ? "SỬA TIẾP" : "GIỮ LẠI"} ${x.diem ?? "?"}/100: ${x.slug} — ${String(x.lyDo || "").slice(0, 90)}`);
  }
  if (hoc?.baiHoc?.length) d.push(`Máy đã tự rút ${hoc.baiHoc.length} bài học từ ${hoc.soBai} bài đã đăng (xem ở trang /seo-agent).`);

  d.push("", "THỨ HẠNG TỪ KHOÁ");
  if (loiHang) d.push(`Chưa chụp được lượt này: ${loiHang}`);
  if (th) {
    d.push(`7 ngày tới ${th.ky.den}: ${th.tong.clicks} lượt bấm (${pt(th.tong.clicks, th.tong.clicksTruoc)}), ${th.tong.impressions} lượt hiển thị (${pt(th.tong.impressions, th.tong.impressionsTruoc)}), ${th.tong.soTuKhoa} từ khoá có hiển thị.`);
    const dong = (x: DongHang) => `- ${x.ten}: ${x.truoc != null ? `${x.truoc} -> ` : "vị trí "}${x.viTri} (${x.impressions} hiển thị, ${x.clicks} bấm)`;
    if (th.len.length) d.push("Lên hạng:", ...th.len.slice(0, 5).map(dong));
    if (th.xuong.length) d.push("Tụt hạng:", ...th.xuong.slice(0, 5).map(dong));
    if (th.ganTrangMot.length) d.push("Sát trang một (vị trí 5-20, đẩy một nhịp là lên):", ...th.ganTrangMot.slice(0, 5).map(dong));
    if (th.itBam.length) d.push("Hiện nhiều mà không ai bấm (sửa tiêu đề, mô tả):", ...th.itBam.slice(0, 3).map(dong));
  } else if (!loiHang) d.push("Chưa có ảnh chụp thứ hạng nào.");

  d.push("", "TỪ KHOÁ MỚI NGHIÊN CỨU");
  if (tk?.nhom) {
    d.push(`Kho hiện có ${tk.tong} từ khoá, ${tk.moi?.length || 0} từ mới so với lượt trước (${tuoiGio(tk.at)} giờ trước).`);
    d.push(Object.keys(NHAN_NHOM).map((k) => `${NHAN_NHOM[k]} ${tk.nhom[k]?.length || 0}`).join(" · "));
    if (tk.trend?.length) d.push("Xu hướng 24-72 giờ dính ngành:", ...tk.trend.slice(0, 5).map((t: any) => `- ${t.ten}${t.goc ? ` — ${t.goc}` : ""}`));
    if (tk.moi?.length) d.push(`Từ mới đáng chú ý: ${tk.moi.slice(0, 8).join("; ")}`);
  } else d.push("Máy nghiên cứu chưa chạy lượt nào.");

  d.push("", "ĐỐI THỦ");
  const coMoi = (dt?.mien || []).filter((m: any) => m.moi?.length);
  if (!dt?.mien?.length) d.push("Chưa soi được tên miền nào.");
  else if (!coMoi.length) d.push(`Đang canh ${dt.mien.length} tên miền, không có bài mới kể từ lượt trước.`);
  else for (const m of coMoi.slice(0, 5)) d.push(`${m.mien}: ${m.moi.length} trang mới dính ngành`, ...m.moi.slice(0, 3).map((b: any) => `- ${b.tieuDe || b.url}`));

  const cho = (dx?.muc || []).filter((m) => m.trangThai === "cho");
  d.push("", `ĐỀ XUẤT VIỆC HÔM NAY${dx?.ngay && dx.ngay !== ngayVN() ? ` (soạn ngày ${dx.ngay})` : ""}`);
  if (!dx?.muc?.length) d.push("Chưa có đề xuất.");
  else {
    for (const m of dx.muc.slice(0, 20)) {
      const dau = m.trangThai === "duyet" ? " [đã duyệt]" : m.trangThai === "bo" ? " [đã bỏ]" : "";
      d.push(`${m.id}. ${NHAN_LOAI[m.loai] || m.loai}${dau}: ${m.tieuDe} — từ khoá "${m.tuKhoa}"${m.nhom ? ` (${NHAN_NHOM[m.nhom] || m.nhom})` : ""}. ${m.lyDo.length > 110 ? m.lyDo.slice(0, 108) + "…" : m.lyDo}`);
    }
    if (cho.length) d.push(`Duyệt: gõ "/seo duyet 1,3" hoặc "/seo duyet het". Bỏ: "/seo bo 2". Lý do đầy đủ ở trang /seo-agent.`);
  }
  const choViet = hang.filter((h) => !h.dung).length;
  if (choViet) d.push(`Hàng chờ viết: ${choViet} bài đã duyệt (máy viết ${c.soBaiVietNgay} bài mỗi ngày qua cổng duyệt blog).`);

  const tuoiMay = tuoiGio(may?.at);
  if (tuoiMay == null || tuoiMay > 26 || may?.ok === false) {
    d.push("", `CẢNH BÁO: máy nghiên cứu trên Mac ${tuoiMay == null ? "chưa chạy lượt nào" : may?.ok === false ? `báo hỏng (${String(may.ghiChu || "").slice(0, 120)})` : `im ${tuoiMay} giờ`} — phần từ khoá, đối thủ, đề xuất ở trên có thể cũ.`);
  }
  return d.join("\n").slice(0, 3900);
}

export async function xuLyLenhSeo(text: string): Promise<string> {
  const tham = text.replace(/^\/seo(@\w+)?/i, "").trim();
  const [lenh, ...con] = tham.split(/\s+/);
  const so = (con.join(" ").match(/\d+/g) || []).map(Number);
  const c = await docCaiDat();

  if (!lenh) return vietBaoCao();
  if (/^gi[oờ]$/i.test(lenh)) {
    const gio = [...new Set(so.filter((n) => n >= 0 && n <= 23))].sort((a, b) => a - b);
    if (!gio.length) return `Giờ báo cáo hiện tại: ${c.gioBaoCao.join("h, ")}h. Đổi: /seo gio 7,12,18`;
    await luuCaiDat({ ...c, gioBaoCao: gio });
    return `Đã đặt giờ báo cáo: ${gio.join("h, ")}h mỗi ngày.`;
  }
  if (/^sodexuat$/i.test(lenh)) {
    if (!so[0] || so[0] < 5 || so[0] > 20) return `Số đề xuất mỗi ngày đang là ${c.soDeXuat}. Đổi trong khoảng 5-20: /seo sodexuat 15`;
    await luuCaiDat({ ...c, soDeXuat: so[0] });
    return `Đã đặt ${so[0]} đề xuất mỗi ngày (áp từ lượt soạn kế tiếp).`;
  }
  if (/^(d[uừ]ng|chay|ch[aạ]y)$/i.test(lenh)) {
    const bat = /^ch/i.test(lenh);
    await luuCaiDat({ ...c, tuDong: bat });
    return bat
      ? `Đã BẬT tự động: máy tự duyệt đề xuất, tự viết ${c.soBaiVietNgay} bài/ngày, tự chấm, tự sửa và chỉ đăng bài từ ${c.nguongDiem}/100. Dừng bất cứ lúc nào: /dung`
      : "Đã DỪNG tự động: máy không tự đăng nữa, bài viết ra nằm chờ duyệt như trước. Bật lại: /chay";
  }
  if (/^ngu[oơ]ng$/i.test(lenh)) {
    if (!so[0] || so[0] < 80 || so[0] > 100) return `Ngưỡng điểm để đăng đang là ${c.nguongDiem}/100. Đổi trong khoảng 80-100: /nguong 95`;
    await luuCaiDat({ ...c, nguongDiem: so[0] });
    return `Đã đặt ngưỡng đăng ${so[0]}/100, áp từ lượt chấm kế tiếp.`;
  }
  if (/^sobai$/i.test(lenh)) {
    if (!so[0] || so[0] < 1 || so[0] > 20) return `Máy đang viết ${c.soBaiVietNgay} bài mỗi ngày. Đổi trong khoảng 1-20: /seo sobai 5`;
    await luuCaiDat({ ...c, soBaiVietNgay: so[0] });
    return `Đã đặt mức viết ${so[0]} bài mỗi ngày, áp từ lượt chạy kế tiếp của máy viết blog. Bài vẫn qua cổng duyệt blog trước khi lên web.`;
  }
  if (/^doithu$/i.test(lenh)) {
    const mien = con.join(" ").split(/[\s,;]+/).map((m) => m.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")).filter((m) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(m));
    if (!mien.length) return `Đang canh thêm: ${c.doiThu.join(", ") || "chưa có tên miền nào do anh chỉ định"} (ngoài các tên miền máy tự phát hiện). Đặt lại: /seo doithu a.com b.vn`;
    await luuCaiDat({ ...c, doiThu: [...new Set(mien)].slice(0, 12) });
    return `Đã đặt danh sách đối thủ: ${mien.join(", ")}. Lượt soi kế tiếp sẽ dùng.`;
  }
  if (/^(duy[eệ]t|b[oỏ])$/i.test(lenh)) {
    const duyet = /^d/i.test(lenh);
    const dx = await docJson<{ ngay: string; muc: DeXuat[] } | null>(KEY_DE_XUAT, null);
    if (!dx?.muc?.length) return "Chưa có đề xuất nào để duyệt.";
    const het = /h[eế]t|t[aấ]t c[aả]/i.test(con.join(" "));
    const chon = dx.muc.filter((m) => m.trangThai === "cho" && (het || so.includes(m.id)));
    if (!chon.length) return `Không thấy mục đang chờ khớp. Các mục còn chờ: ${dx.muc.filter((m) => m.trangThai === "cho").map((m) => m.id).join(", ") || "không còn"}.`;
    for (const m of chon) m.trangThai = duyet ? "duyet" : "bo";
    await setConfigValue(KEY_DE_XUAT, JSON.stringify(dx), "Agent SEO: đề xuất việc trong ngày");
    if (!duyet) return `Đã bỏ ${chon.length} mục: ${chon.map((m) => m.id).join(", ")}.`;

    const viet = chon.filter((m) => m.loai === "viet");
    if (viet.length) {
      const hang = await docJson<any[]>(KEY_HANG_VIET, []);
      for (const m of viet) if (!hang.some((h) => h.tuKhoa === m.tuKhoa)) hang.push({ tuKhoa: m.tuKhoa, tieuDe: m.tieuDe, nhom: m.nhom, lyDo: m.lyDo, duyetLuc: new Date().toISOString() });
      await setConfigValue(KEY_HANG_VIET, JSON.stringify(hang.slice(-60)), "Agent SEO: bài đã duyệt, chờ giải mã bài top rồi viết");
    }
    return `Đã duyệt ${chon.length} mục: ${chon.map((m) => m.id).join(", ")}.${viet.length ? ` ${viet.length} bài vào hàng chờ viết — máy giải mã bài đang đứng top rồi viết ${c.soBaiVietNgay} bài mỗi ngày, bài vẫn qua cổng duyệt blog trước khi lên web.` : ""}`;
  }
  return [
    "Lệnh agent SEO:",
    "/seo — báo cáo ngay",
    "/seo gio 7,12,18 — đặt giờ báo cáo hằng ngày",
    "/seo duyet 1,3 (hoặc: het) — duyệt đề xuất",
    "/seo bo 2 — bỏ đề xuất",
    "/seo sodexuat 15 — số đề xuất mỗi ngày (5-20)",
    "/seo sobai 5 — số bài máy viết mỗi ngày (1-20)",
    "/seo dung — dừng tự động (bài nằm chờ duyệt)",
    "/seo chay — bật tự động (tự viết, tự chấm, tự đăng)",
    "/seo nguong 95 — ngưỡng điểm để đăng (80-100)",
    "/seo doithu a.com b.vn — tên miền đối thủ cần canh",
  ].join("\n");
}

export async function chayMotLuot(opts: { epGui?: boolean; dry?: boolean; gui: (text: string) => Promise<boolean> }) {
  const c = await docCaiDat();
  const gio = gioVN(), ngay = ngayVN();
  const last = await docJson<{ daGui?: string[] }>(KEY_BAO_LAST, {});
  const khoa = `${ngay}-${gio}`;
  const canGui = opts.epGui || (c.gioBaoCao.includes(gio) && !(last.daGui || []).includes(khoa));

  let loiHang = "";
  const th = await docJson<ThuHang | null>(KEY_THU_HANG, null);
  if (th?.ngay !== ngay) { try { await chupThuHang(); } catch (e: any) { loiHang = String(e?.message || e).slice(0, 200); } }

  let text = "", daGui = false;
  if (canGui) {
    text = await vietBaoCao(loiHang);
    if (!opts.dry) { daGui = await opts.gui(text); if (!daGui) throw new Error("gửi Telegram không thành công"); }
  }
  if (!opts.dry) {
    await setConfigValue(KEY_BAO_LAST, JSON.stringify({
      at: new Date().toISOString(), ok: !loiHang, loi: loiHang || undefined,
      daGui: daGui ? [...(last.daGui || []), khoa].slice(-12) : (last.daGui || []),
    }), "Nhịp tim agent SEO nửa máy chủ (cron mỗi giờ: thứ hạng + báo cáo Telegram)");
  }
  if (loiHang) throw new Error(loiHang);
  return { gio, canGui, daGui, text };
}
