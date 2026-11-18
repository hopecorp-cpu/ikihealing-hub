import { googleToken, saConfigured } from "@/lib/google-sa";
import { ga4Report } from "@/lib/ga4";
export { ga4Property } from "@/lib/ga4";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { xuHuongChiMuc } from "@/lib/chi-muc";
import { khoiChuyenDoiTuan } from "@/lib/web-ngay";

const KEY_LICH_SU = "seo_web_weekly";
const GIU_TUAN = 26;
const TRE_NGAY = 3;

const SCOPE_GSC = "https://www.googleapis.com/auth/webmasters.readonly";

export type { Ky } from "@/lib/ga4";
type Ky = import("@/lib/ga4").Ky;
export type GscTong = { clicks: number; impressions: number; ctr: number; viTri: number };
export type GscDong = { ten: string; clicks: number; impressions: number; ctr: number; viTri: number };
export type Ga4Tong = { nguoiDung: number; phien: number; phienCoTuongTac: number };
export type AnhChup = {
  ky: Ky;
  gsc: GscTong;
  soTrangCoHienThi: number;
  topTrang: GscDong[];
  topTruyVan: GscDong[];
  ganTrangMot: GscDong[];
  nhieuHienThiItClick: GscDong[];
  ga4: Ga4Tong | null;
  ga4TopTrang: { ten: string; phien: number }[];
  chupLuc: string;
};

export function gscSite(): string {
  return (process.env.GSC_SITE || "sc-domain:example.com").trim();
}

function ngayLui(soNgay: number): string {
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  d.setUTCDate(d.getUTCDate() - soNgay);
  return d.toISOString().slice(0, 10);
}

export function haiKy(): { nay: Ky; truoc: Ky } {
  return {
    nay: { tu: ngayLui(TRE_NGAY + 6), den: ngayLui(TRE_NGAY) },
    truoc: { tu: ngayLui(TRE_NGAY + 13), den: ngayLui(TRE_NGAY + 7) },
  };
}

export async function gscQuery(body: Record<string, unknown>): Promise<any[]> {
  const token = await googleToken([SCOPE_GSC]);
  const site = encodeURIComponent(gscSite());
  const res = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${site}/searchAnalytics/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = String(j?.error?.message || res.status);

    throw new Error(res.status === 403
      ? `Search Console từ chối (${msg}). Cần thêm email tài khoản máy vào Cài đặt > Người dùng của ${gscSite()}.`
      : `Search Console lỗi: ${msg}`);
  }
  return Array.isArray(j.rows) ? j.rows : [];
}

function dongTuRow(r: any): GscDong {
  return {
    ten: String(r.keys?.[0] || "").slice(0, 120),
    clicks: Math.round(r.clicks || 0),
    impressions: Math.round(r.impressions || 0),
    ctr: Number(((r.ctr || 0) * 100).toFixed(2)),
    viTri: Number((r.position || 0).toFixed(1)),
  };
}

async function gscTong(ky: Ky): Promise<GscTong> {
  const rows = await gscQuery({ startDate: ky.tu, endDate: ky.den, dimensions: [], rowLimit: 1 });
  const r = rows[0];

  if (!r) throw new Error(`Search Console không trả dòng nào cho ${ky.tu}..${ky.den} — kiểm GSC_SITE ("${gscSite()}") và quyền của tài khoản máy.`);
  return {
    clicks: Math.round(r.clicks || 0),
    impressions: Math.round(r.impressions || 0),
    ctr: Number(((r.ctr || 0) * 100).toFixed(2)),
    viTri: Number((r.position || 0).toFixed(1)),
  };
}

