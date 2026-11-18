export const PILLARS = [
  { key: "offer", label: "Ưu Đãi (Giá trị bán)", icon: "", color: "#DC2626",
    criteria: [
      "Khách hiểu rõ 'mua gì' trong 10 giây?",
      "Đủ 'đặc biệt' để khách không thể từ chối?",
      "Giá trị cao hơn đối thủ ít nhất 3–5 lần?"
    ],
    rubric: { 10: "Khách đặt lịch ngay khi nghe", 5: "Khách hỏi giá trước", 1: "Không giải thích trong 30s" } },

  { key: "pricing", label: "Chiến Lược Giá", icon: "", color: "#F59E0B",
    criteria: [
      "Có nhiều mức giá (mỏ neo + trung gian + cao cấp)?",
      "Giá tối ưu cho lợi nhuận, không chỉ theo doanh số?",
      "Có upsell/cross-sell tự động trong hành trình mua?"
    ],
    rubric: { 10: "AOV tăng 50%+ nhờ upsell", 5: "Có 3 mức giá hợp lý", 1: "Định giá theo cảm tính" } },

  { key: "customer", label: "Khách Hàng Mục Tiêu", icon: "", color: "#10B981",
    criteria: [
      "Có chân dung KH rõ ràng (tuổi, nỗi đau, ước mơ, nỗi sợ)?",
      "Đã phỏng vấn ≥20 khách hàng thật trong 12 tháng qua?",
      "Có dữ liệu CRM hoặc hành vi rõ ràng về khách hàng?"
    ],
    rubric: { 10: "Hiểu khách như 'người thân'", 5: "Có dữ liệu nhưng chưa đủ sâu", 1: "Không rõ khách là ai" } },

  { key: "channel", label: "Kênh Phân Phối", icon: "", color: "#EF4444",
    criteria: [
      "Có ít nhất 1 kênh mang lại >50% doanh thu?",
      "Tệp khách hàng tăng 5–10% mỗi tháng?",
      "Không phụ thuộc 100% vào quảng cáo trả phí?"
    ],
    rubric: { 10: "Có 1 kênh Top 1 ngành", 5: "Có kênh nhưng chưa ổn định", 1: "Phụ thuộc 100% vào ads" } },

  { key: "funnel", label: "Phễu Chuyển Đổi", icon: "", color: "#8B5CF6",
    criteria: [
      "Có phễu rõ 4 bước: Nhận biết → Quan tâm → Tin tưởng → Mua?",
      "Tỷ lệ chuyển đổi (conversion rate) > 2%?",
      "Có chuỗi email/Zalo chăm sóc tự động?"
    ],
    rubric: { 10: "Phễu live, đo từng bước, conv >5%", 5: "Có phễu chưa đo lường", 1: "Không có phễu" } },

  { key: "brand", label: "Thương Hiệu", icon: "", color: "#FBBF24",
    criteria: [
      "Người sáng lập có thương hiệu cá nhân được nhận diện?",
      "Thương hiệu có 'DNA giọng nói' rõ ràng?",
      "Có bằng chứng xã hội nổi bật (case thực tế)?"
    ],
    rubric: { 10: "Dễ tìm — bạn là SỰ LỰA CHỌN HÀNG ĐẦU", 5: "Có thương hiệu chưa nổi bật", 1: "Không ai nhớ đến bạn" } },

  { key: "product", label: "Sản Phẩm / Dịch Vụ", icon: "", color: "#06B6D4",
    criteria: [
      "Khách đánh giá ≥4.5 sao?",
      "Tỷ lệ khách mua lại cao?",
      "Sản phẩm thực sự giải quyết vấn đề cốt lõi?"
    ],
    rubric: { 10: "Khách quay lại không cần vận động", 5: "Hài lòng chưa quay lại đều", 1: "Phản hồi tiêu cực nhiều" } },

  { key: "team", label: "Đội Ngũ", icon: "", color: "#EC4899",
    criteria: [
      "Có người chốt bên ngoài doanh nghiệp?",
      "Hệ thống quy trình & đào tạo rõ ràng?",
      "Người sáng lập không phải làm 14 giờ/ngày?"
    ],
    rubric: { 10: "Rảnh nghỉ 2 tuần — vẫn trơn tru", 5: "Có đội ngũ vẫn phụ thuộc bạn", 1: "Phụ thuộc 100% vào bạn" } },

  { key: "cash", label: "Tài Chính", icon: "", color: "#16A34A",
    criteria: [
      "Biết rõ CAC, LTV, biên lợi nhuận?",
      "Dòng tiền dương ≥6 tháng?",
      "Có báo cáo lãi/lỗ hàng tháng?"
    ],
    rubric: { 10: "Dòng tiền dương ổn — biết lợi nhuận từng đồng", 5: "Biết DT, chưa rõ LN", 1: "Không có sổ sách" } },

  { key: "moat", label: "Hàng Rào Bảo Vệ (MOAT)", icon: "", color: "#1E40AF", important: true,
    criteria: [
      "Có ít nhất 1 lợi thế cạnh tranh khó sao chép?",
      "Chi phí chuyển đổi khách sang đối thủ có cao?",
      "Khó để đối thủ giảm giá 30% mà không mất khách?"
    ],
    rubric: { 10: "Đối thủ copy 6 tháng vẫn không bằng", 5: "Có 1–2 lợi thế nhỏ", 1: "Không có gì đặc biệt" } },
] as const;

export type PillarKey = typeof PILLARS[number]["key"];

export const DECLARATIONS = [
  "Tôi kiếm tiền bằng hệ thống — không bằng sức người",
  "Tôi liên tục tạo ra phễu thu hút khách hàng",
  "Tôi xây một lần và nhân rộng không giới hạn",
  "Tôi biến internet thành đội ngũ bán hàng 24/7",
  "Tôi sử dụng đòn bẩy AI để nhân bội sức bao phủ",
  "Tôi kiến tạo những sản phẩm triệu đô",
  "Tôi làm giàu bằng việc giải quyết nỗi đau của thị trường",
  "Tôi tạo ra hệ thống kinh doanh tối ưu và chuyển đổi cao",
  "Tôi tạo ra hệ thống kênh trăm triệu traffic",
  "Tôi xây dựng đế chế kinh doanh trên internet thành công"
];

export function rateScore(score: number): { label: string; color: string; emoji: string } {
  if (score >= 9) return { label: "Xuất sắc", color: "#16A34A", emoji: "" };
  if (score >= 7) return { label: "Tốt", color: "#84CC16", emoji: "" };
  if (score >= 4) return { label: "Trung bình", color: "#F59E0B", emoji: "" };
  return { label: "Yếu", color: "#DC2626", emoji: "" };
}

export function empireVerdict(totalScore: number): { status: string; color: string; advice: string } {
  if (totalScore >= 75) return { status: "Empire vận hành tốt", color: "#16A34A", advice: "Duy trì + tập trung 3 trụ yếu nhất để scale" };
  if (totalScore >= 60) return { status: "Cần tối ưu", color: "#F59E0B", advice: "Có nền tảng — cần đào sâu 2–3 trụ chiến lược" };
  return { status: "Cần redesign", color: "#DC2626", advice: "Phải redesign 3 trụ yếu nhất ngay trong 90 ngày" };
}
