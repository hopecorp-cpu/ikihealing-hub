const thuong = (s: string) => String(s || "").normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "d").toLowerCase();

const DON_VI: Record<string, number> = { k: 1e3, nghin: 1e3, ngan: 1e3, tr: 1e6, trieu: 1e6, d: 1, dong: 1, vnd: 1 };

export function soTien(s: string): number[] {
  const t = thuong(s);
  const out: number[] = [];

  for (const m of t.matchAll(/(\d+)\s*tr\s*(\d)(?![\d.,])/g)) out.push(Number(m[1]) * 1e6 + Number(m[2]) * 1e5);
  const boQua = t.replace(/(\d+)\s*tr\s*(\d)(?![\d.,])/g, " ");
  for (const m of boQua.matchAll(/(\d[\d.,]*)\s*(trieu|tr|nghin|ngan|k|vnd|dong|d)(?![a-z])/g)) {
    const raw = m[1].replace(/[.,]$/, "");
    const dv = DON_VI[m[2]];
    let n: number;
    if (dv === 1) n = Number(raw.replace(/[.,]/g, ""));
    else n = Number(raw.replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".")) * dv;
    if (Number.isFinite(n) && n > 0) out.push(Math.round(n));
  }

  for (const m of boQua.matchAll(/(?<![\d.,])\d{1,3}(?:\.\d{3}){2,}(?![\d.,])/g)) out.push(Number(m[0].replace(/\./g, "")));
  return out;
}

export function soPhanTram(s: string): number[] {
  const t = thuong(s);
  return [...t.matchAll(/(\d+(?:[.,]\d+)?)\s*(%|phan tram)/g)].map((m) => Number(m[1].replace(",", ".")));
}

const tenMien = (u: string) => u.replace(/^https?:\/\//i, "").split(/[/?#\s]/)[0].replace(/^www\./i, "").toLowerCase();
const goc = (h: string) => h.split(".").slice(-2).join(".");

export function cacLink(s: string): string[] {
  const co = String(s || "").match(/\b(?:https?:\/\/)?(?:[a-z0-9-]+\.)+(?:com|vn|me|net|org|io|app|link|ly|co)(?:\/[^\s)]*)?/gi) || [];
  return co.map((x) => x.replace(/[.,;:!?]+$/, ""));
}

export type KetQuaChot = { ok: boolean; loi: string[] };

export function chotKiemTraLoi(traLoi: string, duLieu: string, cauTruoc: string[] = []): KetQuaChot {
  const loi: string[] = [];
  const tien = new Set(soTien(duLieu));
  for (const n of soTien(traLoi)) if (!tien.has(n)) loi.push(`Số tiền ${n.toLocaleString("vi-VN")}đ không có trong dữ liệu đã nạp`);
  const pt = new Set(soPhanTram(duLieu));
  for (const n of soPhanTram(traLoi)) if (!pt.has(n)) loi.push(`Số ${n}% không có trong dữ liệu đã nạp`);
  const mien = new Set(cacLink(duLieu).map((u) => goc(tenMien(u))));
  for (const u of cacLink(traLoi)) if (!mien.has(goc(tenMien(u)))) loi.push(`Link ngoài dữ liệu đã nạp: ${u}`);
  const chuan = (x: string) => x.replace(/\s+/g, " ").trim();
  const c = chuan(traLoi);
  if (c && cauTruoc.some((x) => chuan(x) === c)) loi.push("Lặp nguyên văn câu vừa gửi");
  return { ok: loi.length === 0, loi: [...new Set(loi)] };
}
