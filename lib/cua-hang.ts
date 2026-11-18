import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { findBanned } from "@/lib/banned-words";
import { maSanPhamTuTen, xetGiaDon } from "@/lib/gia-v4";
import { giaVonQua } from "@/lib/gia-v4-von";

export const KHOA_CUA_HANG = "shop_san_pham";

export type SanPhamShop = {
  n: string;
  t: string;
  cat: string;
  price: number;
  img: string;
  certs?: string[];
  badge?: string;
  score?: number;
  desc?: string;
  intro?: string;
  highlights?: { t: string; d: string }[];
  usage?: string;
  storage?: string;
  qua?: string;
  an?: boolean;
  het_hang?: boolean;
  trangThai?: TrangThaiBan;
  ngayVe?: string;
};

export type TrangThaiBan = "sap-ra-mat" | "ngung-ban";
export const TRANG_THAI_BAN: Record<TrangThaiBan, string> = { "sap-ra-mat": "Sắp ra mắt (đặt trước)", "ngung-ban": "Ngừng bán" };

export const NHOM_SP: Record<string, string> = {
  dam: "Đạm", tra: "Trà", dau: "Dầu", giavi: "Gia vị", thucduong: "Thực dưỡng", caphe: "Cà phê", khac: "Khác",
};

export async function docCuaHang(): Promise<SanPhamShop[]> {
  const raw = await getConfigValue(KHOA_CUA_HANG);
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function laHetHang(p: { het_hang?: boolean } | null | undefined): boolean {
  return p?.het_hang === true;
}

export function banCongKhai(ds: SanPhamShop[]) {
  return ds.filter((p) => !p.an && p.n && p.price > 0).map(({ an, ...p }) => ({
    ...p,
    het_hang: laHetHang(p),
  }));
}

function chuCua(p: SanPhamShop): string {
  return [p.n, p.t, p.badge, p.desc, p.intro, p.usage, p.storage, p.qua, ...(p.certs || []),
    ...(p.highlights || []).flatMap((h) => [h.t, h.d])].filter(Boolean).join("\n");
}

export function kiemCuaHang(ds: SanPhamShop[]): string[] {
  const loi: string[] = [];
  const ten = new Set<string>();
  ds.forEach((p, i) => {
    const nhan = `Món ${i + 1} (${p.n || "chưa có tên"})`;
    if (!p.n?.trim()) loi.push(`${nhan}: thiếu tên`);
    if (!Number.isInteger(p.price) || p.price < 1000) loi.push(`${nhan}: giá phải là số nguyên từ 1.000đ`);
    if (!p.img?.trim()) loi.push(`${nhan}: thiếu ảnh`);
    if (!NHOM_SP[p.cat]) loi.push(`${nhan}: nhóm "${p.cat}" không có trong danh mục`);
    if (p.het_hang != null && typeof p.het_hang !== "boolean") loi.push(`${nhan}: hết hàng phải là có hoặc không`);
    if (p.trangThai && !TRANG_THAI_BAN[p.trangThai]) loi.push(`${nhan}: trạng thái bán "${p.trangThai}" không hợp lệ`);
    if (p.trangThai === "sap-ra-mat" && !/^\d{2}\/\d{2}\/\d{4}$/.test(p.ngayVe || "")) loi.push(`${nhan}: sắp ra mắt thì phải ghi ngày dự kiến về hàng dạng dd/mm/yyyy`);
    const k = (p.n || "").trim().toLowerCase();
    if (k && ten.has(k)) loi.push(`${nhan}: trùng tên với món khác (link riêng từng món đi theo tên)`);
    ten.add(k);
    const cam = findBanned(chuCua(p));
    if (cam.length) loi.push(`${nhan}: còn từ cấm (${cam.join(", ")})`);
    if (/giảm\s*\d+\s*%|\d+\s*%\s*(off|giảm)/i.test(p.qua || "")) loi.push(`${nhan}: khuyến mãi phải là TẶNG QUÀ, không ghi giảm %`);

    const san = xetGiaDon({ ma: maSanPhamTuTen(p.n), donGia: Number.isFinite(p.price) ? p.price : null, sl: 1, quaGiaVon: giaVonQua(p.qua || "").tong });
    if (san.muc === "chan") loi.push(`${nhan}: ${san.lyDo} — giá công khai không được dưới sàn (chính sách giá v4)`);
  });
  return loi;
}

export function chuanHetHang(ds: SanPhamShop[]): SanPhamShop[] {
  return ds.map((p) => {
    if (laHetHang(p)) return { ...p, het_hang: true };
    if (!("het_hang" in p)) return p;
    const { het_hang: _bo, ...con } = p;
    return con;
  });
}

export async function ghiCuaHang(ds: SanPhamShop[]): Promise<{ ok: boolean; loi: string[] }> {
  const sach = chuanHetHang(ds);
  const loi = kiemCuaHang(sach);
  if (loi.length) return { ok: false, loi };
  await setConfigValue(KHOA_CUA_HANG, JSON.stringify(sach), "Sản phẩm example.com/shop — sửa ở /admin/cua-hang");
  return { ok: true, loi: [] };
}

export const GIA_GOI_QUIZ: Record<string, number> = {
  "Thực đơn 21 ngày cá nhân hoá": 249000,
  "Thực đơn + Tư vấn 1-1 (30 phút)": 790000,
  "Trọn gói: Thực đơn + Tư vấn + Combo sản phẩm": 1290000,
};

export async function giaMayChu(o: { source: string; product: string; pkg: string; qty: number }): Promise<{ amount: number | null; cach: string; qua?: string; hetHang?: boolean; trangThai?: TrangThaiBan; ngayVe?: string }> {
  if (o.source === "shop") {
    let ds: SanPhamShop[] = [];
    try { ds = await docCuaHang(); } catch (e: any) { return { amount: null, cach: "đọc bảng giá lỗi: " + (e?.message || e) }; }
    if (!ds.length) return { amount: null, cach: "bảng giá /admin/cua-hang trống" };
    const k = o.product.trim().toLowerCase();
    const sp = ds.find((p) => !p.an && p.n.trim().toLowerCase() === k);
    if (!sp) return { amount: null, cach: `"${o.product}" không có (hoặc đang ẩn) trong bảng giá` };

    return { amount: sp.price * o.qty, cach: `${sp.price.toLocaleString("vi-VN")}đ × ${o.qty}`, qua: sp.qua || "", hetHang: laHetHang(sp), trangThai: sp.trangThai, ngayVe: sp.ngayVe };
  }
  const g = GIA_GOI_QUIZ[o.pkg.trim()];
  if (g) return { amount: g, cach: `gói quiz ${g.toLocaleString("vi-VN")}đ` };
  return { amount: null, cach: `gói "${o.pkg || "?"}" không có trong bảng giá quiz` };
}
