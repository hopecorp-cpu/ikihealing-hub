export type PhongMacDinh = { name: string; ma: string; color: string };

export const PHONG_MAC_DINH: PhongMacDinh[] = [
  { name: "Ban Điều Hành",       ma: "BDH",  color: "#DC2626" },
  { name: "Kinh Doanh & Sale",   ma: "KD",   color: "#10B981" },
  { name: "Marketing",           ma: "MKT",  color: "#8B5CF6" },
  { name: "Chăm Sóc Khách Hàng", ma: "CSKH", color: "#F59E0B" },
  { name: "Kho & Hỗ Trợ",        ma: "KHO",  color: "#6B7280" },
  { name: "Tài Chính",           ma: "TC",   color: "#EC4899" },
  { name: "Pháp Lý",             ma: "PL",   color: "#3B82F6" },
];

export function chuanHoaTen(ten: string): string {
  return ten
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/&/g, " va ")
    .replace(/\s+/g, " ")
    .trim();
}

export function chonPhongCanTao(
  daCo: { name: string | null; ma?: string | null }[],
  macDinh: PhongMacDinh[] = PHONG_MAC_DINH,
): PhongMacDinh[] {
  const maDaCo = new Set(daCo.map((d) => (d.ma || "").trim().toUpperCase()).filter(Boolean));
  const tenDaCo = new Set(daCo.map((d) => chuanHoaTen(d.name || "")).filter(Boolean));
  const ketQua: PhongMacDinh[] = [];
  for (const p of macDinh) {
    const ten = chuanHoaTen(p.name);
    if (maDaCo.has(p.ma.toUpperCase()) || tenDaCo.has(ten)) continue;
    maDaCo.add(p.ma.toUpperCase());
    tenDaCo.add(ten);
    ketQua.push(p);
  }
  return ketQua;
}

export function laLoiThieuCot(err: { code?: string } | null | undefined): boolean {
  return !!err && (err.code === "42703" || err.code === "PGRST204");
}
