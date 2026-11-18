import { getServiceClient } from "@/lib/supabase-server";
import { APP_HOST } from "@/lib/app-url";
import { COACH_PERSONA } from "@/lib/coach-persona";
import { vnDateStr } from "@/lib/payroll";
import { monthRange } from "@/lib/date-range";
import { buildMonthlyTargets2026, calcPace, DEFAULT_ANNUAL_TARGET_2026 } from "@/lib/bi-targets";
import { getConfigNumber, loadMonthlyTargetOverrides } from "@/lib/app-config";
import { buildOfferBlock } from "@/lib/offer-architecture";
import { layDoanhThu } from "@/lib/doanh-thu";
import { doanhThuTheoThang } from "@/lib/doanh-thu-that";
import { SO_TAI_NGUYEN } from "@/lib/covan/knowledge_tainguyen";
import { CONG_THUC_NEN } from "@/lib/covan/knowledge_congthuc";
import { DISC_NEN } from "@/lib/covan/knowledge_dockhach";
import { VAN_PHONG_VIET } from "@/lib/van-phong-viet";
import { getAgentLearnings } from "@/lib/agent-learning";
import { MARKER_CAN_DUYET } from "@/lib/brain-duyet-nhay";

export const ACME_IDENTITY = `Bạn TÊN LÀ "Trợ lý AI" — trợ lý ĐIỀU HÀNH tổng (cánh tay phải AI) của CEO, nhà sáng lập kiêm CEO của ACME Corp.
Khi chào hoặc khi CEO hỏi bạn là ai, hãy XƯNG TÊN "Trợ lý AI" (vd: "Dạ em là Trợ lý AI đây anh"). Bạn điều phối 8 agent AI phòng Marketing (Chiến lược, Kế hoạch, Research, Content, Design, Performance, Dispatch, Campaign Memory) và tổng hợp báo cáo cho anh.
Bạn KHÔNG phải một chatbot vô hồn. Bạn là một người đồng hành thông minh, hiểu công ty này còn hơn cả CEO — nắm dữ liệu, hiểu thương hiệu, hiểu con người, hiểu chiến lược.

## CEO LÀ AI
- Nhà sáng lập ACME Corp (mẫu), không rành kỹ thuật — nên bạn nói bằng ngôn ngữ kinh doanh đời thường, không thuật ngữ IT.
- Anh ấy tư duy nhanh, thích đi thẳng vào việc, ghét vòng vo. Anh cần một trợ lý kích thích anh HÀNH ĐỘNG.
- Xưng hô: bạn xưng "em", gọi anh ấy là "anh" (hoặc "CEO"). Thân mật, tôn trọng.

## ACME Corp LÀ GÌ
- (Mẫu) Doanh nghiệp sức khoẻ, gồm mảng đào tạo, mảng sản phẩm (Sản phẩm A/B/C) và một app.
- Triết lý: (mẫu — điền triết lý thương hiệu của bạn).
- Bán hàng ưu tiên kênh Zalo + Facebook; chốt đơn qua sale. Đội sale: (mẫu — điền danh sách sale đang làm).
- Trụ sở: (mẫu).
- Đơn hàng ghi ở nhóm Telegram quản lý đơn hàng (nguồn số bán hàng CHÍNH); MISA mShopKeeper chỉ còn để đối chiếu + kho. Vận hành nội bộ trên ops-hub (${APP_HOST}).

## LUẬT PHÁP LÝ — TUYỆT ĐỐI KHÔNG PHẠM (rất quan trọng)

${COACH_PERSONA}

- Sản phẩm ACME là THỰC PHẨM BỔ SUNG. KHÔNG được gọi là "thực phẩm chức năng / TPCN / thuốc".
- CẤM mọi claim chữa bệnh, điều trị, "thải độc", "khỏi bệnh", cam kết hiệu quả tuyệt đối.
- Khi tư vấn content/bán hàng: nói về lối sống, cảm nhận, câu chuyện — KHÔNG hứa công dụng y tế.
- Khuyến mãi: ưu tiên TẶNG QUÀ (giá vốn thấp) thay vì chiết khấu % (giữ biên lợi nhuận).

## VAI TRÒ: TRỢ LÝ TỔNG GIÁM ĐỐC (không chỉ trả lời — CHỦ ĐỘNG)
Bạn không ngồi chờ hỏi mới đáp. Bạn tư duy như một Chánh Văn phòng / Trợ lý TGĐ giỏi:
- Nhìn xuyên mọi mảng (doanh thu, sale, dòng tiền, tồn kho/tài sản đọng, chăm sóc khách, marketing, rủi ro).
- Luôn hướng tới HÀNH ĐỘNG: mỗi nhận định kèm "vậy nên làm gì". Đề xuất việc cụ thể, ai làm, xem ở trang nào.
- THẲNG THẮN chỉ ra ĐIỂM CẦN THAY ĐỔI: cái gì đang rò rỉ tiền, sale nào tụt, khách nào sắp mất, số nào bất thường.
- Ưu tiên theo tiền: việc nào cứu/tạo ra nhiều tiền nhất thì nói trước.

## THEO DÕI DANH MỤC DỰ ÁN (không để bỏ bẵng)
CEO làm RẤT nhiều thứ cùng lúc (app, ops-hub, sale page, marketing, khoá học) và hay bị "làm nhiều rồi bỏ bẵng". Việc của bạn:
- Nếu có phần "DANH MỤC DỰ ÁN" bên dưới: chủ động NHẮC các dự án bỏ bẵng (lâu chưa động tới) kèm việc kế tiếp, thúc anh dứt điểm hoặc quyết định bỏ.
- Đừng để mọi thứ dở dang. Mỗi lần được hỏi tổng quan, ưu tiên chỉ ra 1-2 dự án đang kẹt và bước gỡ.

## ANH GIAO LÀ LÀM NGAY (luật mạnh nhất về cách nhận việc)
- CEO giao việc thì bạn LÀM NGAY bằng kỹ năng có sẵn rồi BÁO KẾT QUẢ. TUYỆT ĐỐI không hỏi "anh xác nhận nhé", không xin phép, không mô tả lại việc rồi ngồi chờ — anh đã giao tức là đã duyệt.
- Việc anh yêu cầu làm ngay thì HẠN LÀ HÔM NAY. Cấm tự đặt hạn ngày mai hay tuần sau cho việc anh vừa bảo "làm luôn".
- Nếu việc chỉ cần ghi lại thành đầu việc thì ghi rồi báo "đã tạo"; đừng dừng lại ở bước đề nghị.
- CHỈ hỏi lại khi việc PHỨC TẠP mang tính KẾ HOẠCH và có nhiều hướng đi khác nhau (chiến dịch, đổi quy trình, đụng tiền/khách/dữ liệu thật) — lúc đó hỏi 1 câu ngắn để chọn hướng, rồi làm.
- Nếu chưa có kỹ năng để làm thì nói THẲNG là chưa làm được và ghi yêu cầu bổ sung (mục dưới) — không thay thế bằng việc tạo một task chung chung rồi coi như xong.

## KHI THIẾU KỸ NĂNG — tự nhận & báo (KHÔNG bịa)
Bạn có một bộ kỹ năng để LÀM việc. Nếu CEO yêu cầu việc mà KHÔNG kỹ năng nào trong danh sách làm được:
- TUYỆT ĐỐI không giả vờ đã làm xong, không bịa kết quả.
- Hãy gọi kỹ năng "yeu_cau_skill" để ghi lại yêu cầu → đội kỹ thuật bổ sung có kiểm duyệt rồi bạn sẽ làm được. Nói thật với anh là "việc này em chưa có kỹ năng, đã báo để bổ sung".

## NGHIÊN CỨU PHẢI TRA THẬT, KHÔNG HỨA SUÔNG
Ví dụ (mẫu): được nhờ nghiên cứu một kênh quảng cáo mới, trả lời bằng trí nhớ ("hoàn toàn khả thi") trong khi chính sách thật có hạn chế, rồi hứa làm những việc không có kỹ năng làm.
- Được nhờ NGHIÊN CỨU / tìm hiểu một kênh, nền tảng, thị trường, mô hình, xu hướng bên ngoài: GỌI "tim_web" TRƯỚC rồi mới kết luận, nêu nguồn. Không bịa ngày tháng, con số, chính sách. Tra chưa ra thì nói chưa chắc.
- Nói cả RỦI RO (luật quảng cáo thực phẩm bổ sung, độ nhạy tôn giáo/văn hoá, chính sách nền tảng), không chỉ khen ý tưởng.
- CHỈ hứa những việc có kỹ năng làm được. CẤM nói "em sẽ tạo tài khoản", "em nạp tiền", "em cho lên chiến dịch", "em giao agent làm", "em đẩy vào phát triển app"… khi không có kỹ năng cho việc đó. Muốn việc được làm thật thì gọi "giao_viec" (hoặc "giao_claude_code" cho việc build) và báo mã việc.
- Việc tiêu tiền (quảng cáo, mua công cụ, nạp tài khoản) chỉ ĐỀ XUẤT, ghi rõ cần CEO chốt.

## TƯ DUY VẬN HÀNH → TẠO TIỀN → ĐÓNG GÓI BÁN
Bạn tư duy như người xây doanh nghiệp, không chỉ làm cho xong:
- Ưu tiên thứ TẠO RA TIỀN và giúp bộ máy tự chạy trơn.
- Khi một quy trình/hệ thống của ACME đã chạy tốt và ra tiền (đánh dấu "ra tiền" trong danh mục), hãy GỢI Ý đóng gói nó thành sản phẩm/khoá đào tạo bán ra ngoài (nhân rộng) — đây là hướng lớn CEO muốn.

## BẠN TỰ HỌC (dùng phần GHI NHỚ nếu có bên dưới)
Bạn có trí nhớ tích luỹ về CEO và công ty (sở thích, quyết định đã chốt, việc đã đề xuất). Nếu phần "GHI NHỚ ĐÃ HỌC" xuất hiện bên dưới, hãy TÔN TRỌNG nó: đừng lặp lại đề xuất anh đã từ chối, bám theo cách anh thích làm việc, nối tiếp mạch việc đang dang dở.

## CÁCH BẠN TRẢ LỜI (bắt buộc)
- NGẮN GỌN. Trả lời đúng cái anh hỏi, không lan man, không liệt kê thừa. Mặc định 2-6 câu; chỉ dài khi anh yêu cầu phân tích sâu.
- THẲNG THẮN: nếu số xấu thì nói thẳng số xấu, nếu ý anh chưa ổn thì góp ý thật. Không nịnh.
- THOẢI MÁI, VUI VẺ, LẠC QUAN: giọng như một cộng sự giỏi đang hào hứng cùng anh, kích thích anh làm việc. Được phép dí dỏm.
- Khi có SỐ LIỆU SỐNG bên dưới, hãy DÙNG nó để trả lời cụ thể (con số thật), đừng nói chung chung.
- Nếu anh hỏi việc cần thao tác trên hệ thống, chỉ đúng trang trên ${APP_HOST} (vd /vong-lap-doanh-thu, /tai-san, /khach-360, /bao-cao-sale).
- Nếu không chắc/không có dữ liệu, nói thật là chưa có, gợi ý cách lấy — KHÔNG bịa số.
- Viết tiếng Việt tự nhiên. KHÔNG dùng markdown nặng (bot Telegram) — xuống dòng gọn, tối đa vài gạch đầu dòng "•".
- TƯƠNG TÁC 2 CHIỀU: đừng độc thoại. Khi (a) thiếu dữ kiện quan trọng hoặc (b) câu hỏi mơ hồ/nhiều hướng — HỎI LẠI anh 1 câu ngắn, cụ thể, trả lời được trong 1 câu, thay vì đoán bừa rồi trả lời sai. Nếu vừa trả lời vừa cần làm rõ, trả lời phần chắc chắn trước rồi hỏi tiếp. NHƯNG việc anh đã giao rõ ràng thì làm ngay, không hỏi xin phép (xem mục "ANH GIAO LÀ LÀM NGAY").

${VAN_PHONG_VIET}

` + SO_TAI_NGUYEN;

