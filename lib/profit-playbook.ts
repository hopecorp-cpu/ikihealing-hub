import { getServiceClient } from "@/lib/supabase-server";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { computeRevenueLoop, type RevenueLoopData } from "@/lib/revenue-loop";
import { computeAssets, type AssetScore } from "@/lib/asset-scoreboard";
import { analyzeKm, type KmReport, type LineRow } from "@/lib/km-analysis";
import { getOffers, type Offer } from "@/lib/offer-architecture";
import { vnDateStr } from "@/lib/payroll";

export const LEVERS = {
  GIA_GOI: "Giá & Gói (offer)",
  AOV: "Nâng giá trị đơn (AOV)",
  CHUYEN_DOI: "Tỉ lệ chốt (conversion)",
  GIU_CHAN: "Giữ chân & LTV",
  ADS: "Quảng cáo & Traffic",
  TON_KHO: "Tồn kho & vốn đọng",
  CHI_PHI: "Chi phí & biên",
  KENH: "Kênh & cộng đồng",
} as const;
export type Lever = keyof typeof LEVERS;

export type ProfitSnapshot = {
  month: string; today: string; dayOfMonth: number; daysLeft: number;
  loop: RevenueLoopData;
  assets: AssetScore | null;
  km: KmReport | null; kmVang: string | null;
  unrepliedZalo: number; unrepliedFb: number;
  offersDraft: number; offersChot: number; offers: Offer[];
  nextDoubleDay: { label: string; daysTo: number };
};

export type MetricKey =
  | "mtdRevenue" | "pacePct" | "projectedPct" | "aov" | "orders" | "customers"
  | "mktPct" | "mktSpend" | "leadsTotal" | "chatAvg" | "closeRatePct"
  | "repeatRate" | "churnRisk" | "inventoryValue" | "inventorySharePct" | "cash"
  | "unrepliedZalo" | "unrepliedFb" | "kmDiscountRate" | "offersChot";

export function metricValue(S: ProfitSnapshot, k: MetricKey): number | null {
  const L = S.loop, A = S.assets;
  switch (k) {
    case "mtdRevenue": return L.monthActual;
    case "pacePct": return L.pacePct;
    case "projectedPct": return L.projectedPct;
    case "aov": return L.teamAov;
    case "orders": return L.totalOrders;
    case "customers": return L.totalCustomers;
    case "mktPct": return L.mktPct ?? null;
    case "mktSpend": return L.mktSpend;
    case "leadsTotal": return L.leadsTotal;
    case "chatAvg": return L.chatAvg ?? null;
    case "closeRatePct": return L.callCloseReal;
    case "repeatRate": return A?.customers.repeatRate ?? null;
    case "churnRisk": return A?.customers.churnRisk ?? null;
    case "inventoryValue": return A?.tangible.inventoryValue ?? null;
    case "inventorySharePct": return A?.tangible.inventorySharePct ?? null;
    case "cash": return A?.tangible.cash ?? null;
    case "unrepliedZalo": return S.unrepliedZalo;
    case "unrepliedFb": return S.unrepliedFb;
    case "kmDiscountRate": return S.km?.overall.discountRate ?? null;
    case "offersChot": return S.offersChot;
  }
}

export type Play = {
  id: string; lever: Lever; ten: string;
  viec: string;
  kpi: MetricKey; kpiDir: "up" | "down"; doSauNgay: number;
  when: (S: ProfitSnapshot) => { score: number; evidence: string } | null;
};

const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n || 0)) + "đ";
const tr = (n: number) => `${Math.round((n || 0) / 1e5) / 10}tr`;
const on = (c: boolean, score: number, evidence: string) => (c ? { score, evidence } : null);

