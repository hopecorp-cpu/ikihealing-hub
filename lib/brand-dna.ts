import { GIA_V4_HIEU_LUC_TU, sanPhamV4, type MaSanPham } from "@/lib/gia-v4";

export const BRAND_KHAU_HIEU = "Khẩu hiệu mẫu của thương hiệu.";
export const BRAND_THONG_DIEP = "Thông điệp chính mẫu: một câu nói rõ thương hiệu giúp khách điều gì.";
export const BRAND_THONG_DIEP_Q4 = "Thông điệp theo mùa mẫu.";
export const BRAND_BAN_HANG_CAU_BAT_BUOC = "câu bắt buộc khi nói về chính sách bán hàng";

export const KHUYEN_CAO = {
  dam: "Khuyến cáo bắt buộc in kèm sản phẩm A (số công bố, đơn vị chịu trách nhiệm, đối tượng dùng).",
  sanPhamB: "Khuyến cáo bắt buộc in kèm sản phẩm B.",
  sanPhamC: "Khuyến cáo bắt buộc in kèm sản phẩm C.",
  canhBaoSanPhamB: "Thông tin cảnh báo sản phẩm B.",
  canhBaoSanPhamC: "Thông tin cảnh báo sản phẩm C.",
  hocVien: "Khuyến cáo cho nội dung đào tạo.",
  appAi: "Khuyến cáo cho trợ lý AI.",
};

export const BRAND_CORE = `ACME Corp / NOVA — TA LÀ AI (mẫu):
Tên hiển thị: NOVA (thuộc ACME Corp).
Ngành hàng: điền ngành hàng của bạn.
Khách hàng chính: mô tả chân dung khách.
Điều khác biệt: 2-3 lý do khách chọn bạn thay vì đối thủ.`;

export const BRAND_ECOSYSTEM = `HỆ SINH THÁI NOVA (mẫu):
- Sản phẩm: liệt kê các dòng sản phẩm.
- Kênh bán: website, sàn thương mại điện tử, đại lý, đội sale.
- Nội dung: blog, fanpage, video ngắn.`;

export const BRAND_NAMING = `TÊN GỌI CHUẨN (mẫu):
- Viết đúng tên thương hiệu và tên từng sản phẩm, không tự rút gọn.`;

export const BRAND_LEGAL = `LUẬT PHÁP LÝ (mẫu):
- Liệt kê các từ và cách nói bị cấm với ngành hàng của bạn.
- Không hứa hẹn kết quả, không so sánh hạ thấp đối thủ.
- Khuyến mãi phải đúng chính sách đã duyệt.`;

export const BRAND_VOICE = `GIỌNG THƯƠNG HIỆU (mẫu):
- Xưng hô, độ dài câu, những từ nên dùng và nên tránh.`;

export const BRAND_NOI_DUNG = `THÔNG ĐIỆP VÀ NỘI DUNG (mẫu):
- Các trụ cột nội dung và tỉ lệ giữa chúng.`;


export async function approvedOffersContext(): Promise<string> {
  try {
    const { getConfigValue } = await import("@/lib/app-config");
    const raw = await getConfigValue("offer_architecture");
    if (!raw) return "";
    const d = typeof raw === "string" ? JSON.parse(raw) : raw;
    const offers: any[] = Array.isArray(d?.offers) ? d.offers : [];
    if (!offers.length) return "";
    const fmt = (o: any) => {
      const gia = Number(o?.gia_niem_yet || 0);
      return `- ${o?.ten || o?.code}${gia ? ` — ${gia.toLocaleString("vi-VN")}đ` : ""}`;
    };
    const chot = offers.filter((o) => o?.status === "chot");
    const nhap = offers.filter((o) => o?.status !== "chot");
    const L = [`DANH SÁCH CHÀO BÁN ĐÃ DUYỆT (bản sống, có thẩm quyền hơn bảng giá tĩnh):`];
    if (chot.length) L.push(...chot.map(fmt));
    if (nhap.length) {
      L.push(`\nCÒN LÀ NHÁP — TUYỆT ĐỐI KHÔNG ĐƯỢC ĐƯA VÀO NỘI DUNG BÁN HÀNG:`);
      L.push(...nhap.map((o) => `- ${o?.ten || o?.code} (draft)`));
    }
    return L.join("\n");
  } catch {
    return "";
  }
}

const giaV4 = (ma: MaSanPham): string => {
  const sp = sanPhamV4(ma);
  return sp.niemYet == null ? "CHƯA CHỐT — không báo giá cho khách" : sp.niemYet.toLocaleString("vi-VN") + "đ";
};

export const BRAND_PRICES = `GIÁ NIÊM YẾT THAM KHẢO (nguồn lib/gia-v4.ts, hiệu lực ${GIA_V4_HIEU_LUC_TU}). TUYỆT ĐỐI không tự đặt giá mới hay tự tạo combo.
- Sản phẩm A ${sanPhamV4("dam").quyCach}: ${giaV4("dam")}
- Sản phẩm B: ${giaV4("san-pham-b")}
- Sản phẩm C: ${giaV4("san-pham-c")}
Cần giá sản phẩm khác thì tra bảng giá đã duyệt, KHÔNG suy đoán.`;


export const BRAND_DNA_FULL = [
  BRAND_CORE,
  BRAND_ECOSYSTEM,
  BRAND_NAMING,
  BRAND_LEGAL,
  BRAND_VOICE,
  BRAND_NOI_DUNG,
  BRAND_PRICES,
].join("\n\n");

export const BRAND_DNA_SHORT = [BRAND_CORE, BRAND_NAMING, BRAND_LEGAL].join("\n\n");

export function brandDna(size: "full" | "short" = "full"): string {
  return size === "short" ? BRAND_DNA_SHORT : BRAND_DNA_FULL;
}
