export type DeptMetric = { key: string; label: string; money?: boolean; hint?: string };

export const SALE_DEPT = "Kinh Doanh & Sale";

export const DEPT_TEMPLATES: Record<string, DeptMetric[]> = {
  "Marketing": [
    { key: "posts_fb", label: "Bài đăng Facebook" },
    { key: "posts_tiktok", label: "Bài đăng TikTok" },
    { key: "posts_youtube", label: "Bài đăng YouTube" },
    { key: "posts_website", label: "Bài đăng Website" },
    { key: "reach", label: "Lượt tiếp cận (reach)" },
    { key: "leads", label: "Lead / tin nhắn về" },
    { key: "assets", label: "Video/ảnh sản xuất" },
    { key: "ad_spend", label: "Ngân sách ads tiêu", money: true },
  ],
  "Tài Chính": [
    { key: "vouchers", label: "Phiếu thu/chi xử lý" },
    { key: "invoices", label: "Hóa đơn xuất" },
    { key: "debt_collected", label: "Công nợ thu được", money: true },
    { key: "reconciled", label: "Đơn/CT đối chiếu" },
  ],
  "Kho & Hỗ Trợ": [
    { key: "packed", label: "Đơn đóng/xuất giao" },
    { key: "inbound", label: "Phiếu nhập kho" },
    { key: "returns", label: "Đơn hoàn/đổi xử lý" },
    { key: "stock_diff", label: "SKU sai lệch tồn" },
  ],
  "Ban Điều Hành": [
    { key: "meetings", label: "Cuộc họp/làm việc" },
    { key: "decisions", label: "Quyết định/đầu việc chốt" },
  ],
  "Chăm Sóc Khách Hàng": [
    { key: "messages", label: "Tin nhắn xử lý" },
    { key: "calls", label: "Cuộc gọi CSKH" },
    { key: "complaints", label: "Khiếu nại xử lý" },
    { key: "rebuy", label: "Đơn tái mua/upsell" },
    { key: "satisfaction", label: "Đánh giá hài lòng (1-5)" },
  ],
  "Pháp Lý": [
    { key: "contracts", label: "Hợp đồng rà soát" },
    { key: "documents", label: "Văn bản pháp lý" },
    { key: "risks", label: "Rủi ro phát hiện" },
    { key: "cases", label: "Vụ việc/tranh chấp xử lý" },
  ],
};

export function metricsForDept(dept: string | null | undefined): DeptMetric[] {
  return (dept && DEPT_TEMPLATES[dept]) || [];
}
