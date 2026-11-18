import { ga4Report, ga4Property, type Ky } from "@/lib/ga4";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { getServiceClient } from "@/lib/supabase-server";

export const KHOA_LICH_SU = "web_ngay_lich_su";
const GIU_NGAY = 120;

export type Ga4Ngay = {
  nguoiDung: number; nguoiMoi: number; phien: number; phienTuongTac: number; luotXem: number;
  phienBlog: number;
  kenh: { ten: string; phien: number }[];
  topTrang: { ten: string; phien: number }[];
};
export type ChuyenDoiNgay = {
  email: number;
  emailTheoNguon: Record<string, number>;
  emailKhongSdt: number;
  sdt: number;
  sdtTheoNguon: Record<string, number>;
  quizHoSo: number;
  donWeb: number; tienDonWeb: number;
  donHuy: number;
  ebookTaiLuyKe: number;
};
export type AnhNgay = { ngay: string; ga4: Ga4Ngay | null; cd: ChuyenDoiNgay; chupLuc: string };
export type LichSu = Record<string, AnhNgay>;

export function ngayVN(ms: number): string {
  return new Date(ms + 7 * 3600 * 1000).toISOString().slice(0, 10);
}
export function homNayVN(): string { return ngayVN(Date.now()); }
export function ngayCong(ngay: string, soNgay: number): string {
  const d = new Date(ngay + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + soNgay);
  return d.toISOString().slice(0, 10);
}

export function khoangUtc(ngay: string): { tu: string; den: string } {
  const tu = new Date(ngay + "T00:00:00+07:00").toISOString();
  const den = new Date(ngayCong(ngay, 1) + "T00:00:00+07:00").toISOString();
  return { tu, den };
}

const MA_KENH_WEB = new Set(["salepage", "website", "web", "shop", "sale_page", "nova_shop"]);
export function laDonWeb(o: { channel?: string | null; channel_code?: string | null; source_platform?: string | null }): boolean {

  const tu = `${o.channel_code || ""} ${o.source_platform || ""}`.toLowerCase().split(/[^a-z0-9_]+/);
  return tu.some((t) => MA_KENH_WEB.has(t));
}

export type DonWebVao = { ma?: string | null; sdt?: string | null; tien: number; huy?: boolean; nguon: string };

export function gopDonWeb(vao: DonWebVao[]): { don: number; tien: number; huy: number; nguonDung: string[] } {
  const daCo = new Set<string>();
  let don = 0, tien = 0, huy = 0; const nguonDung: string[] = [];
  for (const v of vao) {
    const sdt = String(v.sdt || "").replace(/\D/g, "");
    const khoa: string[] = [];
    if (v.ma) khoa.push(`ma:${v.ma}`);
    if (sdt) khoa.push(`st:${sdt}|${Math.round(v.tien)}`);
    if (khoa.length && khoa.some((k) => daCo.has(k))) continue;
    for (const k of khoa) daCo.add(k);
    if (v.huy) { huy++; continue; }
    don++; tien += Number(v.tien) || 0;
    if (!nguonDung.includes(v.nguon)) nguonDung.push(v.nguon);
  }
  return { don, tien, huy, nguonDung };
}

const NGUON_WEB = ["quiz", "quiz-zalo", "ebook", "salepage", "tailieu", "shop", "blog", "exit"];

export function laLeadWeb(l: { source?: string | null; channel?: string | null }): boolean {
  const s = String(l.source || "").toLowerCase();
  const goc = s.split(/[:\-]/)[0];
  if (NGUON_WEB.includes(goc) || s.startsWith("shop")) return true;
  const ch = String(l.channel || "").toLowerCase();
  return ["quiz", "ebook", "salepage", "website", "web", "tailieu"].includes(ch);
}

export function nhomNguon(source: string): string {
  const s = String(source || "").toLowerCase();
  if (s.startsWith("shop")) return "shop";
  const goc = s.split(/[:\-]/)[0];
  if (goc === "exit") return "blog";
  return goc || "khac";
}

export function tongLienHe(cd: ChuyenDoiNgay): number { return cd.sdt + cd.emailKhongSdt; }

