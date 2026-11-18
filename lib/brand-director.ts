import { askGemini } from "@/lib/gemini";
import { BRAND_DNA_FULL, approvedOffersContext } from "@/lib/brand-dna";
import { COACH_PERSONA } from "@/lib/coach-persona";

import { CONG_THUC_NEN } from "@/lib/covan/knowledge_congthuc";
import { DISC_NOI_DUNG } from "@/lib/covan/knowledge_dockhach";
import { findBanned } from "@/lib/banned-words";

const BRAND_PLAYBOOK = `VỐN CHIẾN LƯỢC — 12 nguyên tắc (chắt từ case Coolmate và Hapas, đã lọc cho ngành sức khoẻ):

MỞ TĂNG TRƯỞNG (học Hapas — reframe túi xách thành món quà, 50tr/tháng lên 4 tỷ/tháng rồi hơn 140 tỷ/90 ngày):
1. REFRAME SANG MÓN QUÀ SỨC KHOẺ: đổi NGƯỜI MUA và LÝ DO MUA thay vì đổi sản phẩm (con tặng
   bố mẹ, chồng tặng vợ). Đây là lối thoát pháp lý đẹp nhất của ngành — bán món quà thì thông
   điệp là QUAN HỆ ("con quan tâm mẹ"), không phải CÔNG DỤNG. Không cần nói câu nào về tác dụng.
2. CHIẾM SỞ HỮU MỘT DỊP, không giành một danh mục: Tết (biếu sức khoẻ) · Vu Lan/Ngày của Mẹ
   (báo hiếu — khớp Đông y và hiếu đạo) · 8/3 và 20/10. Dựng lịch ngược từ mốc, trước 6 tuần.
3. KHAN HIẾM THEO MÙA thay giảm giá %: bộ quà giới hạn theo mùa Đông y (Xuân dưỡng Can, Hạ
   thanh nhiệt, Thu dưỡng Phế, Đông dưỡng Thận). Hết mùa là hết. Tên giữ ở tầng dưỡng sinh —
   "Thu dưỡng Phế" được, "Bộ trị ho mùa thu" là vi phạm.

XÂY MOAT DÀI HẠN (học Coolmate — 10,8 triệu USD vốn, hướng IPO 2026):
4. CỘNG ĐỒNG LÀ MỘT PHÒNG BAN có ngân sách và người chủ trì KPI riêng (buổi sinh hoạt/tháng,
   thành viên chủ động chia sẻ, tỷ lệ giữ chân) — KHÔNG phải KPI doanh số.
5. TÀI TRỢ HOẠT ĐỘNG THẬT ngoài đời (giải chạy, khoá thiền, lớp yoga, workshop nấu ăn). Đây là
   kênh xây thương hiệu AN TOÀN NHẤT về pháp lý: tài trợ một hoạt động, không quảng cáo một
   tác dụng. Chỉ để tên và logo.
6. OWN-MEDIA LÀ TÀI SẢN, sàn và ads là kênh thuê. Đo bằng tài sản (bài xếp hạng, email sở hữu,
   khách quay lại từ app), không chỉ bằng đơn.
7. ĐỂ BÊN THỨ BA NÓI THAY: đăng công khai số công bố sản phẩm, phiếu kiểm nghiệm, chứng nhận
   ATTP. Đây là cách duy nhất "chứng minh" mà không vi phạm. Cimigo: 98% người Việt đọc review
   trước khi mua, chỉ 10% mua ngay sau khi thấy quảng cáo.
8. MỖI ĐƠN HÀNG LÀ MỘT ĐIỂM CHẠM: thẻ cảm ơn + QR vào app NOVA + QR vào cộng đồng. Biến người
   mua một lần thành người dùng app. Lưu ý thẻ trong hộp LÀ ấn phẩm quảng cáo theo luật.
9. FOUNDER KỂ THẤT BẠI VÀ HỆ THỐNG, không kể kết quả sức khoẻ. Cạm bẫy chết người: "tôi từng
   bệnh, dùng sản phẩm mình rồi khỏi" = khoe kết quả sức khoẻ làm bằng chứng, vi phạm thẳng.

GIỮ NIỀM TIN:
10. GỠ RỦI RO BẰNG TRẢI NGHIỆM THỬ, không bằng hoàn tiền: chương trình trải nghiệm miễn phí (mẫu) · quiz thể
    trạng · app free · buổi tư vấn Health Coach đầu tiên. Đặt cạnh giá: "Trải nghiệm trước khi trả tiền."
11. BÁN CAM KẾT ĐỒNG HÀNH thay cam kết hiệu quả. Cam kết nằm ở QUY TRÌNH PHỤC VỤ ("4 lần kiểm
    tra tiến độ, phản hồi trong 24h"), tuyệt đối không ở KẾT QUẢ CƠ THỂ.
12. ĐO CHĂM SÓC KHÁCH NHƯ ĐO DOANH THU, cộng thêm chỉ số riêng của ngành: tỷ lệ hội thoại sale
    có từ cấm. Một tin nhắn sai của một sale có thể thành bằng chứng vi phạm cho cả thương hiệu.

BẢY CHIẾN THUẬT CẤM COPY (Luật Quảng cáo sửa đổi 2025 hiệu lực 01/01/2026 — influencer chịu
trách nhiệm pháp lý trực tiếp; Luật TMĐT 122/2025 hiệu lực 7/2026 — người livestream chịu
trách nhiệm nội dung):
- UGC không kiểm soát (Hapas có 23.000 video; với thực phẩm bổ sung đó là 23.000 rủi ro vi phạm)
- Dồn thương hiệu vào một ngôi sao (vụ kẹo Kera: hoàn hơn 1,3 tỷ cho 3.798 khách)
- Dùng bác sĩ/dược sĩ/lời chứng người bệnh làm bằng chứng (cấm tại NĐ 15/2018 và 181/2013;
  phạt 40-60 triệu nếu gây hiểu nhầm có tác dụng như thuốc)
- Hoàn tiền 60 ngày không lý do (hàng ăn vào đã mở không nhận lại được)
- "Hiệu quả sau X ngày" / "test bởi X người" (công dụng sức khoẻ, cấm tuyệt đối)
- Đua giảm giá phần trăm (luật nội bộ: tặng quà, không chiết khấu %)
- Đẩy mạnh livestream bán thực phẩm bổ sung lúc này (mảng đang bị siết mạnh nhất)`;

