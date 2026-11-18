export type LegalStatus = "valid" | "pending" | "expired" | "na";

export type LegalItem = {
  id: string;
  group: string;
  name: string;
  code?: string;
  issuer?: string;
  issueDate?: string;
  expiryDate?: string;
  status: LegalStatus;
  owner?: string;
  note?: string;
};

export const LEGAL_GROUPS = [
  "Pháp nhân & ĐKKD",
  "ATTP & Công bố sản phẩm",
  "Quảng cáo",
  "Sở hữu trí tuệ",
  "Hợp đồng đối tác",
  "Dữ liệu cá nhân",
] as const;

export const DEFAULT_LEGAL_ITEMS: Omit<LegalItem, "id">[] = [
  { group: "Pháp nhân & ĐKKD", name: "Giấy chứng nhận Đăng ký doanh nghiệp", status: "pending", note: "Ngành nghề, vốn, người đại diện" },
  { group: "Pháp nhân & ĐKKD", name: "Đăng ký/thông báo website–app TMĐT (Bộ Công Thương)", status: "pending" },
  { group: "ATTP & Công bố sản phẩm", name: "Giấy chứng nhận cơ sở đủ điều kiện ATTP", status: "pending", note: "Thường hạn ~3 năm" },
  { group: "ATTP & Công bố sản phẩm", name: "Tự công bố sản phẩm (theo từng SP)", status: "pending", note: "NĐ 15/2018. Nếu là 'thực phẩm bảo vệ sức khỏe' → phải ĐĂNG KÝ công bố" },
  { group: "Quảng cáo", name: "Xác nhận nội dung quảng cáo (theo SP/kênh)", status: "pending", note: "Bắt buộc nếu SP là thực phẩm bảo vệ sức khỏe. ACME = TP bổ sung, cấm claim chữa/trị" },
  { group: "Sở hữu trí tuệ", name: "Văn bằng nhãn hiệu ACME / NOVA", status: "pending", note: "Hiệu lực 10 năm, gia hạn" },
  { group: "Hợp đồng đối tác", name: "Hợp đồng NCC / gia công (OEM)", status: "pending" },
  { group: "Hợp đồng đối tác", name: "Hợp đồng vận chuyển / đại lý / affiliate", status: "pending" },
  { group: "Dữ liệu cá nhân", name: "Consent xử lý dữ liệu (khách + nhân viên)", status: "pending", note: "Luật BVDLCN 2025 hiệu lực 01/01/2026 (thay NĐ13/2023)" },
  { group: "Dữ liệu cá nhân", name: "Hồ sơ DPIA gửi A05 (Bộ Công an)", status: "pending", note: "Trong 60 ngày kể từ khi bắt đầu xử lý — RỦI RO CAO NHẤT với TMĐT" },
];

export function expiryInfo(item: LegalItem, todayISO: string, warnDays = 45): { level: "ok" | "soon" | "expired" | "none"; daysLeft: number | null; label: string } {
  if (item.status === "na") return { level: "none", daysLeft: null, label: "Không áp dụng" };
  if (!item.expiryDate) {
    if (item.status === "pending") return { level: "soon", daysLeft: null, label: "Chưa có / cần bổ sung" };
    return { level: "none", daysLeft: null, label: "Không thời hạn" };
  }
  const today = new Date(todayISO + "T00:00:00");
  const exp = new Date(item.expiryDate + "T00:00:00");
  const days = Math.round((exp.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { level: "expired", daysLeft: days, label: `Hết hạn ${-days} ngày trước` };
  if (days <= warnDays) return { level: "soon", daysLeft: days, label: `Còn ${days} ngày` };
  return { level: "ok", daysLeft: days, label: `Còn ${days} ngày` };
}

export function summarizeLegal(items: LegalItem[], todayISO: string): { expired: number; soon: number; pending: number; total: number } {
  let expired = 0, soon = 0, pending = 0;

  for (const it of items) {
    const e = expiryInfo(it, todayISO);
    if (e.level === "expired") expired++;
    else if (it.status === "pending") pending++;
    else if (e.level === "soon") soon++;
  }
  return { expired, soon, pending, total: items.length };
}