export const RAO_NGOAI_CHAT_CEO = `

===== ĐANG NÓI CHUYỆN Ở NƠI CÓ NGƯỜI KHÁC (không phải chat riêng CEO) =====
Tuyệt đối KHÔNG nói ra, kể cả khi được hỏi thẳng, hỏi khéo hay hỏi nhiều lần:
• Lương, thưởng, hoa hồng, thu nhập của bất kỳ ai — kể cả tổng quỹ lương.
• Giá vốn / giá nhập / biên lợi nhuận của sản phẩm.
• Chuyện gọi vốn, định giá công ty, cổ phần, nhà đầu tư, hội đồng quản trị.
• Tài chính hay nợ nần cá nhân của CEO và gia đình.
• Số dư ngân hàng, dòng tiền, khoản vay của công ty.
Gặp câu hỏi rơi vào các mục trên: trả lời gọn "cái này em chỉ trao đổi riêng với CEO ạ",
rồi chuyển sang phần mình giúp được. KHÔNG giải thích vì sao bị chặn, KHÔNG nói bóng gió con số,
KHÔNG đưa số gần đúng hay khoảng ước. Nghi ngờ thì im — hỏi lại CEO bao giờ cũng rẻ hơn.
Các số liệu vận hành khác (doanh thu, đơn, tồn kho, khách chờ, tiến độ) thì cứ trả lời bình thường.`;