function fmt(n: number): string { return Math.round(n).toLocaleString("vi-VN"); }
function tien(n: number): string { return n >= 1e6 ? (n / 1e6).toFixed(1).replace(".", ",") + "tr" : fmt(n) + "đ"; }

export function soSanh(nay: number, nen: number, nhan: string): string {
  if (!nen) return nay ? `(${nhan} chưa có số)` : "";
  const d = ((nay - nen) / nen) * 100;
  if (Math.abs(d) < 1) return `(bằng ${nhan})`;
  return `(${d >= 0 ? "+" : ""}${d.toFixed(0)}% so ${nhan})`;
}

export function congChuyenDoi(ls: LichSu, tu: string, den: string): ChuyenDoiNgay & { soNgayCo: number } {
  const r: ChuyenDoiNgay & { soNgayCo: number } = {
    email: 0, emailTheoNguon: {}, emailKhongSdt: 0, sdt: 0, sdtTheoNguon: {}, quizHoSo: 0,
    donWeb: 0, tienDonWeb: 0, donHuy: 0, ebookTaiLuyKe: 0, soNgayCo: 0,
  };
  for (let d = tu; d <= den; d = ngayCong(d, 1)) {
    const a = ls[d]; if (!a) continue;
    r.soNgayCo++;
    r.email += a.cd.email; r.emailKhongSdt += a.cd.emailKhongSdt; r.sdt += a.cd.sdt;
    r.quizHoSo += a.cd.quizHoSo; r.donWeb += a.cd.donWeb; r.tienDonWeb += a.cd.tienDonWeb; r.donHuy += a.cd.donHuy;
    for (const [k, v] of Object.entries(a.cd.emailTheoNguon || {})) r.emailTheoNguon[k] = (r.emailTheoNguon[k] || 0) + v;
    for (const [k, v] of Object.entries(a.cd.sdtTheoNguon || {})) r.sdtTheoNguon[k] = (r.sdtTheoNguon[k] || 0) + v;
    r.ebookTaiLuyKe = Math.max(r.ebookTaiLuyKe, a.cd.ebookTaiLuyKe);
  }
  return r;
}

export function tbNguoiDung(ls: LichSu, tu: string, den: string): number {
  let tong = 0, n = 0;
  for (let d = tu; d <= den; d = ngayCong(d, 1)) { const a = ls[d]; if (a?.ga4) { tong += a.ga4.nguoiDung; n++; } }
  return n ? tong / n : 0;
}

export function taiEbookTrongNgay(ls: LichSu, ngay: string): number | null {
  const nay = ls[ngay]?.cd.ebookTaiLuyKe; if (!nay) return null;
  for (let i = 1; i <= 7; i++) { const t = ls[ngayCong(ngay, -i)]?.cd.ebookTaiLuyKe; if (t) return Math.max(0, nay - t); }
  return null;
}

function inNguon(m: Record<string, number>): string {
  const e = Object.entries(m).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  return e.length ? e.map(([k, v]) => `${k} ${v}`).join(" · ") : "";
}

export type SoTuan = { ky: Ky; ga4: { nguoiDung: number; phien: number; phienBlog: number } | null };

export type TepNu = { nu: number; nam: number; khongRo: number } | null;
async function ga4TepNu(ky: Ky): Promise<TepNu> {
  const r = await ga4Report(ky, ["activeUsers"], "userGender", 10);
  let nu = 0, nam = 0, khongRo = 0;
  for (const row of r?.rows || []) {
    const g = String(row.dimensionValues?.[0]?.value || "").toLowerCase();
    const v = Number(row.metricValues?.[0]?.value || 0);
    if (g === "female") nu += v; else if (g === "male") nam += v; else khongRo += v;
  }
  return nu + nam > 0 ? { nu, nam, khongRo } : null;
}

