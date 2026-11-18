import "server-only";
import { giaNhap, maSanPhamTuTen, sanPhamV4, type MaSanPham } from "@/lib/gia-v4";

export const GIA_VON_V4: Record<MaSanPham, { truocVat: number; trangThai: "xac_nhan" | "cho_xac_nhan" }> = {
  "dam": { truocVat: 128_833, trangThai: "xac_nhan" },
  "dam-hu-500": { truocVat: 128_833, trangThai: "xac_nhan" },
  "san-pham-b": { truocVat: 38_000, trangThai: "xac_nhan" },
  "san-pham-c": { truocVat: 31_000, trangThai: "cho_xac_nhan" },
};

export function bienGopPct(ma: MaSanPham, giaKhachThay: number | null): number | null {
  if (giaKhachThay == null || !(giaKhachThay > 0)) return null;
  const v = GIA_VON_V4[ma];
  const net = giaKhachThay / 1.08;
  return Math.round((net - v.truocVat) / net * 100);
}

export function bienGopBacDaiLy(ma: MaSanPham, pct: number): number | null {
  return bienGopPct(ma, giaNhap(sanPhamV4(ma).niemYet, pct));
}

const QUA_MAU: { mau: RegExp; ten: string; truocVat: number }[] = [
  { mau: /binh ?lac|shaker/, ten: "Bình lắc", truocVat: 37_000 },
  { mau: /cam ?nang|ebook|e-book|thuc ?don|khoa ?hoc|khoa ?online|tu ?van|cong ?dong|freeship|free ?ship|mien ?phi ?(giao|van)|vip/, ten: "Quà số / dịch vụ", truocVat: 0 },
];
const VAT = 1.08;
const khongDau = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");

export type DongQua = { ten?: string | null; sl?: number | null };

export function giaVonQua(qua: DongQua[] | string | null | undefined): { tong: number; chiTiet: string[]; khongRo: string[] } {
  const ds: DongQua[] = Array.isArray(qua) ? qua
    : String(qua || "").split(/[+,·;\n]|\bvà\b/i).map((t) => t.trim()).filter(Boolean).map((ten) => {
      const m = /^(\d+)\s*(?:x|hộp|hop|cái|cai)?\s*(.+)$/i.exec(ten);
      return m ? { ten: m[2], sl: Number(m[1]) } : { ten, sl: 1 };
    });
  let tong = 0; const chiTiet: string[] = []; const khongRo: string[] = [];
  for (const q of ds) {
    const ten = String(q.ten || "").trim();
    if (!ten) continue;
    const sl = Math.max(1, Number(q.sl) || 1);
    const t = khongDau(ten);
    const ma = maSanPhamTuTen(ten);
    let truocVat: number | null = null; let nhan = ten;
    if (ma) { truocVat = GIA_VON_V4[ma].truocVat; nhan = sanPhamV4(ma).ten; }
    else { const mau = QUA_MAU.find((m) => m.mau.test(t)); if (mau) { truocVat = mau.truocVat; nhan = mau.ten; } }
    if (truocVat == null) { khongRo.push(ten); continue; }
    const gia = Math.round(truocVat * VAT) * sl;
    tong += gia;
    chiTiet.push(`${nhan}${sl > 1 ? " ×" + sl : ""}`);
  }
  return { tong, chiTiet, khongRo };
}
