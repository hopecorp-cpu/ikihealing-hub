import type { Doan } from "./blog-nurture-chu";

export type DuyetMau = { banDuyet: string; luc: string; nguoi: string };
export type MauDuyet = { day: number; subject: string; tieuDeKhung: string; neuSanPham: boolean; than: Doan[]; duyet: DuyetMau | false };

export const KHUNG: { dau: Doan[]; cuoi: Doan[] } = {"dau":[["[ảnh: NOVA Beauty & Wellness]"],["NOVA Beauty & Wellness"]],"cuoi":[["NOVA Beauty & Wellness"],["Học đúng. Dùng thật. Chia sẻ tử tế."],["Website: example.com"],["Liên hệ: contact@example.com (mailto:contact@example.com) · 0987.931.551"],["Bài viết chia sẻ thông tin tham khảo, không thay thế tư vấn của bác sĩ."],["NOVA Beauty & Wellness là thương hiệu của Công ty Cổ phần ACME (ACME Corp)."],["Công ty Cổ phần ACME, MST 0100000000, Số 1 Đường Mẫu, Phường Mẫu, Thành phố Mẫu."],["Chị nhận thư này vì đã để lại email trên example.com. Không muốn nhận nữa? Bấm vào đây để ngừng nhận ({{LINK_HUY}}) (một chạm, không cần đăng nhập) hoặc trả lời thư này với chữ \"Huỷ\". Chính sách dữ liệu (https://example.com/chinh-sach-bao-mat.html)."]]};

