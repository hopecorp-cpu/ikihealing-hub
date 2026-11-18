import { extraEN } from "./i18n/index";
import { JA_ALL } from "./i18n/ja/index";

export type Locale = "vi" | "en" | "ja";
export const LOCALE_COOKIE = "acme_lang";
export const LOCALES: Locale[] = ["vi", "en", "ja"];

export const LOCALE_NHAN: Record<Locale, string> = { vi: "VI", en: "EN", ja: "JA" };

const CORE_EN: Record<string, string> = {

  "Việc hàng ngày": "Daily Work",
  "Công việc Sale": "Sales Work",
  "Công việc MKT": "Marketing Work",
  "Lương & Nghỉ": "Pay & Leave",
  "Học & Script": "Learning & Scripts",
  "Empire ACME": "ACME Empire",
  "Team Sale": "Sales Team",
  "Team MKT": "Marketing Team",
  "BI & Vận hành chung": "BI & Operations",
  "Quản trị Nhân sự": "HR Admin",
  "Quản trị Lương": "Payroll Admin",
  "Tích hợp & Bank": "Integrations & Bank",
  "Bảo mật": "Security",
  "Kế toán & Tài chính": "Accounting & Finance",
  "KHU VỰC ADMIN": "ADMIN AREA",
  "cần duyệt": "pending",
  "Tìm trang…": "Search pages…",
  "NHÂN VIÊN": "STAFF",

  "Tổng quan": "Overview",
  "Chấm công Face ID": "Face ID Attendance",
  "Task & Giao việc": "Tasks & Assignments",
  "Báo cáo cuối ngày": "End-of-day Report",
  "KPI cá nhân": "My KPI",
  "Khách của tôi": "My Customers",
  "Phiếu lương": "Payslip",
  "Xin nghỉ phép": "Leave Request",
  "Lộ trình 30 ngày": "30-Day Roadmap",
  "Knowledge Base": "Knowledge Base",
  "Sales Playbook": "Sales Playbook",
  "10 Tuyên Bố": "10 Declarations",
  "Empire Commitment": "Empire Commitment",
  "Empire Audit": "Empire Audit",
  "Bán hàng": "Sales",
  "Trợ lý Sale (AI)": "Sales Assistant (AI)",
  "Kịch bản Telesales": "Telesales Scripts",
  "Phân rã KPI doanh thu": "Revenue KPI Breakdown",
  "Báo cáo Sale theo ngày": "Daily Sales Report",
  "AI chấm tư vấn sale": "AI Consultation Scoring",
  "AI chấm tư vấn của tôi": "My AI Consultation Score",
  "Chăm sóc khách": "Customer Care",
  "Danh bạ khách (Zalo)": "Customer Directory (Zalo)",
  "Khách chờ trả lời (Zalo)": "Customers Awaiting Reply (Zalo)",
  "Cẩm nang Seeding": "Seeding Playbook",
  "Kịch bản theo nhóm khách": "Scripts by Segment",
  "Mục tiêu doanh thu": "Revenue Target",
  "Báo cáo đăng bài": "Posting Report",
  "Phễu & Chiến dịch": "Funnel & Campaigns",
  "Content MKT": "Marketing Content",
  "Đo lường đa kênh": "Multi-channel Analytics",
  "Prompter Studio": "Prompter Studio",
  "Content Empire": "Content Empire",
  "Bản tin sáng": "Morning Brief",
  "Dashboard BI": "BI Dashboard",
  "Đánh giá cá nhân": "Individual Review",
  "Hồ sơ khách 360": "Customer 360",
  "Học viên": "Students",
  "Tuyển dụng": "Recruitment",
  "Dự án": "Projects",
  "DT theo mặt hàng": "Revenue by Product",
  "Quản lý Kho": "Inventory",
  "Đối soát J&T": "J&T Reconciliation",
  "Product Forge": "Product Forge",
  "Chỉ số khách hàng": "Customer Metrics",
  "Cơ cấu DT (thị phần SP)": "Revenue Mix (Product Share)",
  "Nhân sự": "Staff",
  "Phòng ban": "Departments",
  "Chu kỳ KPI": "KPI Cycles",
  "Hồ sơ & Hợp đồng": "Records & Contracts",
  "Sửa/duyệt chấm công": "Edit/Approve Attendance",
  "Duyệt nghỉ phép": "Approve Leave",
  "Duyệt báo cáo": "Approve Reports",
  "Bảng lương": "Payroll",
  "Thưởng Livestream": "Livestream Bonus",
  "Import lương Excel": "Import Payroll (Excel)",
  "Cấu hình bậc thưởng": "Bonus Tier Config",
  "Import đơn CSV": "Import Orders (CSV)",
  "Sync MISA eShop": "Sync MISA eShop",
  "Kế toán + Bank": "Accounting + Bank",
  "Nợ vay & Lãi suất": "Loans & Interest",
  "Sản phẩm + Giá vốn": "Products + COGS",
  "Chi phí & Lợi nhuận": "Costs & Profit",
  "Doanh thu (nhập tay)": "Revenue (manual)",
  "Khách dùng sản phẩm": "Customers by Product",
  "Bảng điều hành": "Executive Dashboard",
  "Bảng điều hành": "Executive Dashboard",
  "Bảng tổng BGĐ": "Board Summary",
  "Sức khoẻ Startup": "Startup Health",
  "Dự báo doanh thu": "Revenue Forecast",
  "Kho tài khoản": "Account Vault",

  "Đổi mật khẩu": "Change password",
  "Đăng xuất": "Log out",

  "tỷ": "B",
  "tr": "M",
  "tháng": "mo",
  "người": "people",
  "khách": "customers",
  "đơn": "orders",

  "Bảng điều hành ACME": "ACME Executive Dashboard",
  "Chỉ số điều hành công ty — doanh thu · lợi nhuận · hiệu quả tài chính · sức khoẻ startup · kênh & phễu. (Chỉ số dành cho công ty tư nhân, không phải cổ phiếu.)":
    "Company operating metrics — revenue · profit · financial efficiency · startup health · channels & funnel. (Private-company metrics, not stock figures.)",
  "Tổng quan + KQKD": "Overview + P&L",
  "Hiệu quả tài chính": "Financial Efficiency",
  "Sức khoẻ & Dự báo": "Health & Forecast",
  "Kênh / Phễu / SP": "Channels / Funnel / Products",
  "DT luỹ kế 2026": "YTD Revenue 2026",
  "mục tiêu": "target",
  "Tiền mặt hiện tại": "Cash on hand",
  "Dòng tiền TB/tháng (3T)": "Avg cash flow/mo (3M)",
  "Runway": "Runway",
  "Dương ": "Positive ",
  "Doanh thu theo tháng 2026": "Monthly revenue 2026",
  "Doanh thu": "Revenue",
  "Kết quả kinh doanh (Doanh thu · Chi phí · Lợi nhuận) — T3→T5": "P&L (Revenue · Cost · Profit) — M3→M5",
  "Chi phí": "Cost",
  "Lợi nhuận": "Profit",
  "Biên LN %": "Margin %",
  "Dòng tiền ngân hàng ròng theo tháng": "Net bank cash flow by month",
  "Dòng tiền ròng": "Net cash flow",
  "Biên LN ròng (ROS)": "Net margin (ROS)",
  "cần số cân đối": "needs balance sheet",
  "ROS × vòng quay × đòn bẩy = ROE": "ROS × asset turnover × leverage = ROE",
  "Xu hướng ROS / ROA / ROE (%)": "ROS / ROA / ROE trend (%)",
  "Lợi nhuận theo tháng": "Profit by month",
  "Chưa có số cân đối kế toán (tài sản/vốn) để tính ROA/ROE — nhập ở /tai-chinh để hiện đầy đủ.":
    "No balance-sheet data (assets/equity) to compute ROA/ROE — enter it in /tai-chinh to show fully.",
  "Tỉ lệ mua lại": "Repeat rate",
  "% DT khách cũ": "% revenue from returning",
  "AOV": "AOV",
  "LTV / CAC": "LTV / CAC",
  "lành mạnh ≥ 3x": "healthy ≥ 3x",
  "Dự báo doanh thu cuối năm vs mục tiêu": "Year-end revenue forecast vs target",
  "Mục tiêu": "Target",
  "Dự báo": "Forecast",
  "LTV/CAC ≥ 3 = tăng trưởng có lãi. Thực phẩm bổ sung sống bằng mua lại — tỉ lệ mua lại thấp = đang đổ khách vào \"xô thủng\".":
    "LTV/CAC ≥ 3 = profitable growth. Supplements live on repeat purchase — a low repeat rate means pouring customers into a leaky bucket.",
  "Doanh thu theo kênh": "Revenue by channel",
  "Top 6 sản phẩm theo doanh thu": "Top 6 products by revenue",
  "Phễu chuyển đổi (ước tính)": "Conversion funnel (estimated)",
  "Đã tư vấn (chat)": "Consulted (chat)",
  "Khách đã mua": "Customers purchased",
  "Tỉ lệ chốt": "Close rate",
  "Tư vấn = số hội thoại chat đã chấm; khách mua = khách có đơn MISA. Phễu chi tiết theo kênh/chiến dịch ở /pheu-chien-dich.":
    "Consulted = scored chat conversations; purchased = customers with a MISA order. Detailed funnel by channel/campaign in /pheu-chien-dich.",

  "Tài chính · Ban điều hành & Kế toán": "Finance · Executives & Accounting",
  "Kỳ:": "Period:",
  "cập nhật": "updated",
  "Cảnh báo: lỗ": "Warning: loss",
  "tháng liên tiếp": "consecutive months",
  "Doanh thu theo sản phẩm": "Revenue by product",
  "Lưu ý: sổ": "Note: the",
  "là lũy kế (gồm cả giao dịch từ trước), đã bao gồm trả nợ vay, lương — không khớp 1-1 với \"chi phí khác\" trên P&L.":
    "ledger is cumulative (includes prior transactions: loan repayments, salaries) — it does not match 1-to-1 with \"other costs\" on the P&L.",
  "lỗ": "loss",
  "(biên": "(margin",
  "Cấu trúc chi phí đang vượt doanh thu — xem nhận xét & hành động bên dưới.":
    "Cost structure exceeds revenue — see notes & actions below.",
  "LỖ": "LOSS",
  "LÃI": "PROFIT",
  "Tổng chi phí": "Total cost",
  "Biên LN ròng": "Net margin",
  "Tỷ lệ giá vốn": "COGS ratio",
  "Xu hướng Doanh thu · Chi phí · Lợi nhuận": "Trend: Revenue · Cost · Profit",
  "Đơn vị: triệu VNĐ": "Unit: million VND",
  "Cơ cấu chi phí theo tháng": "Cost structure by month",
  "6 nhóm chi phí · triệu VNĐ": "6 cost groups · million VND",
  "Giá vốn": "COGS",
  "Lương": "Salary",
  "Chi phí khác": "Other costs",
  "Thuê kho/nhà": "Warehouse/rent",
  "Lãi vay": "Interest",
  "Bảo hiểm": "Insurance",
  "So sánh chi tiết khoản mục": "Line-item comparison",
  "Chênh lệch": "Change",
  "Khoản mục": "Line item",
  "% đổi": "% change",
  "TỔNG CHI PHÍ": "TOTAL COST",
  "LỢI NHUẬN": "PROFIT",
  "Đơn vị cột tháng: triệu VNĐ. Với nhóm chi phí, tăng = xấu (đỏ); với LN, tăng = tốt (xanh).":
    "Month columns in million VND. For costs, an increase is bad (red); for profit, an increase is good (green).",
  "Nhận xét & Hành động đề xuất": "Notes & Recommended actions",
  "mặt hàng · sắp theo doanh thu": "items · sorted by revenue",
  "Sản phẩm": "Product",
  "SL": "Qty",
  "DT (trước thuế)": "Revenue (pre-tax)",
  "LN gộp": "Gross profit",
  "% LN": "% margin",
  "DT & LN gộp đơn vị triệu VNĐ. % LN âm = bán dưới giá vốn (cần xem lại giá).":
    "Revenue & gross profit in million VND. Negative margin = sold below cost (review pricing).",
  "Sổ chi tiết các khoản chi": "Expense ledger",
  "Tra cứu từng giao dịch": "Look up each transaction",
  "Tìm nội dung / người nhận…": "Search content / recipient…",
  "giao dịch · tổng": "transactions · total",
  "Ngày": "Date",
  "Nội dung": "Content",
  "Người nhận": "Recipient",
  "Số tiền": "Amount",
  "Nguồn: BÁO CÁO CHI PHÍ LỢI NHUẬN ACME.xlsx · Cập nhật tháng mới: thay file Excel rồi chạy lại import.":
    "Source: ACME P&L REPORT.xlsx · To update a new month: replace the Excel file and re-run the import.",

  "Tổng tài sản": "Total assets",
  "Vốn chủ sở hữu": "Equity",
  "Tồn kho": "Inventory",
  "Phải thu": "Receivables",
  "Phải trả": "Payables",
  "Tiền & tương đương": "Cash & equivalents",
  "Nợ vay": "Debt",
  "Chỉ số quản trị tài chính (ROE · ROA · DuPont)": "Financial management ratios (ROE · ROA · DuPont)",
  "triệu đồng": "million VND",
  "Phân tích DuPont —": "DuPont analysis —",
  "Biên LN": "Net margin",
  "Vòng quay TS": "Asset turnover",
  "Đòn bẩy": "Leverage",
  "Vòng quay tồn kho": "Inventory turnover",
  "Hệ số nợ": "Debt ratio",
  "Năm hoá (×12):": "Annualized (×12):",
  "(ước tính nếu duy trì nhịp tháng này cả năm)": "(estimate if this month's pace holds all year)",
  "Tháng": "Month",
  "DT (tr)": "Rev (M)",
  "LNST (tr)": "Net profit (M)",
  "cần nhập": "needs input",
  "Xu hướng ROS · ROA · ROE (%)": "ROS · ROA · ROE trend (%)",
  "Nhập số cân đối kế toán": "Enter balance-sheet figures",
  "đơn vị: triệu đồng": "unit: million VND",
  "Đang lưu…": "Saving…",
  "Lưu": "Save",
  "Đã lưu. Tải lại trang để cập nhật chỉ số.": "Saved. Reload the page to refresh the ratios.",
  "Kết hợp P&L + số cân đối kế toán nhập tay. Đơn vị nhập:": "Combines P&L + manually entered balance sheet. Input unit:",

  "Dự báo doanh thu 2026 — kịch bản": "Revenue Forecast 2026 — scenarios",
  "Đã đạt (YTD)": "Achieved (YTD)",
  "Nhịp TB/tháng": "Avg pace/mo",
  "Dự báo cuối năm (cơ sở)": "Year-end forecast (base)",
  "Cần bán/tháng để đạt MT": "Needed/mo to hit target",
  "Thực tế & 3 kịch bản (triệu đ/tháng)": "Actual & 3 scenarios (M VND/mo)",
  "Thực tế": "Actual",
  "Cơ sở": "Base",
  "Tích cực": "Optimistic",
  "Bi quan": "Pessimistic",
  "Kịch bản": "Scenario",
  "Nhịp/tháng còn lại": "Pace/mo remaining",
  "Dự báo cuối năm": "Year-end forecast",
  "% mục tiêu": "% of target",
  "Bi quan (−10%)": "Pessimistic (−10%)",
  "Cơ sở (giữ nhịp)": "Base (hold pace)",
  "Tích cực (ramp +50% Tết)": "Optimistic (+50% Tet ramp)",
  "Tích cực (+50% Tết)": "Optimistic (+50% Tet)",
  "Mục tiêu năm:": "Annual target:",
  "Dựa trên thực tế YTD": "Based on YTD actuals",
  "+ nhịp hiện tại.": "+ current pace.",
  "còn": "remaining",
  "Kịch bản cuối năm vs mục tiêu": "Year-end scenarios vs target",
  "Mục tiêu 9 tỷ cần nhịp": "The 9B target needs a pace of",
  "/tháng —": "/mo —",
  "cao hơn": "higher than",
  "× nhịp hiện tại → cần đẩy mạnh kênh/khuyến mãi/tái mua.": "× current pace → push channels/promotions/repeat purchase.",
  "trong tầm với nếu giữ nhịp.": "within reach if the pace holds.",

  "Bảng tổng Ban Giám đốc": "Board of Directors Summary",
  "Chỉ số chính các phòng — cập nhật": "Key metrics by department — updated",
  "Đã qua": "Elapsed",
  "% tháng": "% of month",
  "DT": "Rev",
  "CP": "Cost",
  "biên": "margin",
  "9 kênh · 240K+ follower": "9 channels · 240K+ followers",
  "Xem": "View",
  "Cảnh báo cần chú ý": "Alerts to note",
  "Kinh doanh (Sale)": "Sales",
  "Doanh số tháng": "Monthly revenue",
  "Mục tiêu tháng:": "Monthly target:",
  "nhịp": "pace",
  "Tài chính (P&L)": "Finance (P&L)",
  "Chưa có dữ liệu P&L.": "No P&L data yet.",
  "Nhân sự": "Staff",
  "Nhân sự đang làm": "Active staff",
  "Quỹ lương": "Payroll",
  "Marketing (đa kênh)": "Marketing (multi-channel)",
  "Đo lường fanpage": "Fanpage analytics",
  "FB/YouTube/TikTok tự sync hằng ngày. Bấm để xem chi tiết →": "FB/YouTube/TikTok auto-sync daily. Click for details →",
  "Phân tích & Khuyến nghị (AI) — tháng": "AI Analysis & Recommendations — month",
  "Lỗi": "Error",
  "Đang phân tích…": "Analyzing…",
  "Cập nhật": "Refresh",
  "Tạo phân tích": "Generate analysis",
  "Chưa có phân tích. Bấm \"Tạo phân tích\" để AI đánh giá thực tế vs mục tiêu + khuyến nghị việc cần làm để đạt doanh số.":
    "No analysis yet. Click \"Generate analysis\" for AI to compare actual vs target and recommend actions to hit revenue.",
  "Số liệu Sale từ MISA (live), Tài chính từ P&L (cập nhật theo tháng), Nhân sự từ hệ thống. MKT ở dashboard riêng. Bấm từng thẻ để xem chi tiết.":
    "Sales from MISA (live), Finance from P&L (monthly), Staff from the system. Marketing on a separate dashboard. Click each card for details.",
};