export function vietBaoCaoNgay(a: AnhNgay, ls: LichSu, tuan: { nay: SoTuan; truoc: SoTuan; tepNu?: { nay: TepNu; truoc: TepNu } } | null): string {
  const d: string[] = [];
  const nen = { tu: ngayCong(a.ngay, -7), den: ngayCong(a.ngay, -1) };
  const tbNd = tbNguoiDung(ls, nen.tu, nen.den);
  const cdNen = congChuyenDoi(ls, nen.tu, nen.den);
  const tbLienHe = cdNen.soNgayCo ? (cdNen.sdt + cdNen.emailKhongSdt) / cdNen.soNgayCo : 0;
  const lienHe = tongLienHe(a.cd);
  const [y, m, dd] = a.ngay.split("-");

  d.push(`WEB example.com — ngày ${dd}/${m}/${y}`);
  d.push("");
  d.push("NGƯỜI VÀO WEB (Analytics, số tạm — Google chốt trong 24-48h)");
  if (a.ga4) {
    d.push(`• Người dùng: ${fmt(a.ga4.nguoiDung)} ${soSanh(a.ga4.nguoiDung, tbNd, "TB 7 ngày")} · mới ${fmt(a.ga4.nguoiMoi)}`);
    d.push(`• Phiên: ${fmt(a.ga4.phien)} · có tương tác ${fmt(a.ga4.phienTuongTac)} · lượt xem trang ${fmt(a.ga4.luotXem)}`);
    d.push(`• Vào BLOG: ${fmt(a.ga4.phienBlog)} phiên (${a.ga4.phien ? Math.round((a.ga4.phienBlog / a.ga4.phien) * 100) : 0}% tổng phiên)`);
    if (a.ga4.kenh.length) d.push(`• Đến từ: ${a.ga4.kenh.slice(0, 5).map((k) => `${dichKenh(k.ten)} ${k.phien}`).join(" · ")}`);
    if (a.ga4.topTrang.length) d.push(`• Trang đón khách nhiều nhất: ${a.ga4.topTrang.slice(0, 4).map((t) => `${t.ten} (${t.phien})`).join(" · ")}`);
  } else {
    d.push("• Chưa đọc được GA4 hôm nay (xem lỗi ở may-chay-ngam).");
  }

  d.push("");
  d.push("CHUYỂN ĐỔI TỪ WEB (số chốt, đọc từ hệ thống mình)");
  d.push(`• Người để lại liên hệ: ${lienHe} ${soSanh(lienHe, tbLienHe, "TB 7 ngày")}` +
    (a.ga4?.nguoiDung ? ` — tỉ lệ ${((lienHe / a.ga4.nguoiDung) * 100).toFixed(1)}% người dùng` : ""));
  d.push(`  · SĐT vào máy chia sale: ${a.cd.sdt}${a.cd.sdt ? ` (${inNguon(a.cd.sdtTheoNguon)})` : ""}`);
  d.push(`  · Email: ${a.cd.email}${a.cd.email ? ` (${inNguon(a.cd.emailTheoNguon)})` : ""}${a.cd.email && a.cd.emailKhongSdt < a.cd.email ? ` — ${a.cd.email - a.cd.emailKhongSdt} người để cả SĐT, đã tính ở dòng SĐT` : ""}`);
  d.push(`• Hồ sơ quiz thể trạng: ${a.cd.quizHoSo}`);
  const tai = taiEbookTrongNgay(ls, a.ngay);
  if (tai != null) d.push(`• Lượt tải ebook: ${tai} (luỹ kế ${fmt(a.cd.ebookTaiLuyKe)})`);
  d.push(`• Đơn đặt từ web: ${a.cd.donWeb}${a.cd.donWeb ? ` · ${tien(a.cd.tienDonWeb)} khách trả` : ""}${a.cd.donHuy ? ` · huỷ ${a.cd.donHuy}` : ""}`);

  if (tuan) {
    const t = tuan.nay, tr = tuan.truoc;
    const cdT = congChuyenDoi(ls, t.ky.tu, t.ky.den), cdTr = congChuyenDoi(ls, tr.ky.tu, tr.ky.den);
    const lhT = cdT.sdt + cdT.emailKhongSdt, lhTr = cdTr.sdt + cdTr.emailKhongSdt;
    d.push("");
    d.push(`7 NGÀY QUA (${t.ky.tu.slice(5)} → ${t.ky.den.slice(5)}) so 7 ngày trước`);
    if (t.ga4) {
      d.push(`• Người dùng: ${fmt(t.ga4.nguoiDung)} ${tr.ga4 ? soSanh(t.ga4.nguoiDung, tr.ga4.nguoiDung, "7 ngày trước") : ""}`);
      d.push(`• Phiên: ${fmt(t.ga4.phien)} · vào blog ${fmt(t.ga4.phienBlog)} ${tr.ga4 ? soSanh(t.ga4.phienBlog, tr.ga4.phienBlog, "7 ngày trước") : ""}`);
    }
    d.push(`• Người để lại liên hệ: ${lhT} ${soSanh(lhT, lhTr, "7 ngày trước")} (SĐT ${cdT.sdt} · email ${cdT.email})` +
      (t.ga4?.nguoiDung ? ` — tỉ lệ ${((lhT / t.ga4.nguoiDung) * 100).toFixed(1)}%` : ""));
    d.push(`• Hồ sơ quiz: ${cdT.quizHoSo} ${soSanh(cdT.quizHoSo, cdTr.quizHoSo, "7 ngày trước")} · Đơn web: ${cdT.donWeb} (${tien(cdT.tienDonWeb)})${cdT.donHuy ? ` · huỷ ${cdT.donHuy}` : ""}`);
    const tn = tuan.tepNu?.nay;
    if (tn) {
      const coNhan = tn.nu + tn.nam;
      const tr2 = tuan.tepNu?.truoc;
      d.push(`• Tệp NỮ: ${Math.round((tn.nu / coNhan) * 100)}% nữ · ${Math.round((tn.nam / coNhan) * 100)}% nam (trên ${fmt(coNhan)} người Google gắn được nhãn${tn.khongRo ? `; ${fmt(tn.khongRo)} người không nhãn` : ""})` +
        (tr2 && tr2.nu + tr2.nam > 0 ? ` — 7 ngày trước ${Math.round((tr2.nu / (tr2.nu + tr2.nam)) * 100)}% nữ` : ""));
    } else if (tuan.tepNu) {
      d.push("• Tệp NỮ: GA4 chưa trả nhãn giới tính — cần bật Google Signals (GA4 → Quản trị → Thu thập dữ liệu) hoặc tệp còn dưới ngưỡng ẩn danh của Google. Đây là CHƯA ĐO ĐƯỢC, không phải 0% nữ.");
    }
    if (cdT.soNgayCo < 7) d.push(`  (lịch sử mới có ${cdT.soNgayCo}/7 ngày — máy đang tích số, vài hôm nữa mới so đủ)`);
  }

  d.push("");
  d.push("ĐỀ XUẤT");
  const dx: string[] = [];
  if (a.ga4 && tbNd && a.ga4.nguoiDung < tbNd * 0.6) {
    dx.push(`Người vào web tụt ${Math.round((1 - a.ga4.nguoiDung / tbNd) * 100)}% so nền 7 ngày — nhìn dòng "Đến từ": kênh nào rơi thì đó là chỗ hụt (Social rơi = bài FB hết đà; Organic rơi = kiểm chỉ mục/thứ hạng).`);
  }
  if (a.ga4 && a.ga4.nguoiDung >= 30 && lienHe === 0) {
    dx.push(`${fmt(a.ga4.nguoiDung)} người vào mà không ai để lại liên hệ: kiểm pop-up email + khối CTA cuối bài có hiện không (mở một bài blog bằng máy khác, cuộn tới 60%).`);
  }
  if (a.ga4 && a.ga4.phienBlog >= 50 && (a.cd.emailTheoNguon.blog || 0) === 0) {
    dx.push(`Blog đón ${fmt(a.ga4.phienBlog)} phiên nhưng cửa email trên blog thu 0 — người vào blog đang đi ra tay không; thứ hoạt động là ebook/quiz, không phải pop-up. Đáng thử: đổi quà pop-up sang thứ khách đang tải nhiều (ebook đủ đạm).`);
  }
  if (a.cd.donHuy >= 2 && a.cd.donHuy >= a.cd.donWeb) {
    dx.push(`Đơn web huỷ ${a.cd.donHuy} ≥ đơn giữ được ${a.cd.donWeb} — sale gọi xác nhận đơn web trong ngày, để qua đêm là huỷ.`);
  }
  if (a.cd.sdt >= 10 && a.ga4?.kenh?.[0] && /social|paid/i.test(a.ga4.kenh[0].ten)) {
    dx.push(`${a.cd.sdt} SĐT hôm qua chủ yếu do bài trên mạng xã hội kéo về — số này tắt cùng bài; giữ nhịp đăng bài mồi ở page NOVA để không rơi về 0 như tuần 25-31/08.`);
  }
  if (!dx.length) dx.push("Không có gì bất thường; giữ nhịp. Muốn tăng số liên hệ thì thứ đang ăn là ebook + quiz, không phải pop-up email.");
  dx.slice(0, 3).forEach((x, i) => d.push(`${i + 1}. ${x}`));
  return d.join("\n");
}