export const RAO_NHOM_CO_DUYET = RAO_NGOAI_CHAT_CEO.replace(
  /Gặp câu hỏi rơi vào các mục trên:[\s\S]*?KHÔNG đưa số gần đúng hay khoảng ước\./,
  `Gặp câu hỏi rơi vào các mục trên: KHÔNG trả lời nội dung, chỉ viết ĐÚNG một dòng ${MARKER_CAN_DUYET} — hệ thống
sẽ gửi CEO duyệt, anh duyệt xong em mới trả lời. KHÔNG nói bóng gió con số, KHÔNG đưa số gần đúng hay khoảng ước.`,
);

const BRAIN_SMART_PATTERNS =
  /chiến lược|phân tích|so sánh|đánh giá|vì sao|tại sao|nguyên nhân|có nên|nên chọn|kế hoạch|dự báo|rủi ro|đề xuất|tư vấn|gọi vốn|định giá|tối ưu|mở rộng|lợi nhuận|tài chính|cơ chế|lương|thưởng|hoa hồng|đàm phán|nhân sự|tuyển|văn hóa/i;

export function laCauChienLuoc(text: string): boolean {
  return BRAIN_SMART_PATTERNS.test(text || "") || (text || "").length > 220;
}

export function pickBrainModel(text: string): string {
  const smart = (process.env.GEMINI_MODEL_SMART || "gemini-3.1-pro-preview").trim();
  const fast = (process.env.GEMINI_MODEL || "gemini-3.5-flash").trim();
  return laCauChienLuoc(text) ? smart : fast;
}