export const EN: Record<string, string> = Object.assign({}, CORE_EN, extraEN);
export const JA: Record<string, string> = JA_ALL;

export function mlabel(locale: Locale, label: string): string {
  if (!label || locale === "vi") return label;
  if (locale === "en") return label.replace(/Tháng\s*/g, "M");
  return label
    .replace(/Tháng\s*(\d{1,2})\s*\/\s*(\d{4})/g, "$2年$1月")
    .replace(/Tháng\s*(\d{1,2})/g, "$1月");
}

export type TDich = {
  (vi: string): string;
  (vi: string | null | undefined): string | undefined;
};

export function tr(locale: Locale, vi: string): string;
export function tr(locale: Locale, vi: string | null | undefined): string | undefined;

export function tr(locale: Locale, vi: string | null | undefined): string | undefined {
  if (vi === null || vi === undefined) return undefined;
  if (locale === "en") return EN[vi] ?? vi;
  if (locale === "ja") return JA[vi] ?? EN[vi] ?? vi;
  return vi;
}

export function dichSo(t: TDich, vi: string): string {
  const nguyen = t(vi);
  if (nguyen !== vi) return nguyen;
  const so = vi.match(/\d+(?:[.,]\d+)*/g);
  if (!so) return vi;
  const khoa = vi.replace(/\d+(?:[.,]\d+)*/g, "{n}");
  const mau = t(khoa);
  if (mau === khoa) return vi;
  let i = 0;
  return mau.replace(/\{n\}/g, () => so[i++] ?? "");
}

export function fmtMoneyL(locale: Locale, n: number): string {
  n = n || 0;
  if (locale === "en" || locale === "ja") {
    const a = Math.abs(n), s = n < 0 ? "−" : "";
    if (a >= 1e9) return s + (a / 1e9).toFixed(2) + "B ₫";
    if (a >= 1e6) return s + Math.round(a / 1e6) + "M ₫";
    return s + Math.round(a / 1e3) + "K ₫";
  }
  if (n >= 1e9) return (n / 1e9).toFixed(2) + " tỷ";
  if (n >= 1e6) return Math.round(n / 1e6) + "tr";
  return Math.round(n / 1e3) + "k";
}