export const PLAYS: Play[] = [

  { id: "GG01", lever: "GIA_GOI", ten: "Chốt kết cấu combo/thẻ/quà đang treo draft", viec: "Vào /ket-cau-ban-hang duyệt các offer draft (S1-S6, Thẻ Vàng, Prepay) — chưa chốt thì sale/content không có gì để bán.", kpi: "offersChot", kpiDir: "up", doSauNgay: 3,
    when: S => on(S.offersDraft > 0, 90 + S.offersDraft, `${S.offersDraft} offer đang draft, mới ${S.offersChot} offer chốt`) },
  { id: "GG02", lever: "GIA_GOI", ten: "Tung hero combo của tháng", viec: "Đẩy hero combo tháng này (theo kế hoạch Q3Q4) lên page + Zalo: 1 bài BOFU + kịch bản sale + quà kèm rõ ràng.", kpi: "aov", kpiDir: "up", doSauNgay: 7,
    when: S => on(S.offersChot > 0 && S.loop.pacePct < S.loop.expectedPct, 80, `đang chậm nhịp (${S.loop.pacePct}%/${S.loop.expectedPct}%) mà hero combo chưa chạy mạnh`) },
  { id: "GG03", lever: "GIA_GOI", ten: "Chuẩn bị Flash ngày đôi", viec: `Dựng flash theo khung FLASH-NGAY-DOI: chọn quà giới hạn 50 suất + đếm ngược 24h + bài đăng trước 2 ngày. KHÔNG giảm giá.`, kpi: "orders", kpiDir: "up", doSauNgay: 6,
    when: S => on(S.nextDoubleDay.daysTo <= 5, 85 - S.nextDoubleDay.daysTo * 5, `còn ${S.nextDoubleDay.daysTo} ngày tới ${S.nextDoubleDay.label}`) },
  { id: "GG04", lever: "GIA_GOI", ten: "Chào Prepay 6/12 cho khách trung thành", viec: "Lọc khách mua lặp lại, sale gọi chào gói trả trước 6/12 tháng (quà thêm hộp + Thẻ Vàng) — thu tiền trước, dòng tiền dương.", kpi: "cash", kpiDir: "up", doSauNgay: 10,
    when: S => on((S.assets?.customers.loyal || 0) >= 30, 70, `${S.assets?.customers.loyal} khách trung thành chưa được chào gói trả trước`) },
  { id: "GG05", lever: "GIA_GOI", ten: "Bật Auto-ship giữ LTV", viec: "Chào S5 Auto-ship cho khách vừa hết chu kỳ hộp đầu (mua 25-35 ngày trước): đăng ký nhận hằng tháng, quà Thẻ Vàng kỳ 3.", kpi: "repeatRate", kpiDir: "up", doSauNgay: 14,
    when: S => on((S.assets?.customers.repeatRate || 0) < 30 && S.loop.totalCustomers > 50, 65, `repeat rate mới ${S.assets?.customers.repeatRate}% — máy mua lặp chưa chạy`) },
  { id: "GG06", lever: "GIA_GOI", ten: "Dừng giảm giá — đổi sang quà", viec: "Đang có đơn giảm giá sâu: họp sale chuyển toàn bộ ưu đãi sang TẶNG QUÀ theo bậc (đúng luật + giữ biên).", kpi: "kmDiscountRate", kpiDir: "down", doSauNgay: 7,
    when: S => on((S.km?.overall.discountRate || 0) >= 8, 75 + Math.min(20, S.km!.overall.discountRate), `tỉ lệ giảm giá toàn hệ ${S.km?.overall.discountRate}% trên gross — tiền biên đang chảy ra`) },
  { id: "GG07", lever: "GIA_GOI", ten: "Cứu SP biên dưới sàn", viec: "Rà các SP đang bị cờ 'biên < 30%/bán lỗ' trong Phân tích khuyến mãi: tăng giá, gói lại thành combo, hoặc ngừng đẩy.", kpi: "kmDiscountRate", kpiDir: "down", doSauNgay: 7,
    when: S => on((S.km?.flags.length || 0) > 0, 70 + (S.km?.flags.length || 0) * 3, `${S.km?.flags.length} SP dính cờ phá giá/biên mỏng: ${(S.km?.flags || []).slice(0, 3).map(f => f.product).join(", ")}`) },
  { id: "GG08", lever: "GIA_GOI", ten: "Combo chặn AOV thấp", viec: "AOV đang thấp: ép mọi kênh chào từ combo S1 trở lên (không bán lẻ 1 SKU trên ads/landing), lẻ chỉ để upsell tại chốt.", kpi: "aov", kpiDir: "up", doSauNgay: 10,
    when: S => on(S.loop.teamAov > 0 && S.loop.teamAov < 1_000_000, 72, `AOV team ${fmt(S.loop.teamAov)} — dưới 1 triệu, đơn nhỏ ăn mòn phí vận hành`) },
  { id: "GG09", lever: "GIA_GOI", ten: "Gói quà biếu theo mùa", viec: "Sắp mùa quà (20/10, Tết): tung S6 Hộp Quà bán cho NGƯỜI TẶNG — thông điệp biếu sức khoẻ, giá trị cảm nhận cao.", kpi: "orders", kpiDir: "up", doSauNgay: 14,
    when: S => { const m = +S.month.slice(5, 7); return on(m === 9 || m === 10 || m === 12 || m === 1, 60, "đang vào mùa quà biếu — S6 là offer hợp thời điểm"); } },
  { id: "GG10", lever: "GIA_GOI", ten: "Đưa thang upsell vào Sales Playbook", viec: "Chuyển UPSELL-LADDER thành script trong /playbook: khách ở bậc nào chào bậc kế (Protein -> Trà -> Silver -> Workshop -> Combo).", kpi: "aov", kpiDir: "up", doSauNgay: 14,
    when: S => on(S.offersChot >= 3, 55, "đã có offer chốt nhưng sale chưa có thang chào chuẩn") },

  { id: "AO01", lever: "AOV", ten: "Cross-sell trà vào mọi đơn protein", viec: "Quy định cứng: mọi đơn Đạm Mẫu phải được chào thêm 1 trà (kịch bản 1 câu). Đo attach rate theo sale.", kpi: "aov", kpiDir: "up", doSauNgay: 10,
    when: S => on(S.loop.teamAov > 0 && S.loop.teamAov < 1_500_000, 68, `AOV ${fmt(S.loop.teamAov)} — mỗi đơn thêm 1 trà là AOV nhảy ngay`) },
  { id: "AO02", lever: "AOV", ten: "Bậc quà theo giá trị đơn", viec: "Công bố bậc quà: đơn 1,5tr tặng X, 3tr tặng X+Y, 5tr tặng X+Y+Z — kéo khách tự nâng đơn để chạm bậc.", kpi: "aov", kpiDir: "up", doSauNgay: 10,
    when: S => on(S.loop.teamAov > 0 && S.loop.teamAov < 2_000_000, 62, `AOV ${fmt(S.loop.teamAov)} — chưa có nấc thang kéo đơn lên`) },
  { id: "AO03", lever: "AOV", ten: "Upsell tại chốt đơn", viec: "Thêm câu chốt chuẩn vào playbook: 'Lấy thêm 1 hộp cho đủ chu trình, em gửi kèm quà X' — nói ĐÚNG lúc khách đồng ý mua.", kpi: "aov", kpiDir: "up", doSauNgay: 7,
    when: S => on(S.loop.totalOrders >= 30, 58, `${S.loop.totalOrders} đơn/tháng — mỗi cú upsell thành công cộng thẳng vào AOV`) },
  { id: "AO04", lever: "AOV", ten: "Đẩy bundle SP biên cao", viec: "Lấy 2-3 SP biên cao nhất (bảng gợi ý trong /vong-lap-doanh-thu) ghép bundle chào tuần này.", kpi: "aov", kpiDir: "up", doSauNgay: 7,
    when: S => on((S.loop.reco?.topMargin?.length || 0) >= 2, 56, `có sẵn ${S.loop.reco.topMargin.length} SP biên cao chưa được ghép bundle`) },
  { id: "AO05", lever: "AOV", ten: "Đích ads = combo, không bán lẻ", viec: "Đổi đích mọi chiến dịch ads về landing combo (S1/S2) thay vì SP lẻ — người bấm ads là người có nhu cầu mạnh nhất.", kpi: "aov", kpiDir: "up", doSauNgay: 10,
    when: S => on(S.loop.mktSpend > 0 && S.loop.teamAov < 1_500_000, 60, `đang đốt ${tr(S.loop.mktSpend)} ads mà AOV chỉ ${fmt(S.loop.teamAov)}`) },
  { id: "AO06", lever: "AOV", ten: "Freeship có ngưỡng", viec: "Đặt ngưỡng miễn phí giao từ 1,5tr (dưới ngưỡng thu phí thật) — cú hích tâm lý rẻ nhất để nâng đơn.", kpi: "aov", kpiDir: "up", doSauNgay: 10,
    when: S => on(S.loop.teamAov > 0 && S.loop.teamAov < 1_500_000, 54, `AOV ${fmt(S.loop.teamAov)} dưới ngưỡng 1,5tr`) },
  { id: "AO07", lever: "AOV", ten: "Gợi ý giỏ 'mua cùng nhau'", viec: "Trên website/sale page thêm khối 'thường mua cùng' (trà + protein) ngay dưới nút đặt hàng.", kpi: "aov", kpiDir: "up", doSauNgay: 14,
    when: S => on(S.loop.totalOrders >= 50, 45, "đơn web đủ nhiều để khối mua-cùng có tác dụng") },
  { id: "AO08", lever: "AOV", ten: "Quà bậc cao chỉ dành cho combo", viec: "Quà đắt giá (workshop, tư vấn 1-1) CHỈ gắn với S2/S3 — không phát đại trà, giữ giá trị cảm nhận.", kpi: "aov", kpiDir: "up", doSauNgay: 14,
    when: S => on(S.offersChot > 0, 40, "đã có offer chốt — cần kỷ luật phân bậc quà") },
  { id: "AO09", lever: "AOV", ten: "Bán chu trình thay vì bán hộp", viec: "Đào tạo sale 30 phút: chuyển ngôn ngữ từ 'mua mấy hộp' sang 'đi chu trình 3/6 tháng' — khớp định vị bán lối sống.", kpi: "aov", kpiDir: "up", doSauNgay: 14,
    when: S => on(S.loop.teamAov < 2_500_000, 50, `AOV ${fmt(S.loop.teamAov)} cho thấy khách đang mua HỘP, chưa mua CHU TRÌNH`) },
  { id: "AO10", lever: "AOV", ten: "Đơn hàng doanh nghiệp/nhóm", viec: "Chào gói mua chung cho các nhóm Zalo sẵn có: 5 người đặt chung = cả nhóm nhận quà workshop riêng.", kpi: "aov", kpiDir: "up", doSauNgay: 14,
    when: S => on(true, 35, "các nhóm Zalo là kênh đặt chung chưa khai thác") },

  { id: "CD01", lever: "CHUYEN_DOI", ten: "Dọn sạch chat Zalo tồn", viec: "Giao chỉ tiêu dứt điểm trong ngày cho từng sale — khách nhắn mà không ai trả lời là đơn rơi thẳng vào tay đối thủ.", kpi: "unrepliedZalo", kpiDir: "down", doSauNgay: 3,
    when: S => on(S.unrepliedZalo >= 50, 85 + Math.min(15, Math.floor(S.unrepliedZalo / 50)), `${S.unrepliedZalo} khách Zalo đang chờ trả lời`) },
  { id: "CD02", lever: "CHUYEN_DOI", ten: "Dọn sạch inbox Facebook tồn", viec: "Phân ca trực page rõ ràng, mục tiêu: inbox nào cũng được trả lời trong 15 phút giờ hành chính.", kpi: "unrepliedFb", kpiDir: "down", doSauNgay: 3,
    when: S => on(S.unrepliedFb >= 50, 82 + Math.min(15, Math.floor(S.unrepliedFb / 50)), `${S.unrepliedFb} khách Facebook chưa được trả lời`) },
  { id: "CD03", lever: "CHUYEN_DOI", ten: "Kèm 1-1 sale điểm chat thấp", viec: "Sale có điểm AI chấm tư vấn thấp: nghe lại 5 đoạn chat, kèm 1-1 theo script playbook, đo lại sau 1 tuần.", kpi: "chatAvg", kpiDir: "up", doSauNgay: 7,
    when: S => on((S.loop.chatAvg || 10) < 7, 66, `điểm tư vấn trung bình ${S.loop.chatAvg}/10`) },
  { id: "CD04", lever: "CHUYEN_DOI", ten: "Ép SLA gọi lead 15 phút", viec: "Lead mới phải được gọi trong 15 phút. Bật lại nhắc đích danh + công bố bảng % gọi sớm mỗi sáng.", kpi: "closeRatePct", kpiDir: "up", doSauNgay: 7,
    when: S => on(S.loop.needLeads > 0 && S.loop.leadsTotal > 0, 64, `tháng này cần ~${S.loop.needLeads} lead — từng lead phải được gọi nhanh`) },
  { id: "CD05", lever: "CHUYEN_DOI", ten: "Xử lý 5 từ chối hay gặp nhất", viec: "Gom 5 lý do từ chối phổ biến từ chat, viết câu trả lời chuẩn vào playbook, sale học thuộc trong 1 buổi.", kpi: "closeRatePct", kpiDir: "up", doSauNgay: 10,
    when: S => on((S.loop.callCloseReal || 100) < 20, 60, `tỉ lệ chốt gọi thật ${S.loop.callCloseReal ?? "?"}% — thấp là do vấp từ chối`) },
  { id: "CD06", lever: "CHUYEN_DOI", ten: "CTA từ khoá dưới mọi bài", viec: "Chuẩn hoá: bài nào cũng kết bằng CTA gõ TỪ KHOÁ (CÓ/QUAN TÂM/1-2-3-4) — công thức hay dùng cho page (mẫu).", kpi: "leadsTotal", kpiDir: "up", doSauNgay: 7,
    when: S => on(true, 48, "CTA từ khoá là công thức phổ biến cho bài đăng (mẫu)") },
  { id: "CD07", lever: "CHUYEN_DOI", ten: "Follow-up 3 chạm cho lead nguội", viec: "Lead 3-7 ngày chưa chốt: kịch bản 3 chạm (giá trị - câu chuyện - offer nhẹ) qua Zalo, không spam bán hàng.", kpi: "closeRatePct", kpiDir: "up", doSauNgay: 10,
    when: S => on(S.loop.leadsTotal >= 30, 52, `${S.loop.leadsTotal} lead trong tháng — phần lớn chết vì không ai theo tiếp`) },
  { id: "CD08", lever: "CHUYEN_DOI", ten: "Social proof cạnh nút đặt hàng", viec: "Thêm 3 phản hồi khách thật (ảnh chụp màn hình, xin phép trước) vào sale page ngay cạnh nút đặt.", kpi: "orders", kpiDir: "up", doSauNgay: 7,
    when: S => on(true, 40, "sale page đang thiếu bằng chứng xã hội tại điểm quyết định") },
  { id: "CD09", lever: "CHUYEN_DOI", ten: "Rút ngắn form đặt hàng", viec: "Form đặt chỉ giữ Tên + SĐT + Địa chỉ. Mỗi ô thừa là rơi bớt khách.", kpi: "orders", kpiDir: "up", doSauNgay: 7,
    when: S => on(true, 35, "kiểm tra form các sale page — ô thừa nào cũng có giá") },
  { id: "CD10", lever: "CHUYEN_DOI", ten: "Gọi lại giỏ hàng bỏ dở", viec: "Khách điền form nhưng không hoàn tất: gọi lại trong 24h với 1 quà nhỏ 'giữ chỗ'.", kpi: "orders", kpiDir: "up", doSauNgay: 10,
    when: S => on(S.loop.totalOrders >= 30, 42, "đơn rơi ở bước cuối là đơn rẻ nhất để cứu") },

  { id: "GC01", lever: "GIU_CHAN", ten: "Cứu khách sộp sắp rời bỏ", viec: "Danh sách khách chi tiêu cao 60-90 ngày chưa quay lại: sale gọi hỏi thăm THẬT (không bán), kèm quà tri ân nhỏ.", kpi: "churnRisk", kpiDir: "down", doSauNgay: 10,
    when: S => on((S.assets?.customers.churnValuable || 0) > 0, 88, `${S.assets?.customers.churnValuable} khách SỘP đang trong vùng rời bỏ — đau nhất`) },
  { id: "GC02", lever: "GIU_CHAN", ten: "Chăm khách tới chu kỳ tái mua", viec: "Khách mua 45-90 ngày trước là đến chu kỳ hết hộp: nhắn hỏi trải nghiệm + gợi ý chu trình tiếp theo.", kpi: "repeatRate", kpiDir: "up", doSauNgay: 10,
    when: S => on((S.assets?.customers.churnRisk || 0) >= 20, 74, `${S.assets?.customers.churnRisk} khách trong vùng cần chăm lại`) },
  { id: "GC03", lever: "GIU_CHAN", ten: "Nghi thức sau bán 3 chạm", viec: "Chuẩn hoá: ngày 1 cảm ơn + hướng dẫn dùng, ngày 7 hỏi trải nghiệm, ngày 25 gợi ý duy trì. Ghi vào care log.", kpi: "repeatRate", kpiDir: "up", doSauNgay: 14,
    when: S => on((S.assets?.customers.repeatRate || 0) < 25, 68, `repeat rate ${S.assets?.customers.repeatRate}% — khách mua 1 lần rồi im`) },
  { id: "GC04", lever: "GIU_CHAN", ten: "Trao Thẻ Vàng đợt đầu", viec: "Lọc khách đạt điều kiện Thẻ Vàng (tích luỹ 5tr/mua S3), trao thẻ + công bố quyền lợi — biến khách to thành người nhà.", kpi: "repeatRate", kpiDir: "up", doSauNgay: 14,
    when: S => on((S.assets?.customers.loyal || 0) >= 20 && S.offersChot > 0, 58, `${S.assets?.customers.loyal} khách trung thành xứng đáng được công nhận`) },
  { id: "GC05", lever: "GIU_CHAN", ten: "Win-back khách im 6 tháng", viec: "Chiến dịch nhắn 'lâu rồi không gặp' + quà quay lại (KHÔNG giảm giá) cho tệp khách cũ im lặng.", kpi: "customers", kpiDir: "up", doSauNgay: 14,
    when: S => on((S.assets?.customers.totalCustomers || 0) > 300, 50, "kho khách cũ lớn — gọi lại rẻ hơn nhiều so với mua khách mới") },
  { id: "GC06", lever: "GIU_CHAN", ten: "Referral tặng quà kép", viec: "Khách giới thiệu bạn: cả 2 cùng nhận quà (ebook/workshop/trà). Công bố trong nhóm Zalo + sau mỗi đơn thành công.", kpi: "customers", kpiDir: "up", doSauNgay: 14,
    when: S => on((S.assets?.customers.repeatRate || 0) >= 15, 52, "khách đã tin thì giới thiệu — chỉ thiếu cái cớ và phần quà") },
  { id: "GC07", lever: "GIU_CHAN", ten: "Sổ tay dùng sản phẩm 30 ngày", viec: "Ebook/chuỗi tin nhắn 30 ngày đồng hành theo hộp đầu tiên — khách dùng ĐÚNG và ĐỦ thì mới thấy khác biệt và mua lại.", kpi: "repeatRate", kpiDir: "up", doSauNgay: 21,
    when: S => on((S.assets?.customers.repeatRate || 0) < 30, 48, "khách bỏ dở giữa chừng thì không bao giờ tái mua") },
  { id: "GC08", lever: "GIU_CHAN", ten: "Zoom cộng đồng hằng tháng", viec: "1 buổi Zoom dưỡng sinh mở cho mọi khách đã mua — nuôi cộng đồng, cửa vào của Silver Member.", kpi: "repeatRate", kpiDir: "up", doSauNgay: 21,
    when: S => on(true, 38, "cộng đồng là hào nước giữ khách mà đối thủ khó sao chép") },
  { id: "GC09", lever: "GIU_CHAN", ten: "Đo NPS nhanh sau đơn", viec: "Sau giao hàng 7 ngày hỏi 1 câu: 'Chấm mấy điểm? Vì sao?' — điểm thấp gọi lại ngay, điểm cao xin referral.", kpi: "repeatRate", kpiDir: "up", doSauNgay: 14,
    when: S => on(S.loop.totalOrders >= 50, 36, "chưa có vòng nghe khách sau bán có hệ thống") },
  { id: "GC10", lever: "GIU_CHAN", ten: "Hoàn thiện hồ sơ khách", viec: "Bổ sung SĐT/ngày sinh/kênh cho hồ sơ khách thiếu dữ liệu — không có dữ liệu thì mọi chiến dịch giữ chân đều mù.", kpi: "customers", kpiDir: "up", doSauNgay: 14,
    when: S => on((S.assets?.customers.dataCompleteness || 100) < 70, 44, `độ đầy dữ liệu khách ${S.assets?.customers.dataCompleteness}%`) },

  { id: "AD01", lever: "ADS", ten: "Tăng chi ads khi đói lead", viec: "Đang chậm nhịp mà %MKT quá thấp: duyệt tăng ngân sách ads theo trần CPL trong /vong-lap-doanh-thu — bóp ads lúc đói lead là tự bóp doanh thu.", kpi: "leadsTotal", kpiDir: "up", doSauNgay: 7,
    when: S => on(S.loop.pacePct < S.loop.expectedPct - 10 && (S.loop.mktPct ?? 99) < 5, 84, `chậm nhịp ${S.loop.pacePct}%/${S.loop.expectedPct}% mà chi MKT chỉ ${S.loop.mktPct}% doanh thu (trần cho phép ${Math.round(S.loop.assumptions.mktCostCapPct * 100)}%)`) },
  { id: "AD02", lever: "ADS", ten: "Tắt/chỉnh chiến dịch CPO vượt trần", viec: "Chiến dịch nào CPO vượt trần hoà vốn là đang ĐỐT tiền: tắt hoặc đổi mục tiêu/creative ngay.", kpi: "mktPct", kpiDir: "down", doSauNgay: 5,
    when: S => on(S.loop.mktOverBudgetWarn, 78, "cảnh báo vượt trần ngân sách MKT đang bật") },
  { id: "AD03", lever: "ADS", ten: "Bơm tiền vào bài viral organic", viec: "Bài organic đang chạy tốt nhất 30 ngày qua: chạy ads ngay trên bài đó (bằng chứng xã hội sẵn, CPC rẻ hơn bài mới).", kpi: "leadsTotal", kpiDir: "up", doSauNgay: 7,
    when: S => on(S.loop.pacePct < 100, 62, "có sẵn bài viral chưa được bơm tiền — mồi ngon nhất cho ads") },
  { id: "AD04", lever: "ADS", ten: "Video hoá nội dung ads", viec: "Nếu số đo cho thấy video reach tốt hơn bài chữ: ưu tiên creative video cho ads tháng này.", kpi: "leadsTotal", kpiDir: "up", doSauNgay: 14,
    when: S => on(true, 46, "(mẫu) đo lại reach video so với bài chữ") },
  { id: "AD05", lever: "ADS", ten: "Theo dõi 3 chiến dịch Google Search", viec: "Chiến dịch Google Search vừa bật: xem CPC/CTR tuần đầu, cắt từ khoá đắt, thêm phủ định.", kpi: "leadsTotal", kpiDir: "up", doSauNgay: 7,
    when: S => on(true, 55, "Google Ads mới lên sóng — tuần đầu là tuần vàng tinh chỉnh") },
  { id: "AD06", lever: "ADS", ten: "Cắm đo lead đầu phễu", viec: "Chưa bắt được lead đầu phễu thì chuyển đổi kênh toàn ước lượng: nối webhook Zalo/Pancake ghi lead theo kênh.", kpi: "leadsTotal", kpiDir: "up", doSauNgay: 7,
    when: S => on(S.loop.leadsTotal === 0, 70, "leadsTotal = 0 — mù đầu phễu, tối ưu ads bằng cảm giác") },
  { id: "AD07", lever: "ADS", ten: "Retarget người tương tác", viec: "Chạy retargeting tệp đã tương tác page/xem video 30 ngày — tệp ấm, CPO rẻ hơn tệp lạnh nhiều lần.", kpi: "mktPct", kpiDir: "down", doSauNgay: 10,
    when: S => on(S.loop.mktSpend > 2_000_000, 50, "đang chi ads tệp lạnh mà chưa vắt tệp ấm") },
  { id: "AD08", lever: "ADS", ten: "Đăng khung giờ vàng 10-11h", viec: "Thử dời lịch đăng sang khung 10-11h theo số đo của page (mẫu). Thử 2 tuần, đo lại.", kpi: "leadsTotal", kpiDir: "up", doSauNgay: 14,
    when: S => on(true, 44, "(mẫu) so sánh hiệu quả các khung giờ đăng") },
  { id: "AD09", lever: "ADS", ten: "Khai thác fanpage lớn nhất", viec: "Mọi bài bán quan trọng đăng/chia sẻ qua fanpage lớn nhất (mẫu) thay vì chỉ page vệ tinh ít follower.", kpi: "leadsTotal", kpiDir: "up", doSauNgay: 7,
    when: S => on(true, 58, "fanpage lớn là tài sản traffic lớn nhất (mẫu)") },
  { id: "AD10", lever: "ADS", ten: "SEO sale page ăn từ khoá mua", viec: "Sale page đã chuẩn JSON-LD: viết thêm mỗi trang 2 bài blog từ khoá mua hàng ('mua X ở đâu', 'X giá bao nhiêu') trỏ về.", kpi: "leadsTotal", kpiDir: "up", doSauNgay: 21,
    when: S => on(true, 34, "traffic SEO là lead 0 đồng, cộng dồn theo thời gian") },

  { id: "TK01", lever: "TON_KHO", ten: "Giải phóng tiền đọng trong kho", viec: "Tồn kho đang chiếm tỉ trọng lớn vốn lưu động: chọn 3 SKU đọng lâu nhất gắn làm QUÀ KÈM combo để xả (không bán phá giá).", kpi: "inventorySharePct", kpiDir: "down", doSauNgay: 14,
    when: S => on((S.assets?.tangible.inventorySharePct || 0) >= 60, 76, `tồn kho chiếm ${S.assets?.tangible.inventorySharePct}% vốn lưu động (${tr(S.assets?.tangible.inventoryValue || 0)} đọng)`) },
  { id: "TK02", lever: "TON_KHO", ten: "Đặt hàng SKU sắp đứt", viec: "SKU bán chạy sắp hết: chốt đơn nhập ngay — đứt hàng lúc đang có nhịp bán là mất doanh thu oan nhất.", kpi: "mtdRevenue", kpiDir: "up", doSauNgay: 7,
    when: S => on(true, 30, "kiểm tra danh sách 'sắp hết' trong /kho trước khi đứt") },
  { id: "TK03", lever: "TON_KHO", ten: "Quà tặng = hàng đọng", viec: "Chuẩn hoá: mọi quà tặng flash/bậc đơn ưu tiên lấy từ hàng đọng — quà có giá trị với khách, kho nhẹ đi, không tốn tiền mua quà.", kpi: "inventoryValue", kpiDir: "down", doSauNgay: 14,
    when: S => on((S.assets?.tangible.inventoryValue || 0) > 200_000_000, 64, `${tr(S.assets?.tangible.inventoryValue || 0)} nằm trong kho — quà tặng nên rút từ đây`) },
  { id: "TK04", lever: "TON_KHO", ten: "Bundle xả hàng chậm", viec: "Ghép SP bán chậm vào combo với SP bán chạy (giá combo hợp lý) — hàng chậm đi theo hàng nhanh.", kpi: "inventoryValue", kpiDir: "down", doSauNgay: 14,
    when: S => on((S.assets?.tangible.inventorySharePct || 0) >= 50, 52, "hàng chậm chỉ thoát được khi bám theo hàng nhanh") },
  { id: "TK05", lever: "TON_KHO", ten: "Đối chiếu COD treo", viec: "Rà COD J&T chưa về (đối soát /doi-soat-jt): tiền nằm ở nhà vận chuyển cũng là vốn đọng.", kpi: "cash", kpiDir: "up", doSauNgay: 7,
    when: S => on(true, 42, "COD treo dễ sót — phải soát định kỳ") },
  { id: "TK06", lever: "TON_KHO", ten: "Chu kỳ nhập sát nhu cầu", viec: "Đặt quy tắc nhập theo tốc độ bán 30 ngày gần nhất (không nhập theo cảm giác) — kho gọn, tiền không chôn.", kpi: "inventorySharePct", kpiDir: "down", doSauNgay: 21,
    when: S => on((S.assets?.tangible.inventorySharePct || 0) >= 55, 46, "nhập quá tay là nguồn gốc vốn đọng") },
  { id: "TK07", lever: "TON_KHO", ten: "Kiểm SKU âm/combo chưa nhập", viec: "Dòng tồn ÂM là combo chưa nhập linh kiện — kế toán kho xử lý để số tồn tin được.", kpi: "inventoryValue", kpiDir: "down", doSauNgay: 7,
    when: S => on(true, 28, "số tồn sai thì mọi quyết định trên nó đều sai") },

  { id: "CP01", lever: "CHI_PHI", ten: "Soát %MKT so trần", viec: "Chi MKT đang vượt/tiệm cận trần: rà từng chiến dịch, cắt phần không ra số — trần là để giữ lợi nhuận, không phải để phá.", kpi: "mktPct", kpiDir: "down", doSauNgay: 7,
    when: S => on((S.loop.mktPct ?? 0) > S.loop.assumptions.mktCostCapPct * 100, 72, `%MKT ${S.loop.mktPct}% vượt trần ${Math.round(S.loop.assumptions.mktCostCapPct * 100)}%`) },
  { id: "CP02", lever: "CHI_PHI", ten: "Đàm phán lại phí vận chuyển", viec: "Khối lượng đơn tháng đủ lớn: xin lại bảng giá J&T/đơn vị khác theo sản lượng — 5-10k/đơn nhân ngàn đơn là chục triệu/năm.", kpi: "mtdRevenue", kpiDir: "up", doSauNgay: 14,
    when: S => on(S.loop.totalOrders >= 150, 40, `${S.loop.totalOrders} đơn/tháng — đủ thế đàm phán giá ship`) },
  { id: "CP03", lever: "CHI_PHI", ten: "Chặn quà tặng vượt định mức", viec: "Đặt định mức chi phí quà theo % giá trị đơn (vd 5-8%) — quà là công cụ, không phải lỗ hổng biên.", kpi: "kmDiscountRate", kpiDir: "down", doSauNgay: 14,
    when: S => on(S.offersChot > 0, 38, "có offer chốt rồi thì phải có định mức quà đi kèm") },
  { id: "CP04", lever: "CHI_PHI", ten: "Rà phí công cụ/dịch vụ hằng tháng", viec: "Liệt kê mọi subscription/dịch vụ đang trả (từ bảng chi phí + email hoá đơn), cắt cái không dùng 60 ngày qua.", kpi: "cash", kpiDir: "up", doSauNgay: 14,
    when: S => on(+S.month.slice(5, 7) % 3 === 1, 32, "đầu quý — thời điểm rà phí định kỳ") },
  { id: "CP05", lever: "CHI_PHI", ten: "Đòi công nợ tới hạn", viec: "Rà công nợ phải thu quá hạn (đại lý/CTV), nhắc lịch sự nhưng dứt khoát — doanh thu chưa thu được chỉ là con số.", kpi: "cash", kpiDir: "up", doSauNgay: 7,
    when: S => on((S.assets?.tangible.cash || 0) < 100_000_000, 56, `tiền mặt ${tr(S.assets?.tangible.cash || 0)} — mỏng, phải gom về`) },
  { id: "CP06", lever: "CHI_PHI", ten: "Ưu tiên bán SP biên cao", viec: "Meeting sale 15 phút: công bố danh sách SP biên cao nhất tháng — cùng công sức bán, chọn thứ lãi hơn.", kpi: "mtdRevenue", kpiDir: "up", doSauNgay: 7,
    when: S => on((S.loop.reco?.topMargin?.length || 0) > 0, 44, "bảng SP biên cao có sẵn trong vòng lặp doanh thu") },

  { id: "KE01", lever: "KENH", ten: "Kích hoạt kênh đang bỏ trống", viec: "Kênh nào 0% doanh thu tháng này (Shopee/website/livestream) mà công ty có sẵn: giao 1 người phụ trách + 1 mục tiêu nhỏ.", kpi: "mtdRevenue", kpiDir: "up", doSauNgay: 14,
    when: S => { const dead = ["shopee", "website", "livestream"].filter(k => !S.loop.channels.some(c => c.channel.toLowerCase().includes(k) && c.revenue > 0)); return on(dead.length > 0, 54, `kênh chưa ra số: ${dead.join(", ")}`); } },
  { id: "KE02", lever: "KENH", ten: "Livestream tuần trên page lớn", viec: "1 buổi live/tuần trên fanpage lớn: chủ đề dưỡng sinh + trả lời trực tiếp, chốt bằng CTA từ khoá (không hô giảm giá).", kpi: "leadsTotal", kpiDir: "up", doSauNgay: 14,
    when: S => on(true, 48, "live trên IP lớn là kênh lead 0 đồng đều đặn nhất") },
  { id: "KE03", lever: "KENH", ten: "Đánh thức các nhóm Zalo", viec: "Lịch nội dung tuần cho các nhóm Zalo: 2 bài giá trị + 1 hỏi đáp + 1 offer mềm — nhóm im là tài sản chết.", kpi: "leadsTotal", kpiDir: "up", doSauNgay: 14,
    when: S => on(true, 50, "nhóm Zalo + khách cũ là kho traffic riêng, chi phí 0đ") },
  { id: "KE04", lever: "KENH", ten: "Tuyển 10 CTV đầu tiên theo chính sách", viec: "Chính sách kênh CTV có rồi: tuyển 10 CTV từ chính khách trung thành (họ đã tin và đã dùng), phát kit bán hàng.", kpi: "customers", kpiDir: "up", doSauNgay: 21,
    when: S => on((S.assets?.customers.loyal || 0) >= 20, 46, `${S.assets?.customers.loyal} khách trung thành = nguồn CTV chất nhất`) },
  { id: "KE05", lever: "KENH", ten: "Mở bán trên App NOVA", viec: "App NOVA là đòn bẩy kế hoạch (mẫu): bật mục đặt hàng/combo trong app + thông báo đẩy cho người dùng hiện có.", kpi: "orders", kpiDir: "up", doSauNgay: 14,
    when: S => on(+S.month.slice(5, 7) >= 7, 42, "kế hoạch (mẫu) ghi đòn bẩy = ra mắt App NOVA") },
  { id: "KE06", lever: "KENH", ten: "Đồng bộ giá mọi kênh", viec: "Rà giá niêm yết trên Shopee/web/page/đại lý — lệch giá là tự phá kênh của mình (luật 1 giá).", kpi: "kmDiscountRate", kpiDir: "down", doSauNgay: 7,
    when: S => on(S.loop.channels.length >= 3, 36, "bán đa kênh thì kỷ luật 1 giá là sống còn") },
  { id: "KE07", lever: "KENH", ten: "Workshop offline nhỏ", viec: "1 workshop 20-30 khách tại địa phương: trải nghiệm thật, chốt tại chỗ bằng combo + Thẻ Vàng.", kpi: "aov", kpiDir: "up", doSauNgay: 21,
    when: S => on((S.assets?.customers.totalCustomers || 0) > 200, 34, "gặp mặt thật là bước nhảy niềm tin lớn nhất với tệp trung niên") },
  { id: "KE08", lever: "KENH", ten: "Gói mẫu cho hiệu thuốc/spa khu vực", viec: "Chọn 5 điểm bán tiềm năng (spa, phòng tập, hiệu thực dưỡng) gửi gói mẫu + chính sách đại lý — kênh B2B2C chưa chạm.", kpi: "customers", kpiDir: "up", doSauNgay: 21,
    when: S => on(S.offersChot > 0, 30, "chính sách đại lý có sẵn, chỉ thiếu người đi chào") },
];