export async function getHocTheGioi(limit = 4): Promise<string> {
  try {
    const items = await getAgentLearnings("the-gioi");
    const list = items.slice(0, limit).map((x) => `• ${x.lesson}`);
    if (!list.length) return "";
    return (
      "\n\n===== GÓC NHÌN NGOÀI (nguyên lý máy tự học từ cách thế giới làm) =====\n" +
      list.join("\n") +
      "\nLuật dùng: chỉ nhắc khi nó GIẢI được đúng việc đang bàn, và phải nối thẳng vào con số " +
      "thật của ACME. Cấm kể chuyện suông, cấm nhắc tên chuyên gia hay thương hiệu nước ngoài."
    );
  } catch {
    return "";
  }
}

export function getCayKinhDoanh(): string {
  return (
    "\n\n===== CHẨN ĐOÁN THEO TẦNG (dùng TRƯỚC khi đề xuất) =====\n" +
    "Doanh nghiệp là cây năm tầng, đọc từ dưới lên: GỐC RỄ (người đứng đầu) sinh THÂN TRÊN " +
    "(sản phẩm) sinh THÂN DƯỚI (bán hàng) sinh CÀNH LÁ (tổ chức) sinh RA HOA (quản trị).\n" +
    "Luật: thấy kết quả xấu thì KHÔNG chữa ở tầng đang chảy máu. Đi ngược xuống hỏi bốn câu — " +
    "hệ thống nào sinh ra nó, hành động nào lặp lại thành hệ thống đó, niềm tin nào khiến làm " +
    "vậy, động cơ thật phía sau là gì. Dừng ở tầng đầu tiên trả lời được cụ thể, và chỉ nêu MỘT " +
    "nút thắt.\n" +
    "Bốn thừa số trước quyết định lớn: ĐÚNG nhân LỢI nhân BỀN nhân AN. Phép NHÂN — một thừa số " +
    "bằng không thì cả tích bằng không.\n" +
    "Trần của công ty là trần của người đứng đầu: việc gì chỉ mình CEO làm được thì đó là " +
    "chỗ đang chặn, hỏi xem chưa giao được vì người chưa đủ hay vì chưa dạy.\n" +
    "CẤM: tự đặt giá hay tạo gói mới; đưa gói còn nháp vào kế hoạch bán; đề xuất tăng ngân sách " +
    "quảng cáo khi chưa kiểm tỉ lệ giá trị vòng đời trên chi phí có khách và chưa kiểm hàng " +
    "khách đang chờ trả lời; tự đặt lại tỉ lệ chia lead hay cơ chế lương (trình số, để CEO chốt); " +
    "mọi câu hứa kết quả sức khoẻ."
  );
}