function dichKenh(t: string): string {
  const m: Record<string, string> = {
    "Organic Search": "Google tìm kiếm", "Organic Social": "Mạng xã hội", "Paid Social": "QC mạng xã hội",
    "Paid Search": "QC Google", "Direct": "Gõ thẳng/không rõ", "Referral": "Web khác dẫn", "Email": "Email",
    "Unassigned": "Chưa gán", "Organic Video": "Video", "Cross-network": "QC liên mạng",
  };
  return m[t] || t;
}

async function ga4Ngay(ngay: string): Promise<Ga4Ngay | null> {
  if (!ga4Property()) return null;
  const ky: Ky = { tu: ngay, den: ngay };
  const [tong, kenh, trang, blog] = await Promise.all([
    ga4Report(ky, ["totalUsers", "newUsers", "sessions", "engagedSessions", "screenPageViews"]),
    ga4Report(ky, ["sessions"], "sessionDefaultChannelGroup", 8),
    ga4Report(ky, ["sessions"], "landingPage", 6),
    ga4Report(ky, ["sessions"], "landingPage", 1000, { truong: "landingPage", chua: "/blog/" }),
  ]);
  const v = tong?.rows?.[0]?.metricValues || [];
  const so = (i: number) => Math.round(Number(v[i]?.value || 0));

  const phienBlog = (blog?.rows || []).reduce((s: number, r: any) => s + Number(r.metricValues?.[0]?.value || 0), 0);
  return {
    nguoiDung: so(0), nguoiMoi: so(1), phien: so(2), phienTuongTac: so(3), luotXem: so(4),
    phienBlog: Math.round(phienBlog),
    kenh: (kenh?.rows || []).map((r: any) => ({ ten: String(r.dimensionValues?.[0]?.value || ""), phien: Math.round(Number(r.metricValues?.[0]?.value || 0)) })),
    topTrang: (trang?.rows || []).map((r: any) => ({ ten: String(r.dimensionValues?.[0]?.value || "").slice(0, 80), phien: Math.round(Number(r.metricValues?.[0]?.value || 0)) })),
  };
}