export const MAU_DUYET: MauDuyet[] = [
  {
    day: 0,
    subject: "Cẩm nang chăm sóc sức khoẻ chủ động của chị đây",
    tieuDeKhung: "Cảm ơn chị đã đăng ký",
    neuSanPham: false,
    than: [["Chào chị,"],["Cảm ơn chị đã quan tâm tới việc chăm sóc sức khoẻ chủ động cùng NOVA. Cẩm nang chị đăng ký đã sẵn sàng:"],["Tải cẩm nang PDF (https://example.com/assets/cam-nang-cham-soc-suc-khoe-chu-dong.pdf?utm_source=email&utm_medium=email&utm_campaign=drip-blog&lid=LID)"],["Mấy tuần tới, NOVA gửi chị vài thư ngắn, mỗi thư một thói quen nhỏ, dễ làm. Chị chỉ cần chọn một việc trong cẩm nang và bắt đầu từ hôm nay."],["Chị có câu hỏi thì cứ trả lời thư này, NOVA đọc và trả lời chị."]],
    duyet: { banDuyet: "", luc: "2026-10-04T08:10:00+07:00", nguoi: "TH" },
  },
  {
    day: 3,
    subject: "Bắt đầu từ hai việc nhỏ",
    tieuDeKhung: "Hai việc nền tảng",
    neuSanPham: false,
    than: [["Chào chị,"],["Hai việc đầu tiên trong cẩm nang cũng là hai việc dễ làm nhất:"],["- Để ý cơ thể mình: mỗi tối ghi vài dòng về giấc ngủ, mức năng lượng và bữa ăn trong ngày.","- Ăn uống nền tảng: thêm một phần rau theo mùa, ăn chậm hơn, uống đủ nước ấm."],["Một ví dụ dễ làm"],["Đặt sẵn một ly nước ấm ở chỗ chị ghé mỗi sáng, cạnh ấm đun nước hay bàn làm việc. Việc nhỏ đến mức không cần nhắc. Khi đã quen, chị thêm việc thứ hai: hai dòng ghi chú trước khi ngủ."],["Chị không cần làm cả hai cùng lúc. Chọn một việc, giữ trong một tuần, rồi mới thêm."]],
    duyet: { banDuyet: "", luc: "2026-10-04T08:10:00+07:00", nguoi: "TH" },
  },
  {
    day: 7,
    subject: "Chị hợp đồ ấm hay đồ mát?",
    tieuDeKhung: "Hiểu cơ địa của mình",
    neuSanPham: false,
    than: [["Chào chị,"],["Cùng một lời khuyên \"ăn nhiều rau xanh\", mỗi người áp dụng một kiểu mới thấy dễ chịu. Dưỡng sinh phương Đông gọi đó là thể tạng: xu hướng cơ địa của mỗi người, không phải chẩn đoán bệnh."],["Chị có thể tự quan sát vài điều:"],["- Chị hay lạnh tay chân, thích đồ ấm? Bữa sáng ấm và rau nấu chín thường dễ chịu hơn sinh tố lạnh.","- Chị hay thấy nóng trong, thích đồ mát? Thêm rau tươi, bớt đồ chiên rán thường hợp hơn.","- Chị hay thấy cạn sức về chiều? Giữ giờ ngủ đều và bữa sáng đủ đạm là chỗ bắt đầu."],["Đây chỉ là gợi ý tham khảo lối sống. Khi có vấn đề sức khoẻ, chị hỏi bác sĩ."],["Tuần này, chị thử đổi một bữa theo đúng cảm giác của cơ thể mình, rồi để ý xem có dễ chịu hơn không."]],
    duyet: { banDuyet: "", luc: "2026-10-04T08:10:00+07:00", nguoi: "TH" },
  },
  {
    day: 14,
    subject: "Hai tuần rồi, chị không cần đi một mình",
    tieuDeKhung: "Học cùng nhau",
    neuSanPham: false,
    than: [["Chào chị,"],["Hai tuần rồi. Mong là chị đã giữ được một thói quen nhỏ, dù chỉ là ly nước ấm buổi sáng."],["Giữ thói quen một mình thường khó hơn khi có người cùng học. Vì vậy NOVA có Học Viện. Học Viện NOVA là chương trình huấn luyện sức khoẻ chủ động của NOVA Beauty & Wellness (ACME Corp)."],["Ở Học Viện, chị có thể:"],["- Học lớp nhập môn 3 Ngày Reset, miễn phí.","- Hỏi đáp cùng Health Coach NOVA trong các buổi Zoom.","- Đọc kiến thức mở trên blog và video, không cần mua gì."],["Chị muốn nhận lịch lớp gần nhất thì nhắn Zalo NOVA (https://zalo.me/0000000000000000000) hoặc trả lời thư này."],["Học Viện NOVA chia sẻ kiến thức lối sống, không thay thế tư vấn, chẩn đoán hay điều trị y khoa."]],
    duyet: { banDuyet: "", luc: "2026-10-04T08:10:00+07:00", nguoi: "TH" },
  },
  {
    day: 21,
    subject: "Gắn thói quen mới vào việc chị vẫn làm mỗi ngày",
    tieuDeKhung: "Một mỏ neo cho thói quen",
    neuSanPham: false,
    than: [["Chào chị,"],["Ngày bận rộn thì khó tìm thêm thời gian cho mình. Cách dễ hơn là gắn thói quen mới vào một việc chị vẫn làm mỗi ngày. Việc cũ thành mỏ neo cho việc mới."],["Vài ví dụ:"],["- Tắt máy tính xong thì đứng dậy vươn vai hai phút.","- Đánh răng tối xong thì ghi hai dòng về ngày hôm nay.","- Ăn tối xong thì đi bộ mười phút quanh nhà."],["Ba tuần rồi. Nếu chị mới giữ được một việc, vậy là ổn. Đi chậm mà đều dễ giữ hơn đi nhanh rồi bỏ."],["Hôm nay chị chọn một mỏ neo thôi nhé."]],
    duyet: { banDuyet: "", luc: "2026-10-04T08:10:00+07:00", nguoi: "TH" },
  },
  {
    day: 30,
    subject: "30 ngày cùng NOVA, cảm ơn chị",
    tieuDeKhung: "Cảm ơn chị đã đồng hành 30 ngày",
    neuSanPham: true,
    than: [["Chào chị,"],["Một tháng trước, chị để lại email vì muốn chăm sóc sức khoẻ chủ động hơn. Mong là qua cẩm nang và mấy thư vừa rồi, chị đã giữ được vài thói quen nhỏ cho riêng mình."],["Thói quen vẫn là phần chính. Nếu chị muốn thêm vài món quen cho bữa ăn và khoảng nghỉ mỗi ngày, NOVA có hai dòng sản phẩm:"],["- Bột đạm thực vật Đạm Mẫu Protein Pro: thực phẩm bổ sung, dùng để bổ sung đạm thực vật cho bữa ăn hằng ngày.","- Trà Mẫu B: trà thảo mộc túi lọc với hoa nhài, phục linh, hoa quế, trần bì, cho một tách trà ấm lúc chị muốn chậm lại."],["Chị muốn xem thành phần, cách dùng và giá thì trả lời thư này, NOVA gửi chị thông tin. Chị có câu hỏi về thói quen hay thể tạng cũng cứ hỏi."],["Cảm ơn chị đã cho NOVA đồng hành một chặng đường. Chúc chị luôn khoẻ và an."],["Thực phẩm bổ sung Sản phẩm A (hũ 500 g), số tự công bố 01/ACME Corp/2026. Tổ chức chịu trách nhiệm về sản phẩm: Chi nhánh Hà Nội - Công ty Cổ phần ACME, L93 ô đất U03, Khu D, Khu đô thị mới Dương Nội, phường Yên Nghĩa, thành phố Hà Nội. Dành cho người từ 16 tuổi trở lên."],["PURE AROMA BLISS TEA - THANH HƯƠNG TRÀ là trà thảo mộc túi lọc, số tự công bố 01 PURE TEA/ACME Corp/2026. Tổ chức chịu trách nhiệm về sản phẩm: Công ty Cổ phần ACME, Số 2 Đường Mẫu, Phường Mẫu, Thành phố Mẫu."]],
    duyet: { banDuyet: "", luc: "2026-10-04T08:10:00+07:00", nguoi: "TH" },
  },
];