export async function chupKy(ky: Ky): Promise<AnhChup> {
  const [gsc, rowsTrang, rowsQuery] = await Promise.all([
    gscTong(ky),
    gscQuery({ startDate: ky.tu, endDate: ky.den, dimensions: ["page"], rowLimit: 200 }),
    gscQuery({ startDate: ky.tu, endDate: ky.den, dimensions: ["query"], rowLimit: 200 }),
  ]);

  const trang = rowsTrang.map(dongTuRow);
  const truyVan = rowsQuery.map(dongTuRow);
  const theoClick = (a: GscDong, b: GscDong) => b.clicks - a.clicks || b.impressions - a.impressions;

  let ga4: Ga4Tong | null = null;
  let ga4TopTrang: { ten: string; phien: number }[] = [];
  try {
    const tong = await ga4Report(ky, ["totalUsers", "sessions", "engagedSessions"]);
    if (tong?.rows?.[0]) {
      const v = tong.rows[0].metricValues || [];
      ga4 = {
        nguoiDung: Math.round(Number(v[0]?.value || 0)),
        phien: Math.round(Number(v[1]?.value || 0)),
        phienCoTuongTac: Math.round(Number(v[2]?.value || 0)),
      };
    }
    const trangGa = await ga4Report(ky, ["sessions"], "landingPage", 5);
    ga4TopTrang = (trangGa?.rows || []).map((r: any) => ({
      ten: String(r.dimensionValues?.[0]?.value || "").slice(0, 100),
      phien: Math.round(Number(r.metricValues?.[0]?.value || 0)),
    }));
  } catch { ga4 = null; ga4TopTrang = []; }

  return {
    ky,
    gsc,
    soTrangCoHienThi: trang.length,
    topTrang: [...trang].sort(theoClick).slice(0, 5),
    topTruyVan: [...truyVan].sort(theoClick).slice(0, 5),

    ganTrangMot: trang.filter((t) => t.viTri >= 5 && t.viTri <= 20 && t.impressions >= 20)
      .sort((a, b) => b.impressions - a.impressions).slice(0, 5),

    nhieuHienThiItClick: truyVan.filter((q) => q.impressions >= 50 && q.ctr < 1)
      .sort((a, b) => b.impressions - a.impressions).slice(0, 5),
    ga4,
    ga4TopTrang,
    chupLuc: new Date().toISOString(),
  };
}

function phanTram(nay: number, truoc: number): string {
  if (!truoc) return nay ? "(tuần trước chưa có số)" : "";
  const d = ((nay - truoc) / truoc) * 100;
  const dau = d >= 0 ? "+" : "";
  return `(${dau}${d.toFixed(0)}% so tuần trước)`;
}

