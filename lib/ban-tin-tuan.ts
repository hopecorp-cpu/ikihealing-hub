import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { findBanned } from "@/lib/banned-words";
import { wrap, getLeads, duocGuiQC } from "@/lib/blog-nurture";
import { lamSachTieuDe, locVaGop, thanBanTin, tieuDeThu, tachLinkThem, type MucBanTin } from "./ban-tin-tuan-core";

const YT_KENH = process.env.YOUTUBE_CHANNEL_ID || "";
const TRANG_MAC_DINH = ["000000000000000"];
const G = "https://graph.facebook.com/v21.0";
const VN = 7 * 3600e3;
const ngayVN = (iso: string) => { const t = Date.parse(iso); return Number.isFinite(t) ? new Date(t + VN).toISOString().slice(0, 10) : ""; };
const KHOA_NHAP = "ban_tin_tuan_nhap";

async function layText(url: string, init?: RequestInit, giu = 0): Promise<string> {
  const r = await fetch(url, { ...init, ...(giu ? { next: { revalidate: giu } } : { cache: "no-store" as const }), signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url.split("?")[0]}`);
  return r.text();
}
const giaiXml = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

export async function videoYoutube(): Promise<MucBanTin[]> {
  const xml = await layText(`https://www.youtube.com/feeds/videos.xml?channel_id=${YT_KENH}`);
  return xml.split("<entry>").slice(1).map((e) => {
    const id = e.match(/<yt:videoId>([^<]+)/)?.[1] || "";
    const tieuDe = lamSachTieuDe(giaiXml(e.match(/<title>([^<]*)/)?.[1] || ""));
    const moTa = lamSachTieuDe(giaiXml(e.match(/<media:description>([^<]*)/)?.[1] || ""), 160);
    return { id: `yt:${id}`, loai: "youtube" as const, tieuDe, moTa, url: `https://www.youtube.com/watch?v=${id}`, anh: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, ngay: ngayVN(e.match(/<published>([^<]+)/)?.[1] || ""), nguon: "YouTube NOVA" };
  }).filter((m) => m.id !== "yt:");
}

export async function videoFanpage(tu: number, den: number): Promise<{ muc: MucBanTin[]; loi: string[] }> {
  const { getPageToken } = await import("@/lib/fb-publish");
  let ids = TRANG_MAC_DINH;
  try { const c = JSON.parse((await getConfigValue("ban_tin_tuan_trang")) || "null"); if (Array.isArray(c) && c.length) ids = c.map(String); } catch {  }
  const muc: MucBanTin[] = [], loi: string[] = [];
  for (const pid of ids) {
    const page = await getPageToken(pid);
    if (!page) { loi.push(`Fanpage ${pid}: không lấy được quyền trang (FB_USER_TOKEN)`); continue; }
    for (const ep of ["videos", "video_reels"]) {
      try {
        const q = `fields=id,title,description,created_time,permalink_url,picture&since=${Math.floor(tu / 1000)}&until=${Math.floor(den / 1000)}&limit=50&access_token=${encodeURIComponent(page.token)}`;
        const j: any = JSON.parse(await layText(`${G}/${pid}/${ep}?${q}`));
        if (j.error) throw new Error(j.error.message);
        for (const v of j.data || []) {
          const url = v.permalink_url ? (String(v.permalink_url).startsWith("http") ? v.permalink_url : `https://www.facebook.com${v.permalink_url}`) : "";
          muc.push({ id: `fb:${v.id}`, loai: "fanpage", tieuDe: lamSachTieuDe(v.title || v.description || ""), moTa: v.title ? lamSachTieuDe(v.description || "", 160) : undefined, url, anh: v.picture || undefined, ngay: ngayVN(v.created_time || ""), nguon: page.name });
        }
      } catch (e: any) { loi.push(`Fanpage ${page.name} (${ep}): ${e?.message || e}`); }
    }
  }
  return { muc, loi };
}

const meta = (html: string, ten: string) => giaiXml(html.match(new RegExp(`<meta[^>]+(?:property|name)="${ten}"[^>]+content="([^"]*)"`))?.[1] || "");

export async function baiBlog(tu: number, den: number): Promise<MucBanTin[]> {
  const tok = (process.env.APP_GH_TOKEN || "").trim();
  const h: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "ikihealing-hub-ban-tin-tuan", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) };
  const api = "https://api.github.com/repos/your-org/nova-website";
  const ds: any[] = JSON.parse(await layText(`${api}/commits?path=blog&since=${new Date(tu).toISOString()}&until=${new Date(den).toISOString()}&per_page=50`, { headers: h }, 1800));
  const slug = new Set<string>();
  for (const c of ds.slice(0, 30)) {
    const ct: any = JSON.parse(await layText(`${api}/commits/${c.sha}`, { headers: h }, 86400));
    for (const f of ct.files || []) {
      const m = String(f.filename).match(/^blog\/([a-z0-9-]+)\.html$/);
      if (m && f.status === "added" && !m[1].startsWith("danh-muc")) slug.add(m[1]);
    }
  }
  const muc: MucBanTin[] = [];
  for (const s of [...slug].slice(0, 12)) {
    const url = `https://example.com/blog/${s}.html`;
    try {
      const html = await layText(url);
      const tieuDe = lamSachTieuDe(meta(html, "og:title") || html.match(/<title>([^<]*)/)?.[1] || s);
      muc.push({ id: `blog:${s}`, loai: "blog", tieuDe, moTa: lamSachTieuDe(meta(html, "og:description") || meta(html, "description"), 170), url, anh: meta(html, "og:image") || undefined, ngay: (meta(html, "article:published_time") || "").slice(0, 10), nguon: "Blog example.com" });
    } catch {  }
  }
  return muc;
}