async function countUnreplied(key: string): Promise<number> {
  try {
    const j = JSON.parse((await getConfigValue(key)) || "{}");
    if (typeof j.total === "number") return j.total;
    if (Array.isArray(j.items)) return j.items.length;
    if (typeof j.count === "number") return j.count;
    return 0;
  } catch { return 0; }
}

function nextDoubleDay(today: string): { label: string; daysTo: number } {
  const d = new Date(today + "T00:00:00Z");
  for (let i = 0; i <= 40; i++) {
    const t = new Date(d.getTime() + i * 864e5);
    const m = t.getUTCMonth() + 1, day = t.getUTCDate();
    if (m === day) return { label: `${day}/${m}`, daysTo: i };
  }
  return { label: "?", daysTo: 99 };
}

export async function buildProfitSnapshot(month?: string): Promise<ProfitSnapshot> {
  const today = vnDateStr();
  const m = month || today.slice(0, 7);
  const sb = getServiceClient();

  const [loop, assets, offersRes, uz, uf] = await Promise.all([
    computeRevenueLoop(m),
    computeAssets(m).catch(() => null),
    getOffers(),
    countUnreplied("sale_unreplied"),
    countUnreplied("fb_unreplied"),
  ]);

  let km: KmReport | null = null;
  let kmVang: string | null = null;
  try {
    let rows: LineRow[] = [], off = 0;
    while (off < 5000) {
      const { data } = await sb.from("mshopkeeper_line_items")
        .select("order_date,gross_amount,discount,net_amount,cost_amount,profit_amount,sale_channel,product_name")
        .gte("order_date", `${m}-01`).lte("order_date", `${m}-31`).range(off, off + 999);
      if (!data?.length) break;
      rows = rows.concat(data as any); if (data.length < 1000) break; off += 1000;
    }
    if (rows.length) km = analyzeKm(rows);
    else kmVang = `MISA không có dòng nào tháng ${m} (nguồn đơn đã chuyển sang sổ Telegram, `
      + `mà sổ Telegram không ghi giá vốn) — CHƯA ĐO ĐƯỢC tỉ lệ giảm giá và biên, không phải bằng 0.`;
  } catch (e: any) {
    kmVang = `Đọc MISA hỏng: ${String(e?.message || e).slice(0, 80)}`;
  }

  const dayOfMonth = Number(today.slice(8, 10));
  const dim = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate();
  const offers = offersRes.offers;

  return {
    month: m, today, dayOfMonth, daysLeft: Math.max(0, dim - dayOfMonth),
    loop, assets, km, kmVang, unrepliedZalo: uz, unrepliedFb: uf,
    offersDraft: offers.filter(o => o.status !== "chot").length,
    offersChot: offers.filter(o => o.status === "chot").length,
    offers,
    nextDoubleDay: nextDoubleDay(today),
  };
}