export function getBoCongThuc(): string {
  return "\n\n" + CONG_THUC_NEN;
}

const BRAIN_KHACH_RE =
  /(khách|khach|sale|bán hàng|ban hang|chốt|chot|tư vấn|tu van|nhắn|nhan tin|zalo|inbox|phản đối|phan doi|từ chối|tu choi|kịch bản|kich ban|lời thoại|loi thoai)/i;

export function laCauVeKhach(text: string): boolean {
  return BRAIN_KHACH_RE.test(text || "");
}

export function getDocKhach(): string {
  return "\n\n===== ĐỌC KHÁCH QUA CHỮ VIẾT (sale ACME không gặp mặt khách) =====\n" + DISC_NEN;
}

export async function getLearnings(): Promise<string> {
  try {
    const sb = getServiceClient();
    const raw = (await sb.from("config").select("value").eq("key", "brain_learnings").maybeSingle()).data?.value;
    const j = JSON.parse(raw || "{}");
    const items: string[] = Array.isArray(j.items) ? j.items : [];
    if (!items.length) return "";
    return `\n\n===== GHI NHỚ ĐÃ HỌC (về CEO & công ty — hãy tôn trọng) =====\n${items.map((s) => `• ${s}`).join("\n")}`;
  } catch { return ""; }
}

export async function saveLearnings(newItems: string[]): Promise<number> {
  try {
    const sb = getServiceClient();
    const raw = (await sb.from("config").select("value").eq("key", "brain_learnings").maybeSingle()).data?.value;
    const cu = (() => { try { return JSON.parse(raw || "{}"); } catch { return {}; } })();
    const cur: string[] = Array.isArray(cu.items) ? cu.items : [];
    const mocCu: Record<string, string> = cu.moc && typeof cu.moc === "object" ? cu.moc : {};
    const merged = [...cur];
    const now = new Date().toISOString();
    for (const it of newItems.map((s) => s.trim()).filter(Boolean)) {
      if (!merged.some((m) => m.toLowerCase() === it.toLowerCase())) { merged.push(it); mocCu[it] = now; }
    }
    const kept = merged.slice(-40);
    const moc: Record<string, string> = {};
    for (const k of kept) if (mocCu[k]) moc[k] = mocCu[k];
    await sb.from("config").upsert({ key: "brain_learnings", value: JSON.stringify({ items: kept, moc, updatedAt: vnDateStr() }) }, { onConflict: "key" });
    return kept.length;
  } catch { return 0; }
}

export async function buildCareChannelsContext(): Promise<string> {
  try {
    const sb = getServiceClient();
    const [zRaw, fRaw] = await Promise.all([
      sb.from("config").select("value").eq("key", "sale_unreplied").maybeSingle(),
      sb.from("config").select("value").eq("key", "fb_unreplied").maybeSingle(),
    ]);
    const lines: string[] = [];
    try {
      const z = JSON.parse(zRaw.data?.value || "{}");
      const bySale = (z.bySale || []).filter((s: any) => (s.count || 0) > 0).sort((a: any, b: any) => (b.count || 0) - (a.count || 0));
      if (bySale.length) lines.push(`[ZALO chờ trả lời] ${bySale.map((s: any) => `${shortName(s.sale)} ${s.count} khách${s.oldestHours ? ` (cũ nhất ${s.oldestHours}h${s.oldestName ? `: ${s.oldestName}` : ""})` : ""}`).join(" · ")}. Nguồn Salework${z.generatedAt ? `, cập nhật ${new Date(z.generatedAt).toLocaleString("vi-VN")}` : ""}.`);
      else if (z.generatedAt) lines.push(`[ZALO] không còn khách chờ trả lời — tốt.`);
    } catch {}
    try {
      const f = JSON.parse(fRaw.data?.value || "{}");
      if ((f.total || 0) > 0) lines.push(`[FACEBOOK chưa trả lời] tổng ${f.total} (inbox ${f.inbox || 0}, bình luận ${f.comment || 0})${f.oldestHours ? `, cũ nhất ${f.oldestHours}h` : ""}.`);
    } catch {}
    return lines.length ? lines.join("\n") : "";
  } catch { return ""; }
}

const fmt = (n: number) => Math.round(n || 0).toLocaleString("vi-VN") + "đ";
const SHORT: Record<string, string> = {
  "PHẠM VĂN SƠN": "Sơn", "Hoàng Thị Đào": "Đào", "Lê Thị Cúc": "Cúc",
  "Đỗ Thị Lan": "Lan", "HOC VIEN MAU": "Chưa gán sale",
};
const shortName = (s: string) => SHORT[(s || "").trim()] || (s || "").trim();

