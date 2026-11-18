export const CUSTOMER_GROUPS = [
  {
    key: "pain",
    no: 1,
    label: "Khách Đau Gì?",
    color: "#DC2626",
    icon: "",
    helper: "Pain points — lý do KHẨN CẤP khiến khách mua",
    keywords: [
      "Mất tự tin", "Mệt mỏi", "Thiếu thời gian", "Sức khoẻ yếu",
      "Tài chính hạn chế", "Không hiệu quả", "Lo lắng, Stress", "Khó khăn, Rắc rối",
      "Đau lưng, mỏi vai", "Mất ngủ", "Tiêu hoá kém", "Tăng cân khó kiểm soát",
      "Da xấu, lão hoá", "Bế tắc công việc", "Quan hệ kém", "Cô đơn"
    ]
  },
  {
    key: "identity",
    no: 2,
    label: "Muốn Thành Ai?",
    color: "#F97316",
    icon: "",
    helper: "Desired Identity — phiên bản TƯƠNG LAI khách khao khát",
    keywords: [
      "Thành công", "Giàu có", "Khoẻ mạnh", "Xinh đẹp, Trẻ trung",
      "Tự tin, Bản lĩnh", "Hiệu quả, Năng suất", "Hạnh phúc, Bình an",
      "Doanh nhân", "Influencer", "Mẹ thông thái", "Người tự do", "Lãnh đạo", "Chuyên gia"
    ]
  },
  {
    key: "perception",
    no: 3,
    label: "Muốn Được Nhìn Nhận Ra Sao?",
    color: "#16A34A",
    icon: "",
    helper: "Perception — cách khách muốn người khác đánh giá mình",
    keywords: [
      "Chuyên nghiệp", "Đẳng cấp", "Có gu, Hiểu biết", "Dẫn đầu, Khác biệt",
      "Thành đạt", "Có giá trị", "Đáng tin cậy", "Sành điệu", "Tinh tế",
      "Thông minh", "Có học", "Hiện đại", "Truyền thống"
    ]
  },
  {
    key: "showoff",
    no: 4,
    label: "Muốn Khoe Gì?",
    color: "#1D4ED8",
    icon: "",
    helper: "Showoff — thứ khách muốn share để được công nhận",
    keywords: [
      "Kết quả, Thành tích", "Trải nghiệm", "Sản phẩm, Thương hiệu",
      "Lối sống, Lifestyle", "Gu thẩm mỹ", "Sự khác biệt", "Câu chuyện cá nhân",
      "Body đẹp", "Chuyến đi", "Vòng tròn quan hệ", "Đồ ăn", "Sách đã đọc"
    ]
  },
  {
    key: "community",
    no: 5,
    label: "Thuộc Về Cộng Đồng Nào?",
    color: "#7C3AED",
    icon: "",
    helper: "Belonging — bộ tộc khách muốn gia nhập",
    keywords: [
      "Cộng đồng thành công", "Cộng đồng healthy", "Cộng đồng doanh nhân",
      "Cộng đồng đam mê", "Cộng đồng học tập", "Cộng đồng cao cấp",
      "Cộng đồng giá trị", "Cộng đồng làm đẹp", "Cộng đồng mẹ bỉm",
      "Cộng đồng yoga/thiền", "Cộng đồng minimalism"
    ]
  },
  {
    key: "speed",
    no: 6,
    label: "Muốn Nhanh Hơn Điều Gì?",
    color: "#0891B2",
    icon: "",
    helper: "Speed — thứ khách muốn rút ngắn thời gian",
    keywords: [
      "Giảm cân nhanh", "Tăng doanh thu nhanh", "Hồi phục nhanh", "Học nhanh",
      "Tiết kiệm thời gian", "Đạt kết quả nhanh", "Tự do tài chính nhanh",
      "Detox nhanh", "Đẹp lên nhanh", "Có khách nhanh", "Lên TOP nhanh"
    ]
  }
] as const;

export type CustomerGroupKey = typeof CUSTOMER_GROUPS[number]["key"];

