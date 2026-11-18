export type DocItem = {
  id: string;
  category: string;
  title: string;
  url?: string;
  owner?: string;
  updated?: string;
  tags?: string;
  note?: string;
  access?: "all" | "manager" | "ceo";
  body?: string;
  source?: string;
};

export const DOC_CATEGORIES = [
  "Quy trình (SOP)",
  "Chính sách & Quy chế",
  "Hợp đồng & Biểu mẫu",
  "Thương hiệu & Media",
  "Đào tạo & Onboarding",
  "Tài chính & Kế toán",
  "Pháp lý",
  "Khác",
] as const;

export const DEFAULT_DOCS: Omit<DocItem, "id">[] = [
  { category: "Quy trình (SOP)", title: "Thư viện quy trình (8 SOP)", url: "/quy-trinh", owner: "Điều hành", access: "all", note: "Trang nội bộ" },
  { category: "Đào tạo & Onboarding", title: "Lộ trình 30 ngày + Knowledge Base", url: "/kb", access: "all", note: "Trang nội bộ" },
  { category: "Chính sách & Quy chế", title: "Chính sách kênh (CTV/Đại lý)", url: "/chinh-sach-kenh", access: "manager" },
  { category: "Chính sách & Quy chế", title: "Kết cấu bán hàng (combo/thẻ/quà)", url: "/ket-cau-ban-hang", access: "manager", note: "Bán gì, gói nào, tặng gì — CEO duyệt tại trang" },
  { category: "Quy trình (SOP)", title: "Profit Playbook (nước đi tăng lợi nhuận)", url: "/playbook-loi-nhuan", access: "manager", note: "Máy đề xuất - giao việc - đo lại" },
  { category: "Chính sách & Quy chế", title: "Cơ chế thưởng phòng ban", url: "/co-che-thuong", access: "manager" },
  { category: "Chính sách & Quy chế", title: "Quy chế Con người (thưởng-phạt, phúc lợi)", note: "Artifact — dán link Drive/PDF", access: "all" },
  { category: "Hợp đồng & Biểu mẫu", title: "Hồ sơ & Hợp đồng nhân viên", url: "/hop-dong", access: "manager" },
  { category: "Pháp lý", title: "Sổ pháp chế (giấy phép, công bố SP)", url: "/phap-che", access: "manager" },
  { category: "Tài chính & Kế toán", title: "Chi phí & Lợi nhuận (P&L)", url: "/tai-chinh", access: "ceo" },
  { category: "Thương hiệu & Media", title: "Thư mục Media/Brand (Drive)", note: "Dán link Drive", access: "all" },
];

export function filterDocs(docs: DocItem[], q: string): DocItem[] {
  const s = (q || "").trim().toLowerCase();
  if (!s) return docs;
  return docs.filter(d =>
    [d.title, d.tags, d.category, d.owner, d.note].filter(Boolean).join(" ").toLowerCase().includes(s)
  );
}
