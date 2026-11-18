export type BaiGoiY = { slug: string; tieuDe: string; url: string; diem: number };

const KHO = "https://example.com/llms.txt";
let cache: { luc: number; ds: { slug: string; tieuDe: string }[] } | null = null;

const boDau = (s: string) =>
  (s || "").replace(/Đ/g, "D").replace(/đ/g, "d").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const TU_RONG = new Set(
  "cua va la co khong duoc nhu the nay thi ra vao voi cho tu tren duoi mot hai ba nhieu it rat qua lam sao gi ai nao khi neu con nen cung deu chi moi da se dang bi boi tai vi nhung cac o a e u i minh em anh chi ban shop nha ad oi day do kia ay nay".split(" "),
);

const tuKhoa = (s: string) =>
  boDau(s).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length >= 3 && !TU_RONG.has(t));

export async function layDanhMuc(): Promise<{ slug: string; tieuDe: string }[]> {
  if (cache && Date.now() - cache.luc < 6 * 3600_000) return cache.ds;
  const r = await fetch(KHO, { cache: "no-store" });
  if (!r.ok) throw new Error(`llms.txt trả ${r.status}`);
  const chu = await r.text();
  const ds: { slug: string; tieuDe: string }[] = [];

  for (const m of chu.matchAll(/\[([^\]]{8,150})\]\((https:\/\/example\.com\/blog\/([a-z0-9-]+)\.html)\)/g)) {
    if (m[3].startsWith("danh-muc-") || m[3] === "index") continue;
    ds.push({ slug: m[3], tieuDe: m[1].trim() });
  }
  cache = { luc: Date.now(), ds };
  return ds;
}

export function laCauHoi(s: string): boolean {
  const c = boDau(s);
  if (/\?/.test(s)) return true;
  return /\b(gi|sao|the nao|bao nhieu|bao lau|may|o dau|khi nao|luc nao|bao gio|lam sao|cach|co .{0,20}(khong|ko)\b|nen |duoc khong|giup .{0,15}voi)\b/.test(c);
}

/**
 * @param nguongDiem số từ khoá phải trùng thì mới coi là hợp. Để 3 sau khi đo trên bình luận THẬT:
 *   ngưỡng 2 ghép "Xin biết ơn Lan" vào bài "hạt sen và TÂM sen" — chỉ trùng một chữ tình cờ.
 *   Sai bài một lần là khách thấy mình cẩu thả, nên thà im còn hơn đoán.
 */
export async function timBaiHop(cauHoi: string, nguongDiem = 3): Promise<BaiGoiY | null> {
  if (!laCauHoi(cauHoi)) return null;
  const tu = new Set(tuKhoa(cauHoi));
  if (tu.size < 2) return null;
  let ds: { slug: string; tieuDe: string }[];
  try { ds = await layDanhMuc(); } catch { return null; }

  let tot: BaiGoiY | null = null;
  for (const b of ds) {
    const tuBai = new Set(tuKhoa(b.tieuDe + " " + b.slug.replace(/-/g, " ")));
    let diem = 0;
    for (const t of tu) if (tuBai.has(t)) diem++;
    if (diem >= nguongDiem && (!tot || diem > tot.diem)) {
      tot = { slug: b.slug, tieuDe: b.tieuDe, url: `https://example.com/blog/${b.slug}.html`, diem };
    }
  }
  return tot;
}