export const PRODUCT_MATRIX = [
  {
    key: "pain",
    no: 1,
    label: "Nỗi đau / Khát khao",
    helper: "Tại sao người ta mua?",
    color: "#DC2626",
    keywords: [
      "Đẹp", "Khoẻ", "Giàu", "Giảm cân", "Trẻ hơn", "Tự tin", "Thể hiện",
      "Tiện lợi", "An toàn", "Ngủ ngon", "Giải độc", "Chống lão hoá",
      "Tâm linh", "Gia đình", "Con cái", "Thành công", "Năng lượng",
      "Hạnh phúc", "Yêu thương", "Khác biệt"
    ]
  },
  {
    key: "value",
    no: 2,
    label: "Giá trị cảm nhận",
    helper: "Thứ khiến thấy ĐẮT mà vẫn mua",
    color: "#EA580C",
    keywords: [
      "Premium", "Organic", "Công nghệ", "AI", "Chuyên gia", "Bác sĩ",
      "Nhật Bản", "Hàn Quốc", "Thảo dược", "Handmade", "Bí truyền",
      "Độc quyền", "Phong thuỷ", "Quốc tế", "Khoa học", "Limited",
      "Local Pride", "Xanh / Eco", "Thiền", "Siêu hiếm"
    ]
  },
  {
    key: "trigger",
    no: 3,
    label: "Kích hoạt mua hàng",
    helper: "Thứ làm khách RA QUYẾT ĐỊNH",
    color: "#16A34A",
    keywords: [
      "Review", "Before After", "Cam kết", "Social Proof", "KOL", "Bestseller",
      "Giới hạn", "FOMO", "Hoàn tiền", "Case study", "Chứng nhận", "Chứng minh",
      "Đám đông", "Tặng quà", "Bảo hành", "Thử ngay", "Ưu đãi",
      "Tư vấn 1:1", "Quà tặng", "Mua theo nhóm"
    ]
  },
  {
    key: "viral",
    no: 4,
    label: "Viral / Content",
    helper: "Thứ giúp sản phẩm BÙNG NỔ",
    color: "#1D4ED8",
    keywords: [
      "Shock", "Tranh cãi", "Câu chuyện", "Bí mật", "Chuyển hoá", "Thử thách",
      "Trend", "Viral video", "So sánh", "Khoe", "Nhân vật", "Lifestyle",
      "Hành trình", "Niềm tin", "Giật mình", "Đời thật", "Thực nghiệm",
      "Cộng đồng", "Tôn giáo thương hiệu", "Hack não"
    ]
  },
  {
    key: "scale",
    no: 5,
    label: "Scale / Nhân rộng",
    helper: "Thứ giúp thành \"ĐẾ CHẾ\"",
    color: "#7C3AED",
    keywords: [
      "Repeat", "Affiliate", "Franchise", "Ecosystem", "Combo", "Membership",
      "Subscription", "Daily Use", "Dễ giới thiệu", "Dễ content", "AI Sales",
      "Auto Marketing", "Kênh phân phối", "Đại lý", "Chuỗi", "Dễ copy model",
      "Tự động hoá", "Cộng tác", "Đóng gói scale", "Global"
    ]
  },
  {
    key: "design",
    no: 6,
    label: "Thiết kế / Trải nghiệm",
    helper: "Bao bì + Hình ảnh + Cảm giác",
    color: "#0891B2",
    keywords: [
      "Màu sắc", "Bao bì", "Unboxing", "Hình dạng", "Mùi hương", "Chất liệu",
      "Cảm giác cầm", "Âm thanh", "Ánh sáng", "Phong cách", "Nhận diện",
      "Mini size", "Sang trọng", "Tối giản", "Biểu tượng", "Logo", "Font",
      "Icon", "Chuyển động", "Trải nghiệm"
    ]
  }
] as const;

export type ProductMatrixKey = typeof PRODUCT_MATRIX[number]["key"];

export function generateSalesScript(input: {
  customer_name: string;
  product_interested: string;
  pain: string[];
  identity: string[];
  perception: string[];
  showoff: string[];
  community: string[];
  speed: string[];
}): string {
  const lines: string[] = [];

  lines.push(`KỊCH BẢN CHỐT ĐƠN — ${input.customer_name.toUpperCase()}`);
  lines.push(`Sản phẩm: ${input.product_interested}`);
  lines.push("");

  if (input.pain.length) {
    lines.push("MỞ ĐẦU (chạm pain — 30 giây):");
    lines.push(`"Em hiểu rằng anh/chị đang gặp tình trạng ${input.pain.slice(0, 2).join(", ")} đúng không ạ?`);
    if (input.pain.length > 2) {
      lines.push(`Cộng thêm ${input.pain.slice(2).join(", ")} nữa thì chắc cảm thấy rất khó chịu."`);
    } else {
      lines.push(`Đây là vấn đề mà rất nhiều khách của em cũng gặp."`);
    }
    lines.push("");
  }

  if (input.identity.length) {
    lines.push("VẼ TƯƠNG LAI (identity — 30 giây):");
    lines.push(`"Em hình dung anh/chị muốn trở thành người ${input.identity.slice(0, 3).join(", ")} đúng không?`);
    lines.push(`Đó là phiên bản tốt hơn của chính mình."`);
    lines.push("");
  }

  if (input.perception.length) {
    lines.push("NHÌN NHẬN XÃ HỘI (perception):");
    lines.push(`"Và khi đạt được điều đó, mọi người sẽ thấy anh/chị ${input.perception.slice(0, 2).join(", ")} hơn rất nhiều."`);
    lines.push("");
  }

  if (input.showoff.length) {
    lines.push("GIÁ TRỊ KHOE (showoff):");
    lines.push(`"Anh/chị có thể tự hào về ${input.showoff.slice(0, 2).join(", ")} với người thân, bạn bè."`);
    lines.push("");
  }

  if (input.community.length) {
    lines.push("CỘNG ĐỒNG (belonging):");
    lines.push(`"Hơn nữa, anh/chị sẽ là một phần của ${input.community.slice(0, 2).join(", ")} — nơi mọi người cùng hướng tới mục tiêu chung."`);
    lines.push("");
  }

  if (input.speed.length) {
    lines.push("CHỐT ĐƠN (speed — tạo urgency):");
    lines.push(`"Sản phẩm/dịch vụ này giúp anh/chị ${input.speed.slice(0, 2).join(", ")} — không cần đợi vài tháng như cách thông thường.`);
    lines.push(`Mình bắt đầu ngay hôm nay nhé, để anh/chị thấy kết quả sớm nhất?"`);
    lines.push("");
  }

  lines.push("─────────────────────");
  lines.push("LƯU Ý KHI CHỐT:");
  lines.push("• Nói chậm, lắng nghe phản ứng");
  lines.push("• Khi khách im lặng → ĐỪNG nói thêm, để khách suy nghĩ");
  lines.push("• Hỏi lại để xác nhận: 'Anh/chị thấy đúng với mình không?'");
  lines.push("• Đề xuất phương án: trial / combo / trả góp");

  return lines.join("\n");
}

export function randomConcept() {
  return PRODUCT_MATRIX.map(col => ({
    key: col.key,
    label: col.label,
    keyword: col.keywords[Math.floor(Math.random() * col.keywords.length)]
  }));
}