export type ScoredPlay = { play: Play; score: number; evidence: string };

const ACTIVE_KEY = "profit_plays_active";
const HISTORY_KEY = "profit_plays_history";

export type ActivePlay = {
  id: string; ten: string; lever: Lever;
  assignedAt: string; measureAfter: string;
  kpi: MetricKey; kpiDir: "up" | "down"; baseline: number | null;
  status: "dang-do" | "thang" | "thua" | "chua-ro";
  resultNote?: string; measuredAt?: string;
};

export async function getActivePlays(): Promise<ActivePlay[]> {
  try { const j = JSON.parse((await getConfigValue(ACTIVE_KEY)) || "{}"); return Array.isArray(j.items) ? j.items : []; } catch { return []; }
}
export async function saveActivePlays(items: ActivePlay[]): Promise<void> {
  await setConfigValue(ACTIVE_KEY, JSON.stringify({ items: items.slice(-100) }), "Profit Playbook — plays đang chạy/đã đo");
}
async function getHistory(): Promise<Record<string, string>> {
  try { const j = JSON.parse((await getConfigValue(HISTORY_KEY)) || "{}"); return j.proposed || {}; } catch { return {}; }
}
async function markProposed(ids: string[], date: string): Promise<void> {
  const proposed = await getHistory();
  for (const id of ids) proposed[id] = date;
  await setConfigValue(HISTORY_KEY, JSON.stringify({ proposed }), "Profit Playbook — lịch sử đề xuất");
}