export type GomTuan = { muc: MucBanTin[]; loi: string[]; luc: string };

export async function gomTuan(k: { tu: number; den: number; tuNgay: string; denNgay: string }): Promise<GomTuan> {
  const loi: string[] = [];
  const [yt, fb, blog] = await Promise.all([
    videoYoutube().catch((e) => { loi.push(`YouTube: ${e?.message || e}`); return [] as MucBanTin[]; }),
    videoFanpage(k.tu, k.den).catch((e) => { loi.push(`Fanpage: ${e?.message || e}`); return { muc: [] as MucBanTin[], loi: [] as string[] }; }),
    baiBlog(k.tu, k.den).catch((e) => { loi.push(`Blog: ${e?.message || e}`); return [] as MucBanTin[]; }),
  ]);
  loi.push(...fb.loi);
  return { muc: locVaGop([...yt, ...fb.muc, ...blog], k.tuNgay, k.denNgay), loi, luc: new Date().toISOString() };
}

export type BanDung = { subject: string; html: string; tuCam: string[]; soVideo: number; soBai: number };

export function dungThu(muc: MucBanTin[], linkThem: string, tuNgay: string, denNgay: string): BanDung {
  const tatCa = [...muc, ...tachLinkThem(linkThem, denNgay)];
  const soVideo = tatCa.filter((m) => m.loai !== "blog").length;
  const soBai = tatCa.filter((m) => m.loai === "blog").length;
  const subject = tieuDeThu(soVideo, soBai, tuNgay, denNgay);
  const html = wrap("Điểm tin tuần của NOVA", thanBanTin(tatCa, tuNgay));
  const chu = [subject, ...tatCa.map((m) => `${m.tieuDe}\n${m.moTa || ""}`), thanBanTin([], tuNgay)].join("\n");
  return { subject, html, tuCam: findBanned(chu), soVideo, soBai };
}

export type NhapBanTin = {
  tuNgay: string; denNgay: string; subject: string; html: string; mucIds: string[]; linkThem: string;
  luc: string; nguoi: string; trangThai: "nhap"; ghiChu: string;
};

export async function docNhap(): Promise<Record<string, NhapBanTin>> {
  try { return JSON.parse((await getConfigValue(KHOA_NHAP)) || "{}"); } catch { return {}; }
}

export async function luuNhap(n: Omit<NhapBanTin, "trangThai" | "ghiChu">, tuCam: string[]): Promise<{ ok: boolean; error?: string }> {
  if (tuCam.length) return { ok: false, error: `Còn từ cấm: ${tuCam.join(", ")}. Bỏ mục đó rồi lưu lại.` };
  const all = await docNhap();
  all[n.tuNgay] = { ...n, trangThai: "nhap", ghiChu: "CHƯA GỬI. Gửi cho khách cần lệnh CEO; khi gửi đi qua guiEmailNuoi (link huỷ, nhãn QC, trần nhịp)." };
  const giu = Object.keys(all).sort().slice(-12);
  await setConfigValue(KHOA_NHAP, JSON.stringify(Object.fromEntries(giu.map((k) => [k, all[k]]))), "Bản nháp bản tin email tuần NOVA (chưa gửi)");
  return { ok: true };
}

export async function demNguoiNhan(): Promise<{ tong: number; duocGui: number }> {
  const ds = await getLeads();
  return { tong: ds.length, duocGui: ds.filter(duocGuiQC).length };
}