const CHAIN_FRAME = `KHUNG MẮT XÍCH — trả lời theo ĐÚNG khung này, không thêm mục lạ:

CHIẾN DỊCH: [tên] · Dịp/ngòi nổ · Thời gian
THÔNG ĐIỆP GỐC: [một câu duy nhất, mọi mắt xích diễn lại câu này]
NGƯỜI MUA vs NGƯỜI DÙNG: [ai trả tiền · ai dùng — có thể khác nhau]
MỤC TIÊU ĐO ĐƯỢC: [kèm số]

Rồi 10 mắt xích, mỗi mắt xích 1-2 dòng (làm gì · ai làm · khi nào):
1 Blog & SEO · 2 Fanpage & social · 3 Cộng đồng · 4 App NOVA · 5 Sale Zalo ·
6 Sản phẩm & gói · 7 Email nuôi · 8 Ads · 9 CSKH sau bán · 10 Đo lường
Mắt xích không dùng thì ghi "KHÔNG dùng — vì ..." chứ đừng bỏ trống.

Kết bằng: VIỆC TUẦN NÀY (3 việc cụ thể) và RỦI RO (điều gì có thể vỡ).

NGƯỜI THẬT của công ty (đừng vẽ kế hoạch cần 10 người khi chỉ có 2 sale): sale Sơn · Cúc (Đào nghỉ từ 03/08/2026);
MKT Thu Hằng (viết + đăng bài) và Thu Ngân (đăng bài nhẹ); CMO Lan; ads do CEO tự cầm.`;

export async function planCampaign(yeuCau: string, dip?: string): Promise<string> {
  const offers = await approvedOffersContext();
  const sys = `Bạn là GIÁM ĐỐC THƯƠNG HIỆU của NOVA (ACME Corp), báo cáo trực tiếp CEO.
Việc của bạn KHÔNG phải viết content — mà là giữ cho cả hệ sinh thái nói cùng một câu chuyện.
Nếu một mắt xích im lặng hoặc nói lệch thì chiến dịch coi như hở.

${COACH_PERSONA}

${BRAND_DNA_FULL}

${BRAND_PLAYBOOK}

${offers}

${CHAIN_FRAME}

${CONG_THUC_NEN}

${DISC_NOI_DUNG}

CÁCH TRẢ LỜI: tiếng Việt, gọn, cụ thể, có số và mốc thời gian. KHÔNG markdown đậm/nghiêng
(gửi qua Telegram nên dấu sao sẽ hiện thô). KHÔNG emoji. Chỉ dùng giá và combo ĐÃ DUYỆT trong
DNA — không tự đặt giá mới. Kế hoạch xong phải chờ CEO duyệt mới chạy.`;

  const prompt = `Yêu cầu của CEO: ${yeuCau}${dip ? `\nDịp/thời điểm: ${dip}` : ""}`;
  const r = await askGemini(sys, [], prompt, { maxOutputTokens: 3000, temperature: 0.6 });
  if (!r.ok || !r.text) return "Chưa lên được kế hoạch lúc này (AI không phản hồi). Anh thử lại sau ít phút nhé.";

  const banned = findBanned(r.text);
  const warn = banned.length
    ? `\n\n[CẢNH BÁO PHÁP LÝ] Bản nháp này còn chữ cần sửa trước khi dùng: ${banned.join(", ")}. Em sẽ soát lại nếu anh muốn.`
    : "";
  return r.text.trim() + warn;
}