async function ga4Tuan(ky: Ky): Promise<SoTuan["ga4"]> {
  if (!ga4Property()) return null;
  const [tong, blog] = await Promise.all([
    ga4Report(ky, ["totalUsers", "sessions"]),
    ga4Report(ky, ["sessions"], "landingPage", 1000, { truong: "landingPage", chua: "/blog/" }),
  ]);
  const v = tong?.rows?.[0]?.metricValues || [];
  return {
    nguoiDung: Math.round(Number(v[0]?.value || 0)), phien: Math.round(Number(v[1]?.value || 0)),
    phienBlog: Math.round((blog?.rows || []).reduce((s: number, r: any) => s + Number(r.metricValues?.[0]?.value || 0), 0)),
  };
}

async function docConfigJson(key: string): Promise<any> {
  try { const raw = await getConfigValue(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export async function chuyenDoiNgay(ngay: string, cache?: { blogLeads?: any[]; quiz?: any[]; ebookTong?: number }): Promise<ChuyenDoiNgay> {
  const sb = getServiceClient();
  const { tu, den } = khoangUtc(ngay);
  const tuMs = new Date(tu).getTime(), denMs = new Date(den).getTime();

  const blogLeads: any[] = cache?.blogLeads ?? (await docConfigJson("blog_leads")) ?? [];
  const quiz: any[] = cache?.quiz ?? (await docConfigJson("quiz_submissions")) ?? [];
  const ebookTong = cache?.ebookTong ?? Number((await docConfigJson("ebook_tai_dem"))?._tong || 0);

  const emailTheoNguon: Record<string, number> = {}; let email = 0, emailKhongSdt = 0;
  for (const l of Array.isArray(blogLeads) ? blogLeads : []) {
    const ts = Number(l?.ts || 0); if (!(ts >= tuMs && ts < denMs)) continue;
    email++; if (!l.phone) emailKhongSdt++;
    const n = nhomNguon(l.source); emailTheoNguon[n] = (emailTheoNguon[n] || 0) + 1;
  }
  const quizHoSo = (Array.isArray(quiz) ? quiz : []).filter((q) => { const ts = Number(q?.ts || 0); return ts >= tuMs && ts < denMs; }).length;

  const { data: leads } = await sb.from("leads").select("source,channel").gte("created_at", tu).lt("created_at", den).limit(2000);
  const sdtTheoNguon: Record<string, number> = {}; let sdt = 0;
  for (const l of leads || []) {
    if (!laLeadWeb(l)) continue;
    sdt++; const n = nhomNguon(l.source || l.channel || ""); sdtTheoNguon[n] = (sdtTheoNguon[n] || 0) + 1;
  }

  const qo = (await docConfigJson("quiz_orders")) || {};
  const sdtTheoMa = new Map<string, string>();
  for (const [ma, o] of Object.entries<any>(qo)) if (o?.phone) sdtTheoMa.set(String(ma), String(o.phone));

  const vao: DonWebVao[] = [];
  const { data: ods } = await sb.from("orders")
    .select("channel,channel_code,source_platform,status,order_code,net_revenue,gross_revenue,final_revenue")
    .gte("created_at", tu).lt("created_at", den).limit(500);
  for (const o of ods || []) {
    if (!laDonWeb(o)) continue;
    const ma = o.order_code ? String(o.order_code) : null;
    vao.push({
      ma, sdt: ma ? sdtTheoMa.get(ma) || null : null,
      tien: Number(o.final_revenue ?? o.gross_revenue ?? o.net_revenue ?? 0),
      huy: String(o.status || "").toLowerCase() === "cancelled", nguon: "orders",
    });
  }
  const { data: tgs } = await sb.from("tg_orders").select("sdt,khach_tra,chat_id").eq("ngay", ngay)
    .or("chat_id.like.salepage:%,chat_id.like.web:%").limit(500);
  for (const t of tgs || []) vao.push({ sdt: t.sdt, tien: Number(t.khach_tra || 0), nguon: "so-don" });
  for (const [ma, o] of Object.entries<any>(qo)) {
    if (String(o?.status || "") !== "paid") continue;
    const ts = Number(o.paidAt || o.createdAt || 0); if (!(ts >= tuMs && ts < denMs)) continue;
    vao.push({ ma: String(ma), sdt: o.phone, tien: Number(o.amount || 0), nguon: "payos" });
  }
  const gop = gopDonWeb(vao);
  const donWeb = gop.don, tienDonWeb = gop.tien, donHuy = gop.huy;

  return { email, emailTheoNguon, emailKhongSdt, sdt, sdtTheoNguon, quizHoSo, donWeb, tienDonWeb, donHuy, ebookTaiLuyKe: ebookTong };
}

export async function docLichSu(): Promise<LichSu> {
  const j = await docConfigJson(KHOA_LICH_SU);
  return j && typeof j === "object" && !Array.isArray(j) ? j : {};
}
export async function luuLichSu(ls: LichSu): Promise<void> {
  const ngay = Object.keys(ls).sort();
  const giu: LichSu = {};
  for (const d of ngay.slice(-GIU_NGAY)) giu[d] = ls[d];
  await setConfigValue(KHOA_LICH_SU, JSON.stringify(giu), "Ảnh chụp web example.com theo ngày: GA4 + chuyển đổi (120 ngày)");
}

export async function chupNgay(ngay: string, cache?: Parameters<typeof chuyenDoiNgay>[1]): Promise<AnhNgay> {
  const [ga4, cd] = await Promise.all([ga4Ngay(ngay), chuyenDoiNgay(ngay, cache)]);
  return { ngay, ga4, cd, chupLuc: new Date().toISOString() };
}

export async function chayMotLuot(opts: { ngay?: string; soNgayBu?: number } = {}): Promise<{ text: string; anh: AnhNgay; ls: LichSu }> {
  const ngay = opts.ngay || ngayCong(homNayVN(), -1);
  const ls = await docLichSu();

  const cache = {
    blogLeads: (await docConfigJson("blog_leads")) ?? [],
    quiz: (await docConfigJson("quiz_submissions")) ?? [],
    ebookTong: Number((await docConfigJson("ebook_tai_dem"))?._tong || 0),
  };
  const canChup: string[] = [ngay, ngayCong(ngay, -1)];
  for (let i = 2; i <= (opts.soNgayBu || 0); i++) { const d = ngayCong(ngay, -i); if (!ls[d]) canChup.push(d); }
  for (const d of canChup) {
    const a = await chupNgay(d, cache);

    if (d !== ngay) a.cd.ebookTaiLuyKe = ls[d]?.cd.ebookTaiLuyKe || 0;
    ls[d] = a;
  }
  await luuLichSu(ls);

  let tuan: { nay: SoTuan; truoc: SoTuan; tepNu?: { nay: TepNu; truoc: TepNu } } | null = null;
  try {
    const kyNay: Ky = { tu: ngayCong(ngay, -6), den: ngay };
    const kyTruoc: Ky = { tu: ngayCong(ngay, -13), den: ngayCong(ngay, -7) };
    const [gNay, gTruoc, nuNay, nuTruoc] = await Promise.all([
      ga4Tuan(kyNay), ga4Tuan(kyTruoc),
      ga4TepNu(kyNay).catch(() => null), ga4TepNu(kyTruoc).catch(() => null),
    ]);
    tuan = { nay: { ky: kyNay, ga4: gNay }, truoc: { ky: kyTruoc, ga4: gTruoc }, tepNu: { nay: nuNay, truoc: nuTruoc } };
  } catch { tuan = null; }

  return { text: vietBaoCaoNgay(ls[ngay], ls, tuan), anh: ls[ngay], ls };
}

export async function khoiChuyenDoiTuan(ky: Ky, kyTruoc: Ky): Promise<string> {
  const ls = await docLichSu();
  const t = congChuyenDoi(ls, ky.tu, ky.den), tr = congChuyenDoi(ls, kyTruoc.tu, kyTruoc.den);
  if (!t.soNgayCo) return "";
  const lh = t.sdt + t.emailKhongSdt, lhTr = tr.sdt + tr.emailKhongSdt;
  const d = ["CHUYỂN ĐỔI TỪ WEB (tuần này so tuần trước)"];
  d.push(`• Người để lại liên hệ: ${lh} ${soSanh(lh, lhTr, "tuần trước")} — SĐT ${t.sdt} (${inNguon(t.sdtTheoNguon) || "0"}) · email ${t.email} (${inNguon(t.emailTheoNguon) || "0"})`);
  d.push(`• Hồ sơ quiz: ${t.quizHoSo} ${soSanh(t.quizHoSo, tr.quizHoSo, "tuần trước")} · Đơn web: ${t.donWeb} (${tien(t.tienDonWeb)})${t.donHuy ? ` · huỷ ${t.donHuy}` : ""}`);
  if (t.soNgayCo < 7) d.push(`  (mới có ${t.soNgayCo}/7 ngày trong sổ)`);
  return d.join("\n");
}