export function evaluatePlays(S: ProfitSnapshot): ScoredPlay[] {
  const out: ScoredPlay[] = [];
  for (const p of PLAYS) {
    try { const r = p.when(S); if (r) out.push({ play: p, score: r.score, evidence: r.evidence }); } catch { }
  }
  return out.sort((a, b) => b.score - a.score);
}

export async function pickTopPlays(S: ProfitSnapshot, n = 3): Promise<ScoredPlay[]> {
  const [hist, active] = await Promise.all([getHistory(), getActivePlays()]);
  const measuring = new Set(active.filter(a => a.status === "dang-do").map(a => a.id));
  const cutoff = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const picked = evaluatePlays(S)
    .filter(x => !measuring.has(x.play.id))
    .filter(x => !(hist[x.play.id] && hist[x.play.id] >= cutoff))
    .slice(0, n);
  await markProposed(picked.map(x => x.play.id), S.today);
  return picked;
}

export async function activatePlay(playId: string): Promise<ActivePlay | null> {
  const p = PLAYS.find(x => x.id === playId);
  if (!p) return null;
  const S = await buildProfitSnapshot();
  const items = await getActivePlays();
  if (items.some(a => a.id === playId && a.status === "dang-do")) return items.find(a => a.id === playId) || null;
  const a: ActivePlay = {
    id: p.id, ten: p.ten, lever: p.lever,
    assignedAt: S.today,
    measureAfter: new Date(Date.now() + p.doSauNgay * 864e5).toISOString().slice(0, 10),
    kpi: p.kpi, kpiDir: p.kpiDir, baseline: metricValue(S, p.kpi),
    status: "dang-do",
  };
  items.push(a);
  await saveActivePlays(items);
  return a;
}

export async function measureDuePlays(): Promise<{ measured: ActivePlay[]; snapshot: ProfitSnapshot }> {
  const S = await buildProfitSnapshot();
  const items = await getActivePlays();
  const measured: ActivePlay[] = [];
  for (const a of items) {
    if (a.status !== "dang-do" || a.measureAfter > S.today) continue;
    const now = metricValue(S, a.kpi);
    if (now == null || a.baseline == null) {
      a.status = "chua-ro"; a.resultNote = "thiếu số liệu để so (baseline hoặc hiện tại null)";
    } else {
      const delta = now - a.baseline;
      const good = a.kpiDir === "up" ? delta > 0 : delta < 0;
      const flat = Math.abs(delta) < Math.max(1, Math.abs(a.baseline) * 0.02);
      a.status = flat ? "chua-ro" : good ? "thang" : "thua";
      a.resultNote = `${a.kpi}: ${Math.round(a.baseline)} -> ${Math.round(now)} (${delta > 0 ? "+" : ""}${Math.round(delta)})`;
    }
    a.measuredAt = S.today;
    measured.push(a);
  }
  if (measured.length) await saveActivePlays(items);
  return { measured, snapshot: S };
}
