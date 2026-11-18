import { googleToken } from "@/lib/google-sa";
import { getConfigValue, setConfigValue } from "@/lib/app-config";

const LLMS = "https://example.com/llms.txt";
const GSC_MAC_DINH = "sc-domain:example.com";
const KHOA = "blog_chi_muc_ban_do";
const KHOA_LICH_SU = "blog_chi_muc_lich_su";

export type TrangThaiBai = { trangThai: string; doLuc: string; ten?: string };
export type BanDoChiMuc = {
  doLuc?: string;
  bai?: Record<string, TrangThaiBai>;
  daDung?: Record<string, string>;
  chuaLap?: string[];
  daLapDs?: string[];
};

export function laDaLap(v: string): boolean {
  return /đã được gửi và lập chỉ mục|đã lập chỉ mục|submitted and indexed|url is on google/i.test(String(v || ""));
}

export async function layDanhMuc(): Promise<{ slug: string; ten: string }[]> {
  const r = await fetch(LLMS, { cache: "no-store" });
  if (!r.ok) throw new Error(`Không đọc được llms.txt (HTTP ${r.status})`);
  const ds: { slug: string; ten: string }[] = [];
  for (const l of (await r.text()).split("\n")) {
    const m = l.match(/^- \[([^\]]+)\]\(https:\/\/example\.com\/blog\/([a-z0-9-]+)\.html\)/);
    if (m) ds.push({ ten: m[1], slug: m[2] });
  }

  if (!ds.length) throw new Error("llms.txt không có bài nào — nguồn hỏng, dừng để khỏi ghi đè bản đồ");
  return ds;
}

export async function docBanDo(): Promise<BanDoChiMuc> {
  try { return JSON.parse((await getConfigValue(KHOA)) || "{}") as BanDoChiMuc; } catch { return {}; }
}

async function soiMot(token: string, slug: string, site: string): Promise<string> {
  const r = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      inspectionUrl: `https://example.com/blog/${slug}.html`,
      siteUrl: site, languageCode: "vi",
    }),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 120)}`);
  const j: any = await r.json();
  return j?.inspectionResult?.indexStatusResult?.coverageState || "(không rõ)";
}

export type KetQuaQuet = {
  soi: number; hong: number;
  daLap: number; chuaLap: number; tong: number; daSoi: number;
  moiVao: string[];
};

export async function quetMotLuot(soLuong = 60, hanChot = Date.now() + 240_000): Promise<KetQuaQuet> {
  const [danhMuc, banDo] = await Promise.all([layDanhMuc(), docBanDo()]);
  const bai = { ...(banDo.bai || {}) };
  const token = await googleToken(["https://www.googleapis.com/auth/webmasters.readonly"]);
  const site = (process.env.GSC_SITE || "").trim() || GSC_MAC_DINH;

  const xep = [...danhMuc].sort((a, b) => (bai[a.slug]?.doLuc || "").localeCompare(bai[b.slug]?.doLuc || ""));
  const lam = xep.slice(0, soLuong);

  let soi = 0, hong = 0;
  const moiVao: string[] = [];
  for (const b of lam) {
    if (Date.now() > hanChot) break;
    try {
      const tt = await soiMot(token, b.slug, site);
      const truoc = bai[b.slug]?.trangThai;
      if (truoc && !laDaLap(truoc) && laDaLap(tt)) moiVao.push(b.slug);
      bai[b.slug] = { trangThai: tt, doLuc: new Date().toISOString(), ten: b.ten };
      soi++;
    } catch { hong++; }
  }

  const daSoi = danhMuc.filter((b) => bai[b.slug]).length;
  const daLap = danhMuc.filter((b) => laDaLap(bai[b.slug]?.trangThai || "")).length;
  const chuaLap = daSoi - daLap;

  const chuaSet = new Set(banDo.chuaLap || []);
  for (const b of lam) {
    const tt = bai[b.slug]?.trangThai;
    if (!tt) continue;
    if (laDaLap(tt)) chuaSet.delete(b.slug); else chuaSet.add(b.slug);
  }

  await setConfigValue(KHOA, JSON.stringify({
    ...banDo, doLuc: new Date().toISOString(), bai,
    chuaLap: [...chuaSet].sort(),
    daLapDs: danhMuc.filter((b) => laDaLap(bai[b.slug]?.trangThai || "")).map((b) => b.slug),
  }), "Ban do trang thai lap chi muc tung bai blog (quet dan bang URL Inspection API)");

  try {
    const ls: Record<string, { daLap: number; daSoi: number; tong: number }> =
      JSON.parse((await getConfigValue(KHOA_LICH_SU)) || "{}");
    const ngay = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
    ls[ngay] = { daLap, daSoi, tong: danhMuc.length };
    const giu = Object.fromEntries(Object.entries(ls).sort().slice(-120));
    await setConfigValue(KHOA_LICH_SU, JSON.stringify(giu), "So theo ngay: bao nhieu bai blog da vao chi muc Google");
  } catch { }

  return { soi, hong, daLap, chuaLap, tong: danhMuc.length, daSoi, moiVao };
}

export async function baiChuaLapChiMuc(): Promise<string[]> {
  const banDo = await docBanDo();
  return Object.entries(banDo.bai || {}).filter(([, v]) => !laDaLap(v.trangThai)).map(([s]) => s);
}

export async function xuHuongChiMuc(): Promise<string> {
  let ls: Record<string, { daLap: number; daSoi: number; tong: number }> = {};
  try { ls = JSON.parse((await getConfigValue(KHOA_LICH_SU)) || "{}"); } catch { }
  const ngay = Object.keys(ls).sort();
  if (!ngay.length) return "CHỈ MỤC GOOGLE: chưa có số (máy quét chưa chạy lượt nào).";
  const nay = ls[ngay[ngay.length - 1]];
  const lay = (n: number) => { const d = ngay[Math.max(0, ngay.length - 1 - n)]; return d && d !== ngay[ngay.length - 1] ? ls[d] : null; };
  const t7 = lay(7), t30 = lay(30);
  const so = (cu: typeof nay | null, nhan: string) =>
    cu ? ` · ${nhan} ${nay.daLap - cu.daLap >= 0 ? "+" : ""}${nay.daLap - cu.daLap}` : "";
  return `CHỈ MỤC GOOGLE: ${nay.daLap}/${nay.tong} bài đã vào chỉ mục` +
    `${so(t7, "7 ngày")}${so(t30, "30 ngày")} (đã soi ${nay.daSoi}/${nay.tong})`;
}
