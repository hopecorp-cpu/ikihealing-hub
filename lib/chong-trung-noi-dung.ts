const TU_VO = new Set([
  "va", "la", "cua", "cho", "theo", "duoi", "goc", "nhin", "ve", "den", "khi", "trong",
  "mot", "nhung", "de", "tu", "o", "cung", "hay", "hon", "nen", "thoi", "quen", "cach",
  "bai", "viet", "gioi", "thieu", "suc", "khoe", "giai", "phap", "y", "nghia", "duong", "sinh",
]);

function boDau(s: string): string {
  return s
    .replace(/[đĐ]/g, "d")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function chuanHoaTieuDe(s: string): string {
  return boDau(s).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function tokenChuDe(s: string): Set<string> {
  const ra = new Set<string>();
  for (const t of chuanHoaTieuDe(s).split(" ")) if (t && !TU_VO.has(t)) ra.add(t);
  return ra;
}

export function laTrungChuDe(a: string, b: string): boolean {
  const na = chuanHoaTieuDe(a);
  const nb = chuanHoaTieuDe(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const A = tokenChuDe(a);
  const B = tokenChuDe(b);
  if (!A.size || !B.size) return false;
  let chung = 0;
  for (const t of A) if (B.has(t)) chung++;
  return chung >= 2 && chung / Math.min(A.size, B.size) >= 0.4;
}

export function trungVoiAi(tieuDe: string, ganDay: string[]): string | null {
  for (const t of ganDay) if (laTrungChuDe(tieuDe, t)) return t;
  return null;
}