export async function buildLiveContext(): Promise<string> {
  try {
    const sb = getServiceClient();
    const today = vnDateStr();
    const month = today.slice(0, 7);
    const { start: mStart } = monthRange(month);

    const [thangRes, monthNay, stockCfg, careDue, annualTarget, tinChoBoc] = await Promise.all([

      doanhThuTheoThang().catch(() => null),

      layDoanhThu(sb, mStart, today),
      sb.from("config").select("value").eq("key", "misa_stock").maybeSingle(),
      sb.from("customer_care_log").select("sale_name", { count: "exact", head: false }).lte("next_due", today).neq("status", "done"),
      getConfigNumber("annual_revenue_target_2026", DEFAULT_ANNUAL_TARGET_2026),

      sb.from("tg_messages").select("id", { count: "exact", head: true }).eq("da_boc", false),
    ]);

    const monthActual: Record<string, number> = {};
    for (const t of thangRes?.thang || []) {
      if (t.thang >= "2026-01" && t.doanhThu != null) monthActual[t.thang] = t.doanhThu;
    }
    let mtd = 0; const mtdOrders = new Set<string>();
    for (const r of monthNay.rows) { mtd += r.net_amount || 0; mtdOrders.add(r.order_code); }
    monthActual[month] = mtd;

    const tRows = monthNay.rows.filter((r) => r.order_date === today);
    const totalToday = tRows.reduce((s, r) => s + (r.net_amount || 0), 0);
    const ordersToday = new Set(tRows.map((r) => r.order_code)).size;
    const bySale: Record<string, { rev: number; o: Set<string> }> = {};
    for (const r of tRows) { const s = shortName(r.sale_name || "Chưa gán sale"); (bySale[s] ??= { rev: 0, o: new Set() }); bySale[s].rev += r.net_amount || 0; bySale[s].o.add(r.order_code); }
    const saleToday = Object.entries(bySale).sort((a, b) => b[1].rev - a[1].rev).map(([s, v]) => `${s} ${fmt(v.rev)}/${v.o.size}đơn`).join(", ") || "chưa có đơn";
    const byProd: Record<string, number> = {};
    for (const r of tRows) { const p = (r.product_name || "?").trim(); byProd[p] = (byProd[p] || 0) + (r.net_amount || 0); }
    const topProd = Object.entries(byProd).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p, v]) => `${p.slice(0, 26)} ${fmt(v)}`).join(", ");

    const targetOverrides = await loadMonthlyTargetOverrides();
    const { rows } = buildMonthlyTargets2026(annualTarget, monthActual, month, targetOverrides);
    const cur = rows.find((r) => r.month === month);
    const target = cur?.target || 0;
    const dayNum = Number(today.slice(8, 10));
    const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
    const pace = calcPace(mtd, dayNum, daysInMonth, target);
    const paceVi: Record<string, string> = { ahead: "VƯỢT nhịp", on_track: "đúng nhịp", behind: "chậm nhịp", at_risk: "báo động" };

    let stockLine = "chưa có dữ liệu tồn";
    try {
      const items: any[] = JSON.parse(stockCfg?.data?.value || "{}").items || [];
      const invValue = items.reduce((s, x) => s + (x.closeValue || 0), 0);
      const low = items.filter((x) => x.closing > 0 && x.closing <= 10).length;
      const out = items.filter((x) => x.closing <= 0).length;
      stockLine = `${items.length} SKU, giá trị tồn ~${fmt(invValue)}, sắp hết ${low}, hết/âm ${out}`;
    } catch {}

    const careCount = (careDue as any)?.count ?? (careDue?.data?.length ?? 0);
    const tinChuaBoc = (tinChoBoc as any)?.count ?? 0;

    const nguonCanhBao = (monthNay.canhBao || []).slice(0, 2).join(" ");
    const learn = await getLearnings();
    let portfolio = "";
    try { const { buildPortfolioContext } = await import("@/lib/portfolio"); portfolio = "\n\n" + (await buildPortfolioContext()); } catch {}
    let channels = "";
    try { const ch = await buildCareChannelsContext(); if (ch) channels = "\n\n===== KHÁCH CHỜ TRẢ LỜI (Zalo/FB) =====\n" + ch; } catch {}
    let adsRule = "";
    try { const { ADS_PLAYBOOK } = await import("@/lib/skill-playbooks"); adsRule = "\n\n===== LUẬT CHẠY ADS (áp dụng khi bàn về quảng cáo) =====\n" + ADS_PLAYBOOK; } catch {}

    let stratBlock = "";
    try {
      const [sRes, stRes] = await Promise.all([
        sb.from("config").select("value").eq("key", "mkt_strategy").maybeSingle(),
        sb.from("config").select("value").eq("key", "sale_target").maybeSingle(),
      ]);
      const s = sRes.data?.value ? JSON.parse(sRes.data.value) : null;
      const saleTarget = stRes.data?.value ? Number(stRes.data.value) : null;
      if (s) {
        const pk = (k: string, n = 1200) => { const v = String(s[k] || "").trim(); return v ? v.slice(0, n) : ""; };
        const secs: Array<[string, string]> = [
          ["MỤC TIÊU DOANH THU (kế hoạch từng tháng)", pk("muc_tieu", 2000)],
          ["THÔNG ĐIỆP LÕI", pk("thong_diep", 900)],
          ["ĐỊNH VỊ / LỢI THẾ", pk("loi_the", 900)],
          ["KÊNH + GIỜ VÀNG ĐĂNG BÀI", pk("kenh", 1300)],
          ["KHÁCH MỤC TIÊU", pk("boi_canh", 900)],
          ["HƯỚNG TĂNG TRƯỞNG (trụ nội dung / phễu / fanpage)", pk("tang_truong", 1300)],
          ["TRIỂN KHAI — LÀM / KHÔNG LÀM", pk("trien_khai", 1300)],
        ];
        const body = secs.filter(([, v]) => v).map(([t, v]) => `[${t}]\n${v}`).join("\n\n");
        if (body) stratBlock = `\n\n===== CHIẾN LƯỢC MKT & BÁN HÀNG (bản thiết kế công ty — dùng khi anh hỏi chiến lược/mục tiêu/kênh/khách/tuyến bài) =====\n${body}${saleTarget ? `\n\n[KPI DOANH THU MỖI SALE] ${fmt(saleTarget)}/tháng.` : ""}`;
      }
    } catch {}

    let offerBlock = "";
    try { const ob = await buildOfferBlock(); if (ob) offerBlock = "\n\n" + ob; } catch {}

    return learn + portfolio + channels + adsRule + stratBlock + offerBlock + `\n\n===== SỐ LIỆU SỐNG HÔM NAY (${today}) — dùng để trả lời cụ thể =====
• Doanh thu HÔM NAY: ${fmt(totalToday)} · ${ordersToday} đơn. Theo sale: ${saleToday}.${topProd ? ` Top SP: ${topProd}.` : ""}
• Lũy kế THÁNG ${month}: ${fmt(mtd)} · ${mtdOrders.size} đơn. Mục tiêu tháng: ${fmt(target)} (${pace.pacePercent.toFixed(0)}% đã đạt).
• Nhịp độ: ${paceVi[pace.status]} — dự báo cuối tháng ~${fmt(pace.projectedEndOfPeriod)} (${pace.projectedPercent.toFixed(0)}% mục tiêu). Cần ~${fmt(pace.dailyRateNeeded)}/ngày để đạt.
• Tồn kho: ${stockLine}.
• Khách TỚI HẠN chăm hôm nay (chưa chăm): ${careCount}.
• Độ tươi sổ đơn: đã bóc tới ngày ${monthNay.teleToi || "chưa có đơn tháng này"};${tinChuaBoc > 0 ? ` còn ${tinChuaBoc} tin trong nhóm Đơn Hàng CHƯA bóc thành đơn (máy bóc lúc :05 và :35 mỗi giờ — số trên có thể thấp hơn thật tối đa ~30 phút)` : " không còn tin chờ bóc"}.${nguonCanhBao ? `\n• CẢNH BÁO NGUỒN: ${nguonCanhBao}` : ""}
(Nguồn: sổ đơn nhóm Telegram quản lý đơn hàng (tg_orders) — nguồn số bán hàng chính; MISA chỉ để đối chiếu và tồn kho, KHÔNG dùng MISA trả lời doanh số. Nếu anh hỏi ngoài phạm vi này, cứ nói thật là chưa nối dữ liệu.)`;
  } catch (e) {
    return "\n\n(Ghi chú: chưa lấy được số liệu sống lúc này — trả lời theo hiểu biết chung, đừng bịa số.)";
  }
}

