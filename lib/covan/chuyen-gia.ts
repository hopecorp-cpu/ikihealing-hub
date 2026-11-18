export type ChuyenGiaId = "lead" | "ban" | "giao" | "loinhuan";

export type ChuyenGia = {
  id: ChuyenGiaId;
  ten: string;
  vai: string;

  cauHoi: string[];

  chiSo: string[];

  camKy: string[];

  cheSan: string[];

  tuKhoa: RegExp;
};

export const CHUYEN_GIA: ChuyenGia[] = [
  {
    id: "lead",
    ten: "Chuyên gia LEAD",
    vai: "Biến người lạ thành người chịu nói chuyện",
    cauHoi: [
      "Đang chạy mấy trong bốn cửa (nhắn ấm, nội dung free, nhắn lạnh, quảng cáo trả tiền), và cửa nào đã có công thức lặp lại được?",
      "Mỗi ngày làm đủ 100 hành động tiếp cận chưa? Dưới ngưỡng đó thì mọi kết luận về kênh đều là nhiễu.",
      "Lead đang về có ĐÚNG chân dung không, hay nhiều mà sai người?",
      "Bốn đòn bẩy (khách giới thiệu, nhân viên, đại lý, đối tác hoa hồng) đã mở cái nào chưa?",
    ],
    chiSo: [
      "Số lead mới thật trong 7 ngày, ĐÃ LOẠI các dòng nhập lịch sử (first_contact_at sớm hơn created_at)",
      "Tỉ lệ lead có số điện thoại theo từng kênh",
      "Chi phí cho một người quan tâm, so với trần đã tính",
    ],
    camKy: [
      "Không kết luận thiếu lead khi kho lead cũ chưa ai chạm và hàng khách chờ trả lời còn tồn.",
      "Không lấy tổng số dòng của bảng lead làm số của tháng.",
      "Mồi câu không được hứa kết quả sức khoẻ, và không neo tiền vào chỉ số khách TỰ KHAI.",
    ],
    cheSan: ["/quiz-leads", "/tracking", "Nhà máy Content", "Research (chien-luoc-mkt)", "lib/leads.ts"],
    tuKhoa: /lead|khách mới|kiếm khách|tìm khách|quảng cáo|chạy ads|nội dung|content|fanpage|tiếp cận|mồi câu|phễu|traffic|người lạ/i,
  },
  {
    id: "ban",
    ten: "Chuyên gia BÁN",
    vai: "Biến người chịu nói chuyện thành người trả tiền",
    cauHoi: [
      "Người đã giơ tay có được trả lời không, và trong bao lâu?",
      "Tỉ lệ chốt theo từng người bán là bao nhiêu, đo trên mẫu đủ lớn chưa?",
      "Lời chào bán đang bán KHOẢNG CÁCH nào của khách, hay đang liệt kê tính năng?",
      "Từ chối hay gặp nhất rơi vào nhóm nào trong bốn nhóm: không tiền, không thời gian, không tin, không phải lúc này?",
      "Người bán có nhận ra khách thuộc nhóm tính cách nào qua CHỮ VIẾT không, hay đang dùng chung một giọng cho cả bốn nhóm?",
      "Đã chạm tới lần thứ năm chưa? Khoảng 80 phần trăm giao dịch xảy ra sau lần chạm thứ năm, mà phần lớn người bán buông ở lần thứ tư.",
    ],
    chiSo: [
      "Số khách đang chờ trả lời và thời gian chờ của người lâu nhất",
      "Tỉ lệ chốt và giá trị giỏ trung bình theo từng người bán",
      "Số cuộc gọi thật mỗi người mỗi ngày, đo bằng dấu vết máy không đo bằng nút bấm",
    ],
    camKy: [
      "Cấm hứa kết quả sức khoẻ, cấm chữa trị khỏi bệnh thải độc theo nghĩa y học, cấm hiệu quả sau bao nhiêu ngày, cấm lấy kết quả sức khoẻ của khách làm bằng chứng.",
      "Khuyến mãi bằng TẶNG QUÀ, không giảm phần trăm.",
      "Cấm tự đặt giá hoặc đưa gói còn ở trạng thái nháp vào kế hoạch bán.",
      "Gán công theo CHỮ KÝ trong tin nhắn, không theo máy gửi.",
      "Đổi CÁCH NÓI theo nhóm tính cách của khách thì được, đổi NỘI DUNG CAM KẾT thì không. Cấm bảo đảm kết quả — chỉ số của ACME là tự khai nên không phản bác được người khai xấu đi.",
    ],
    cheSan: ["/cham-soc-kh", "/sales/telesales", "/sales/checklist", "/ca-truc-ai", "lib/zalo-agent.ts", "kho đọc khách qua chữ viết"],
    tuKhoa: /bán|chốt|sale|tư vấn|kịch bản|từ chối|báo giá|offer|combo|khách chờ|trả lời khách|telesale|đơn hàng/i,
  },
  {
    id: "giao",
    ten: "Chuyên gia GIAO",
    vai: "Biến người trả tiền thành người ở lại",
    cauHoi: [
      "Trong 72 giờ đầu sau khi khách trả tiền, có gì xảy ra không?",
      "Tỉ lệ mua lần hai là bao nhiêu, và khoảng cách trung bình giữa hai lần mua?",
      "Có bảng lý do rời bỏ ghi bằng LỜI CỦA KHÁCH không, hay đang đoán?",
      "Người đang chạy hết công suất chưa, và việc nào trong giờ của họ không sinh tiền?",
    ],
    chiSo: [
      "Tỉ lệ khách mua đúng một lần",
      "Tỉ lệ mua lại theo từng sản phẩm",
      "Số khách ấm, khách ngủ, khách nguội",
      "Số cuộc gọi trần mỗi người mỗi ngày và tỉ lệ giờ dùng cho việc sinh tiền",
    ],
    camKy: [
      "Không nhắc việc bằng cờ nút bấm — người bán sống trong hộp thư chat, phải đo bằng dấu vết máy.",
      "Khách nhắn vào hộp thư của ai thì chính người đó chăm, không chia vòng không chuyền tay.",
      "Gói định kỳ KHÔNG được đóng gói thành liệu trình, không hứa mốc kết quả theo ngày. Bán sự ĐỒNG HÀNH.",
    ],
    cheSan: ["/hieu-qua-cham-soc", "/khach-360", "/repeat-cycle", "/ke-hoach-ngay", "lib/quiz-recheck.ts"],
    tuKhoa: /giữ khách|mua lại|quay lại|chăm sóc|cskh|churn|rời bỏ|hài lòng|giao hàng|fulfillment|trần|quá tải|năng lực|tuyển thêm/i,
  },
  {
    id: "loinhuan",
    ten: "Chuyên gia LỢI NHUẬN",
    vai: "Biến người ở lại thành tiền về sớm hơn tiền bỏ ra",
    cauHoi: [
      "Một khách mới có hoàn đủ chi phí để có họ trong vòng 30 ngày chưa?",
      "Chuỗi tiền đang thiếu nấc nào trong bốn nấc: hút, nâng, hạ, định kỳ?",
      "Tỉ lệ giá trị vòng đời trên chi phí có khách đang là bao nhiêu, và đã cộng ĐỦ LƯƠNG vào chi phí chưa?",
      "Tiền đang rò ở đâu: chiết khấu, quà, ship, hoàn huỷ, hay tồn kho?",
    ],
    chiSo: [
      "Tỉ lệ giá trị vòng đời trên chi phí có khách, ngưỡng an toàn từ 3",
      "Trần chi phí cho một đơn và cho một người quan tâm",
      "Phần trăm doanh thu gốc bốc hơi qua chiết khấu, quà, ship",
      "Tỉ lệ khách trả trước trên tổng đơn",
    ],
    camKy: [
      "CẤM bỏ lương ra ngoài chi phí có khách — với mô hình bán bằng người, lương CHÍNH LÀ chi phí có khách.",
      "Không lấy tiền về tài khoản làm doanh thu khi chưa trừ độ lệch pha thu hộ.",
      "Không lộ giá vốn gốc ra file, artifact hay dịch vụ ngoài; chỉ dùng số dẫn xuất.",
      "Cấm tự đặt giá, cấm bán gói còn nháp.",
    ],
    cheSan: ["/vong-lap-doanh-thu", "/tai-chinh", "/suc-khoe-startup", "/do-luong-mkt", "lib/revenue-loop.ts"],
    tuKhoa: /lợi nhuận|lãi|lỗ|biên|ltv|cac|cpo|cpl|dòng tiền|giá vốn|chiết khấu|quà tặng|định kỳ|thuê bao|giá|pricing|ngân sách|chi phí/i,
  },
];

