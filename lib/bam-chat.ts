import { getConfigValue, setConfigValue } from "@/lib/app-config";

const KEY = "bam_chat_daily";
export const LOAI_BAM = ["zalo", "goi"] as const;
export type LoaiBam = (typeof LOAI_BAM)[number];

export function chuanKenh(s: unknown): string {
  const v = String(s ?? "").toLowerCase().trim();
  if (!v) return "truc-tiep";
  if (/^ref:/.test(v)) {
    const h = v.slice(4);
    if (/facebook|fb\.|instagram|messenger/.test(h)) return "facebook";
    if (/google/.test(h)) return "google";
    if (/tiktok/.test(h)) return "tiktok";
    if (/zalo/.test(h)) return "zalo";
    if (/youtube|youtu\.be/.test(h)) return "youtube";
    return "web-khac";
  }
  if (/^(fb|facebook|ig|instagram|meta|messenger)/.test(v)) return "facebook";
  if (/^(google|gg|adwords|gads)/.test(v)) return "google";
  if (/^(tiktok|tt)/.test(v)) return "tiktok";
  if (/^zalo/.test(v)) return "zalo";
  if (/^(youtube|yt)/.test(v)) return "youtube";
  if (/mail/.test(v)) return "email";
  if (/^(ctv|aff)/.test(v)) return "ctv";
  return "khac";
}

export function chuanTrang(s: unknown): string | null {
  const v = String(s ?? "").toLowerCase().replace(/^www\./, "").replace(/[^a-z0-9.-]/g, "").slice(0, 30);
  return v ? v : null;
}

type Daily = Record<string, Record<string, number>>;

async function doc(): Promise<Daily> {
  try { return JSON.parse((await getConfigValue(KEY)) || "{}"); } catch { return {}; }
}

export async function ghiBamChat(trang: string, kenh: string, loai: LoaiBam, ngay: string) {
  const map = await doc();
  const moc = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  for (const k of Object.keys(map)) if (k < moc) delete map[k];
  (map[ngay] ??= {});
  const kk = `${trang}|${kenh}|${loai}`;
  map[ngay][kk] = (map[ngay][kk] || 0) + 1;
  await setConfigValue(KEY, JSON.stringify(map), "Đếm lượt bấm Zalo/gọi trên web + sale page theo kênh (nguon.js)");
}

export type DongBam = { kenh: string; zalo: number; goi: number; theoTrang: Record<string, number> };

export async function layBamChat(tu: string, den: string): Promise<{ dong: DongBam[]; tong: { zalo: number; goi: number }; coSo: boolean }> {
  const map = await doc();
  const theoKenh = new Map<string, DongBam>();
  let coSo = false;
  for (const [ngay, rec] of Object.entries(map)) {
    if (ngay < tu || ngay > den) continue;
    for (const [kk, n] of Object.entries(rec)) {
      const [trang, kenh, loai] = kk.split("|");
      coSo = true;
      const d = theoKenh.get(kenh) || { kenh, zalo: 0, goi: 0, theoTrang: {} };
      if (loai === "zalo") d.zalo += n; else if (loai === "goi") d.goi += n;
      d.theoTrang[trang] = (d.theoTrang[trang] || 0) + n;
      theoKenh.set(kenh, d);
    }
  }
  const dong = [...theoKenh.values()].sort((a, b) => b.zalo + b.goi - (a.zalo + a.goi));
  return { dong, tong: { zalo: dong.reduce((s, d) => s + d.zalo, 0), goi: dong.reduce((s, d) => s + d.goi, 0) }, coSo };
}
