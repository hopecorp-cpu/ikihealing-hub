export type FeatureItem = { href: string; label: string; desc: string; managerOnly?: boolean; moi?: boolean };
export type FeatureGroup = { key: string; title: string; intro: string; color: string; items: FeatureItem[] };

export const FEATURE_MAP: FeatureGroup[] = [
  {
    key: "hang-ngay", title: "Việc hằng ngày", color: "#0F766E",
    intro: "Mở máy là vào đây trước: việc của mình, khách cần chăm, số của hôm nay.",
    items: [
      { href: "/viec-hom-nay", label: "Việc hôm nay", desc: "Danh sách việc được giao kèm hạn và cách đo xong — làm xong bấm hoàn thành để máy học tiếp." },
      { href: "/tasks", label: "Bảng công việc", desc: "Toàn bộ việc theo cột trạng thái, kéo thả và bình luận trao đổi." },
      { href: "/cham-soc-kh", label: "Pipeline chăm khách", desc: "Khách đang ở bước nào, ai phụ trách, đến hạn chăm lúc nào." },
      { href: "/lich-tu-van", label: "Lịch tư vấn 1-1", desc: "Đặt buổi tư vấn 30 phút theo chuyên viên và khung giờ, đánh dấu khách đến hay vắng.", moi: true },
      { href: "/danh-ba-khach", label: "Khách chờ Zalo", desc: "Khách nhắn mà chưa ai trả lời — vào đây để không sót inbox." },
      { href: "/cham-cong", label: "Chấm công", desc: "Check-in, check-out, xem công của mình trong tháng." },
    ],
  },
  {
    key: "ban-hang", title: "Bán hàng & khách", color: "#B45309",
    intro: "Bán cái gì, giá nào, cho ai — và tiền về tới đâu.",
    items: [
      { href: "/ket-cau-ban-hang", label: "Kết cấu bán hàng", desc: "Toàn bộ combo, thẻ thành viên, quà tặng đã duyệt kèm giá — nguồn DUY NHẤT để báo giá khách." },
      { href: "/leads", label: "Pool chia lead", desc: "Lead mới về được chia cho ai, chưa liên hệ quá hạn thì máy tự chia lại." },
      { href: "/khach-360", label: "Phân loại khách & VIP", desc: "Nhìn khách theo giá trị và hành vi để biết nên chăm ai trước." },
      { href: "/tep-khach", label: "Tệp khách theo dòng sản phẩm", desc: "Khách đang dùng đạm, trà hay khóa học — để mời đúng thứ họ cần, bán chéo không bị hớ.", moi: true },
      { href: "/gan-don", label: "Gán đơn cho sale", desc: "Đơn MISA về chưa rõ ai bán thì gán tại đây — ảnh hưởng thẳng tới hoa hồng." },
      { href: "/thu-vien-case", label: "Thư viện câu chuyện khách", desc: "Kho cảm nhận thật của khách đã xin phép — nguyên liệu viết bài và bằng chứng khi tư vấn.", moi: true },
    ],
  },
  {
    key: "marketing", title: "Marketing & nội dung", color: "#6D28D9",
    intro: "Máy đẻ nội dung, người duyệt và đăng; quảng cáo có phanh, đối thủ có người canh.",
    items: [
      { href: "/dispatch", label: "Dispatch (điều phối)", desc: "Trung tâm điều phối các agent AI: giao việc, gác chất lượng, ghi nhớ chiến dịch." },
      { href: "/kho-app-ai", label: "Kho app AI", desc: "Chọn app theo việc (caption, kịch bản video, tin Zalo, chấm điểm bài) rồi trò chuyện — không cần tự nghĩ câu lệnh.", moi: true },
      { href: "/lich-chien-dich", label: "Lịch chiến dịch", desc: "Cả tháng đăng gì, ngày nào chạy chương trình gì." },
      { href: "/tuyen-bai", label: "Tuyến bài (phễu)", desc: "Bài đầu phễu, giữa phễu, cuối phễu — giữ cân đối, không đăng lệch một tầng." },
      { href: "/quang-cao", label: "Quảng cáo", desc: "Chi tiêu, kết quả từng chiến dịch, cảnh báo khi giá mỗi lead vượt trần." },
    ],
  },
  {
    key: "dieu-hanh", title: "Điều hành & báo cáo", color: "#0369A1",
    intro: "Số của công ty: đang thắng hay thua, mắt xích nào yếu, tiền còn bao nhiêu.",
    items: [
      { href: "/chi-so", label: "Bảng chỉ số", desc: "Mười khối chỉ số vận hành: mỗi ô ghi nguồn, giờ cập nhật và đèn. Chưa có dữ liệu thì để trống kèm lý do.", managerOnly: true, moi: true },
      { href: "/trung-tam-chi-huy", label: "Trung tâm chỉ huy", desc: "Một màn hình nhìn hết: doanh thu, sale, sức khỏe AI, chiến dịch đang chạy.", managerOnly: true },
      { href: "/chien-dich-live", label: "Chiến dịch Live", desc: "Sơ đồ sống của chiến dịch: việc nào máy làm xong, việc nào người thật đang làm, phần trăm tiến độ.", managerOnly: true },
      { href: "/vong-lap-doanh-thu", label: "Vòng lặp doanh thu", desc: "Từ mục tiêu tháng ra chỉ tiêu từng sale, số lead cần, ngân sách quảng cáo tối đa.", managerOnly: true },
      { href: "/ban-do-chien-luoc", label: "Bản đồ chiến lược", desc: "Mục tiêu bốn khía cạnh và bản đồ ba chân trời — đường dài công ty đi.", managerOnly: true },
      { href: "/tai-chinh", label: "Tài chính", desc: "Doanh thu, chi phí, lãi lỗ theo tháng — đối chiếu với ngân hàng và MISA.", managerOnly: true },
      { href: "/tai-san", label: "Bảng tài sản", desc: "Tiền, hàng tồn, công nợ — tài sản ròng và đệm két còn mấy tháng.", managerOnly: true },
    ],
  },
  {
    key: "nhan-su", title: "Nhân sự & thu nhập", color: "#BE185D",
    intro: "Người, lương, thi đua — ai đang dẫn đầu và mình đang ở đâu.",
    items: [
      { href: "/luong-cua-toi", label: "Lương của tôi", desc: "Doanh số tháng này của mình, đang ở bậc hoa hồng nào, còn bao nhiêu nữa thì lên bậc.", moi: true },
      { href: "/thi-dua", label: "Thi đua", desc: "Bảng xếp hạng doanh số và hoạt động của đội." },
      { href: "/nhan-su", label: "Nhân sự", desc: "Danh sách nhân sự, chức danh, phòng ban.", managerOnly: true },
      { href: "/bang-luong", label: "Bảng lương", desc: "Bảng lương tháng, phụ cấp, bảo hiểm.", managerOnly: true },
      { href: "/xin-nghi", label: "Xin nghỉ", desc: "Gửi đơn nghỉ phép và theo dõi duyệt." },
    ],
  },
  {
    key: "tai-lieu", title: "Kiến thức & quy trình", color: "#4D7C0F",
    intro: "Không nhớ thì tra, đừng đoán.",
    items: [
      { href: "/tai-lieu", label: "Tài liệu & SOP", desc: "Quy trình chuẩn từng việc, đúc kết từ những lần làm trước." },
      { href: "/quy-trinh", label: "Quy trình 6 bước", desc: "Khung vận hành từ mục tiêu tới đo lường của công ty." },
      { href: "/seeding", label: "Cẩm nang Seeding", desc: "Cách tương tác, trả lời bình luận đúng giọng thương hiệu." },
      { href: "/tuan-thu", label: "Tuân thủ", desc: "Rào pháp lý sản phẩm và quảng cáo — đọc trước khi viết bất cứ thứ gì." },
    ],
  },
];

export function visibleGroups(isManager: boolean): FeatureGroup[] {
  return FEATURE_MAP
    .map((g) => ({ ...g, items: g.items.filter((i) => isManager || !i.managerOnly) }))
    .filter((g) => g.items.length > 0);
}