export function vietBaoCao(nay: AnhChup, truoc: AnhChup | null, dongChiMuc = "", khoiChuyenDoi = ""): string {
  const d: string[] = [];
  d.push(`WEBSITE example.com — tuần ${nay.ky.tu} đến ${nay.ky.den}`);
  d.push(`(số Search Console chốt trễ ${TRE_NGAY} ngày nên đây là tuần gần nhất đã đủ số)`);
  d.push("");
  d.push("TÌM KIẾM GOOGLE");
  d.push(`• Lượt bấm vào web: ${nay.gsc.clicks} ${truoc ? phanTram(nay.gsc.clicks, truoc.gsc.clicks) : ""}`);
  d.push(`• Lượt hiện ra trên Google: ${nay.gsc.impressions.toLocaleString("vi-VN")} ${truoc ? phanTram(nay.gsc.impressions, truoc.gsc.impressions) : ""}`);
  d.push(`• Tỉ lệ bấm: ${nay.gsc.ctr}% · Vị trí trung bình: ${nay.gsc.viTri}`);
  d.push(`• Số trang có ít nhất 1 lượt hiện: ${nay.soTrangCoHienThi}${truoc ? ` (tuần trước ${truoc.soTrangCoHienThi})` : ""}`);

  if (nay.ga4) {
    d.push("");
    d.push("NGƯỜI VÀO WEB (Analytics)");
    d.push(`• Người dùng: ${nay.ga4.nguoiDung} ${truoc?.ga4 ? phanTram(nay.ga4.nguoiDung, truoc.ga4.nguoiDung) : ""}`);
    d.push(`• Phiên truy cập: ${nay.ga4.phien} · có tương tác: ${nay.ga4.phienCoTuongTac}`);
    if (nay.ga4TopTrang.length) d.push(`• Trang kéo khách nhất: ${nay.ga4TopTrang.map((t) => `${t.ten} (${t.phien})`).join(" · ")}`);
  } else {
    d.push("");
    d.push("NGƯỜI VÀO WEB (Analytics): chưa đọc được — chưa cấp quyền GA4 cho tài khoản máy hoặc chưa đặt GA4_PROPERTY_ID.");
  }

  if (nay.topTrang.length) {
    d.push("");
    d.push("TRANG MẠNH NHẤT TUẦN");
    nay.topTrang.forEach((t) => d.push(`• ${t.ten} — ${t.clicks} bấm / ${t.impressions} hiện / vị trí ${t.viTri}`));
  }
  if (nay.topTruyVan.length) {
    d.push("");
    d.push("KHÁCH GÕ GÌ ĐỂ RA MÌNH");
    nay.topTruyVan.forEach((q) => d.push(`• "${q.ten}" — ${q.clicks} bấm / ${q.impressions} hiện / vị trí ${q.viTri}`));
  }

  if (dongChiMuc) { d.push(""); d.push(dongChiMuc); }

  if (khoiChuyenDoi) { d.push(""); d.push(khoiChuyenDoi); }

  d.push("");
  d.push("ĐỀ XUẤT TUẦN NÀY");
  const dx: string[] = [];
  if (nay.ganTrangMot.length) {
    dx.push(`Đẩy ${nay.ganTrangMot.length} trang đang ở vị trí 5-20 lên trang 1 (rẻ nhất vì đã có thứ hạng): ${nay.ganTrangMot.slice(0, 3).map((t) => t.ten).join(" · ")}. Cách: viết thêm phần trả lời đúng câu khách hỏi + trỏ link nội bộ từ bài mạnh sang.`);
  }
  if (nay.nhieuHienThiItClick.length) {
    dx.push(`${nay.nhieuHienThiItClick.length} truy vấn hiện nhiều mà gần như không ai bấm (${nay.nhieuHienThiItClick.slice(0, 3).map((q) => `"${q.ten}"`).join(" · ")}) — vấn đề nằm ở TIÊU ĐỀ và mô tả, không phải nội dung. Viết lại tiêu đề cho đúng ý người tìm.`);
  }
  if (truoc && nay.gsc.impressions < truoc.gsc.impressions * 0.8) {
    dx.push(`Lượt hiện tụt hơn 20% so tuần trước — kiểm ngay: bài mới có được Google lập chỉ mục không, và sơ đồ trang (sitemap) còn báo lỗi gì không.`);
  }
  if (nay.gsc.clicks > 0 && nay.gsc.ctr < 1.5) {
    dx.push(`Tỉ lệ bấm ${nay.gsc.ctr}% là thấp so với mức thường thấy 2-3%: ưu tiên sửa tiêu đề của nhóm bài đang có nhiều lượt hiện nhất trước khi viết thêm bài mới.`);
  }
  if (!dx.length) dx.push("Giữ nhịp viết như tuần rồi; chưa thấy chỗ nào cần can thiệp gấp.");
  dx.slice(0, 4).forEach((x, i) => d.push(`${i + 1}. ${x}`));

  return d.join("\n");
}

export async function docLichSu(): Promise<AnhChup[]> {
  try {
    const raw = await getConfigValue(KEY_LICH_SU);
    const j = raw ? JSON.parse(raw) : null;
    return Array.isArray(j?.items) ? j.items : [];
  } catch { return []; }
}

export async function luuAnhChup(a: AnhChup): Promise<void> {
  const items = (await docLichSu()).filter((x) => x.ky?.den !== a.ky.den);
  items.push(a);
  items.sort((x, y) => (x.ky.den < y.ky.den ? -1 : 1));
  await setConfigValue(KEY_LICH_SU, JSON.stringify({ items: items.slice(-GIU_TUAN), updatedAt: new Date().toISOString() }),
    "Ảnh chụp Search Console + GA4 theo tuần (26 tuần gần nhất)");
}

export async function chayMotLuot(): Promise<{ text: string; nay: AnhChup }> {
  if (!saConfigured()) throw new Error("Chưa đặt GOOGLE_SA_JSON trên Vercel — xem docs/SETUP-GOOGLE-SEARCH-CONSOLE.md");
  const { nay: kyNay, truoc: kyTruoc } = haiKy();
  const nay = await chupKy(kyNay);

  const lichSu = await docLichSu();
  let truoc = lichSu.find((x) => x.ky?.den === kyTruoc.den) || null;
  if (!truoc) {

    try { truoc = await chupKy(kyTruoc); await luuAnhChup(truoc); } catch { truoc = null; }
  }

  await luuAnhChup(nay);

  let dongChiMuc = "";
  try { dongChiMuc = await xuHuongChiMuc(); } catch { }
  let khoiCd = "";
  try { khoiCd = await khoiChuyenDoiTuan(kyNay, kyTruoc); } catch { }
  return { text: vietBaoCao(nay, truoc, dongChiMuc, khoiCd), nay };
}