export const byId = (id: string): ChuyenGia | null => CHUYEN_GIA.find((c) => c.id === id) || null;

export function nhanChuyenGia(question: string): ChuyenGia | null {
  const q = (question || "").trim();
  if (!q) return null;
  const hit = CHUYEN_GIA.filter((c) => c.tuKhoa.test(q));
  return hit.length === 1 ? hit[0] : null;
}

export function chuyenGiaBrief(id: ChuyenGiaId): string {
  const c = byId(id);
  if (!c) return "";
  return [
    `KHOÁC ÁO ${c.ten.toUpperCase()} — ${c.vai}.`,
    "PHẢI trả lời được các câu chẩn đoán này trước khi đề xuất. Thiếu số nào thì NÓI THẲNG là thiếu và chỉ cách lấy, tuyệt đối không đoán:",
    ...c.cauHoi.map((x, i) => `${i + 1}. ${x}`),
    "CHỈ SỐ PHẢI NHÌN:",
    ...c.chiSo.map((x) => `- ${x}`),
    "CẤM (vi phạm là hỏng việc thật, không phải góp ý):",
    ...c.camKy.map((x) => `- ${x}`),
    `CHỖ SẴN CÓ trong hệ thống để anh xem số hoặc làm việc: ${c.cheSan.join(" · ")}`,
    "Vẫn giữ luật một nút thắt: nếu chẩn đoán cho thấy nút thắt KHÔNG nằm ở mảng này, phải nói ra và chỉ sang mảng đúng, đừng cố chữa mảng của mình.",
  ].join("\n");
}

export function danhSachChuyenGia(): string {
  return CHUYEN_GIA.map((c) => `/${c.id} — ${c.ten}: ${c.vai}`).join("\n");
}