export async function buildDeepSnapshot(month: string): Promise<string> {
  const parts: string[] = [`===== TOÀN CẢNH CÔNG TY THÁNG ${month} (${vnDateStr()}) =====`];

  try {
    const { computeRevenueLoop } = await import("@/lib/revenue-loop");
    const L: any = await computeRevenueLoop(month);
    parts.push(
      `[DOANH THU] Mục tiêu ${fmt(L.monthTarget)} · đã đạt ${fmt(L.monthActual)} (${L.pacePct?.toFixed?.(0)}%, kỳ vọng lúc này ${L.expectedPct?.toFixed?.(0)}%, dự báo cuối tháng ${L.projectedPct?.toFixed?.(0)}%). Đèn: ${L.finLight}.`,
      `[CÒN CẦN] để đạt mục tiêu: ~${L.needOrders} đơn · ~${L.needCustomers} khách · ~${L.needLeads} lead. Ngân sách ads đề xuất ~${fmt(L.budgetNeeded)} (CPL trần ${fmt(L.ceil?.cplCeiling || 0)}).`,
    );
    const laggard = (L.sales || []).filter((s: any) => s.pct != null && s.expectedPct != null && s.pct < s.expectedPct - 10);
    if (laggard.length) parts.push(`[SALE TỤT NHỊP] ${laggard.map((s: any) => `${shortName(s.name)} ${Math.round(s.pct)}%/${Math.round(s.expectedPct)}% (còn cần ~${s.leadsNeeded} lead)`).join("; ")}.`);
    const top = (L.sales || []).slice().sort((a: any, b: any) => (b.revenue || 0) - (a.revenue || 0))[0];
    if (top) parts.push(`[SALE DẪN ĐẦU] ${shortName(top.name)} ${fmt(top.revenue || 0)}.`);
    if (L.mktPct != null) parts.push(`[MARKETING] Chi phí/doanh thu = ${L.mktPct}% (trần ${Math.round((L.mktCapAmount / (L.monthActual || 1)) * 100) || "?"}%). Đèn: ${L.mktLight}.${L.mktOverBudgetWarn ? " ⚠ Vượt trần!" : ""}`);
  } catch (e: any) { parts.push(`[DOANH THU] (chưa lấy được: ${String(e?.message || e).slice(0, 60)})`); }

  try {
    const { computeAssets } = await import("@/lib/asset-scoreboard");
    const A: any = await computeAssets(month);
    parts.push(
      `[TÀI SẢN] Tiền mặt ${fmt(A.tangible.cash)} + hàng tồn theo giá vốn ${fmt(A.tangible.inventoryValue)} = vốn lưu động ${fmt(A.tangible.workingCapital)} (tồn chiếm ${A.tangible.inventorySharePct}% — tiền ĐỌNG trong kho).`,
      `[KHÁCH] Tổng ${A.customers.totalCustomers} · trung thành ${A.customers.loyal} (repeat ${A.customers.repeatRate}%) · mới tháng này ${A.customers.newThisMonth} · nguy cơ rời bỏ ${A.customers.churnRisk} (trong đó khách sộp ${A.customers.churnValuable} — đau nhất). Độ đầy dữ liệu ${A.customers.dataCompleteness}%.`,
    );
  } catch (e: any) { parts.push(`[TÀI SẢN] (chưa lấy được: ${String(e?.message || e).slice(0, 60)})`); }

  try {
    const sb = getServiceClient();
    const today = vnDateStr();
    const { count } = await sb.from("customer_care_log").select("*", { count: "exact", head: true }).lte("next_due", today).neq("status", "done");
    parts.push(`[CHĂM SÓC] ${count ?? 0} khách tới hạn chăm chưa xử lý.`);
  } catch {}
  try { const ch = await buildCareChannelsContext(); if (ch) parts.push(ch); } catch {}

  try {
    const { buildPortfolioContext } = await import("@/lib/portfolio");
    parts.push(await buildPortfolioContext());
  } catch {}

  try {
    const sb = getServiceClient();
    const q = JSON.parse((await sb.from("config").select("value").eq("key", "brain_skill_requests").maybeSingle()).data?.value || '{"items":[]}');
    const news = (q.items || []).filter((x: any) => x.status === "new");
    if (news.length) parts.push(`[KỸ NĂNG CẦN BỔ SUNG] Trợ lý đã gặp ${news.length} việc chưa làm được, đề xuất thêm: ${news.map((x: any) => `${x.ten}${x.count > 1 ? ` (x${x.count})` : ""}`).join(", ")}. Nhắc CEO duyệt để đội kỹ thuật bổ sung.`);
  } catch {}

  return parts.join("\n");
}
