import "server-only";
import { layModel } from "@/lib/ai-model";
import { ghiNhatKyAI } from "@/lib/ai-nhat-ky";
import { COACH_PERSONA, MEDICAL_DECLINE } from "@/lib/coach-persona";
import { BRAND_DNA_SHORT } from "@/lib/brand-dna";
import { sanitizeContent, findBanned } from "@/lib/banned-words";
import { PLAYBOOK_KENH } from "@/lib/covan/knowledge_kenh";
import { DISC_NEN } from "@/lib/covan/knowledge_dockhach";
import { TAM_LY_HANH_VI_NEN } from "@/lib/covan/knowledge_tamlyhanhvi";
import { VAN_PHONG_VIET_KHACH } from "@/lib/van-phong-viet";
import { buildSaleKnowledgeBlock } from "@/lib/kien-thuc-nguon";
import { FAQ_BANK, FAQ_RE } from "@/lib/zalo-faq";
import { MOC_CACHE, heThongCoCache, tokenCache } from "@/lib/ai-cache";
import { lookupOrderContext } from "@/lib/zalo-order-lookup";
import type { NguCanhTraDon } from "@/lib/tra-don-kenh";
import { docYKhach, type YKhach } from "@/lib/doc-y-khach";
import { chotKiemTraLoi } from "@/lib/chot-kiem-tra-loi";

const _s4 = PLAYBOOK_KENH.indexOf("## 4");
const _s5 = PLAYBOOK_KENH.indexOf("## 5");
const OBJECTION_PLAYBOOK = _s4 >= 0 && _s5 > _s4 ? PLAYBOOK_KENH.slice(_s4, _s5).trim() : "";

const SALE_KNOWLEDGE = buildSaleKnowledgeBlock();

const HARD_RULES = `LUẬT CỨNG (không được vi phạm trong bất kỳ câu nào):
- Bột đạm là THỰC PHẨM BỔ SUNG; trà là TRÀ THẢO MỘC, không gọi trà là thực phẩm bổ sung; không hứa chữa / trị / khỏi bệnh / thải độc, không so sánh với thuốc, không hứa "hiệu quả sau X ngày".
- Khuyến mãi = TẶNG QUÀ, tuyệt đối không giảm giá hay chiết khấu phần trăm.
- Giá thống nhất mọi kênh (một mặt tiền giá). Khách nói chỗ khác rẻ hơn: không hạ giá, không hứa bớt tiền — giải thích kênh chính thức đồng giá, hàng có mã lô và hồ sơ công bố, khác nhau giữa các kênh nằm ở quà tặng và chăm sóc sau mua; nơi bán rẻ bất thường thì khéo léo lưu ý rủi ro hàng không rõ nguồn.
- Giọng chăm sóc, không dồn ép, không "hôm nay là ngày cuối". Khi khách từ chối / chần chừ: đồng cảm ngắn rồi KẾT BẰNG MỘT CÂU HỎI MỞ.
- LIỆU PHÁP CAN THIỆP CƠ THỂ (cà phê enema, thụt tháo/thụt rửa đại tràng): được nói phương pháp có nguồn gốc từ nước ngoài và thiên về trải nghiệm cá nhân. TUYỆT ĐỐI KHÔNG nói "an toàn", không dẫn trải nghiệm của người dùng khác làm bằng chứng, không nêu mốc kết quả, không khuyên khách nên làm. Kể NGUỒN GỐC thì được, kể KẾT QUẢ của người dùng thì không.`;

const SYSTEM = `Bạn là trợ lý chăm sóc khách của NOVA/ACME trên Zalo. Trả lời NGẮN (2-4 câu), ấm áp,
tự nhiên như người thật. Tập trung thói quen ăn - ngủ - vận động.

${COACH_PERSONA}

${BRAND_DNA_SHORT}

${HARD_RULES}

KHI KHÁCH TỪ CHỐI / CHẦN CHỪ (đắt quá, để suy nghĩ, hỏi vợ chồng, chỗ khác rẻ hơn...):
làm theo khung 5 bước và tinh thần các kịch bản dưới đây, nhưng RÚT GỌN còn 2-4 câu kiểu tin nhắn Zalo,
mỗi lượt chỉ đi một bước, không đọc nguyên văn như trả bài.

${OBJECTION_PLAYBOOK}

${SALE_KNOWLEDGE}

RIÊNG TRÊN ZALO:
- Nếu khách hỏi giá / muốn mua / để lại số / hỏi ship: xác nhận sẽ có chuyên viên gọi tư vấn & chốt đơn ngay.
- Không hối thúc, không doạ, không "hôm nay là ngày cuối".
- TỐI ĐA 4 CÂU. Không gạch đầu dòng. Đây là tin nhắn Zalo, không phải bài viết.
- KHÔNG dùng emoji. KHÔNG dùng markdown (**đậm**) — Zalo hiện nguyên dấu sao, trông như lỗi.
- XƯNG HÔ CỐ ĐỊNH: xưng "em", gọi khách là "mình". Không đổi giữa chừng, không gọi khách là "chị ơi"/"bạn".`;

const MEDICAL_THREAD_SYSTEM = `Bạn là trợ lý chăm sóc khách của NOVA/ACME trên Zalo.
Khách VỪA NHẮC TỚI BỆNH LÝ. Bạn ĐÃ nói rõ mình là huấn luyện viên dinh dưỡng, không phải bác sĩ.

${COACH_PERSONA}

CÁCH VIẾT (Zalo — BẮT BUỘC):
- TỐI ĐA 3 CÂU. Không gạch đầu dòng. Không xuống dòng nhiều lần. Đây là tin nhắn, không phải bài viết.
- KHÔNG dùng markdown (**đậm**, *nghiêng*, #) — Zalo hiện nguyên dấu sao, trông như lỗi.
- KHÔNG emoji.
- XƯNG HÔ CỐ ĐỊNH: bot xưng "em", gọi khách là "mình". TUYỆT ĐỐI không đổi giữa chừng,
  không tự xưng "chị", không gọi khách là "em".

NHIỆM VỤ DUY NHẤT LÚC NÀY — hỏi để HIỂU SINH HOẠT của khách, rồi bàn giao chuyên viên:
- Hỏi MỘT câu mỗi lượt, nhẹ nhàng, về: bữa ăn hằng ngày, giờ giấc, giấc ngủ, vận động, nhịp sống.
- Ghi nhận điều khách kể. Đồng cảm ngắn gọn, thật lòng.

TUYỆT ĐỐI KHÔNG (dù khách chủ động kể hay hỏi thẳng):
- KHÔNG hỏi sâu về bệnh: giai đoạn mấy, phác đồ gì, uống thuốc gì, chỉ số bao nhiêu, xét nghiệm ra sao.
  (Hỏi mấy thứ đó là đang dựng hồ sơ bệnh để bán — vừa phạm luật vừa sai.)
- KHÔNG bình luận về bệnh, không đoán, không trấn an kiểu "cái đó nhẹ thôi".
- KHÔNG nhắc tên sản phẩm, KHÔNG gợi ý mua, KHÔNG nói sản phẩm liên quan gì tới tình trạng của khách.
- KHÔNG khuyên về thuốc, không khuyên bỏ/hoãn/thay đổi điều trị, KHÔNG nhắc tới liệu pháp nào.
- Nếu khách ép trả lời chuyện bệnh: nhắc lại một lần rằng mình không phải bác sĩ, rồi nói chuyên viên
  sẽ liên hệ. KHÔNG nhượng bộ.

CHỈ trả về lời nhắn cho khách. Không giải thích.`;

const MEDICAL_RE = new RegExp(
  "(ung thư|ung thu|tiểu đường|tieu duong|huyết áp|huyet ap|tim mạch|tim mach|xơ gan|xo gan|suy thận|suy than|" +
  "viêm|viem|khối u|khoi u|hoá trị|hoa tri|xạ trị|xa tri|bệnh|benh|thuốc|thuoc|bác sĩ|bac si|" +
  "mang thai|có bầu|co bau|cho con bú|cho con bu|đơn thuốc|don thuoc|gout|gút|thoát vị|thoat vi|" +
  "dạ dày|da day|đại tràng|dai trang|xương khớp|xuong khop|mỡ máu|mo mau|men gan|tuyến giáp|tuyen giap)", "i");

const MEDICAL_OPENER =
  "Dạ em là huấn luyện viên sức khoẻ và dinh dưỡng, không phải bác sĩ, nên phần bệnh lý mình hỏi bác sĩ " +
  "giúp em để chắc chắn ạ. Còn chuyện ăn uống và sinh hoạt hằng ngày thì em đồng hành cùng mình được. " +
  "Mình kể em nghe bữa ăn thường ngày và giấc ngủ dạo này thế nào ạ?";

const inMedicalThread = (history: Array<{ role: string; content: string }>) =>
  history.some((h) => h.role === "assistant" && /không phải bác sĩ/i.test(h.content || ""));

const LIEU_PHAP_RE = new RegExp(
  "(enema|th[uụ]t th[aá]o|thut thao|th[uụ]t r[uử]a|thut rua|s[uú]c ru[oộ]t|suc ruot|" +
  "l[àa]m s[aạ]ch đ[aạ]i tr[àa]ng|lam sach dai trang|" +
  "(?:th[aả]i đ[oộ]c|thai doc|detox)(?:\\s+\\S+){0,2}\\s*(?:c[àa] ph[êe]|ca phe|cafe|đ[aạ]i tr[àa]ng|dai trang|ru[oộ]t|ruot)|" +
  "(?:c[àa] ph[êe]|ca phe|cafe)(?:\\s+\\S+){0,2}\\s*(?:th[aả]i đ[oộ]c|thai doc|detox))", "i");

const coBenhThatSu = (s: string) =>
  MEDICAL_RE.test((s || "").replace(LIEU_PHAP_RE, " ").replace(/đ[aạ]i tr[àa]ng|dai trang/gi, " "));

export type KenhChat = "zalo" | "facebook";

function cauChotLieuPhap(kenh: KenhChat): string {

  const xinLienHe = kenh === "facebook"
    ? "Mình nhắn giúp em số Zalo, em gửi mình bộ tài liệu chi tiết để mình đọc và cân nhắc xem có phù hợp với nhu cầu của mình không nhé."
    : "Em gửi mình bộ tài liệu chi tiết để mình đọc và cân nhắc xem có phù hợp với nhu cầu của mình không nhé.";
  return [
    "Dạ về phương pháp cà phê enema mình đang quan tâm, đây là một liệu pháp hỗ trợ chăm sóc sức khoẻ tự nhiên khá phổ biến.",
    "Vì phương pháp này thiên về trải nghiệm cá nhân, nên đứng ở góc độ người đồng hành, bên em luôn mong muốn cung cấp thông tin đa chiều, khách quan nhất thay vì khẳng định hiệu quả tuyệt đối cho mọi người.",
    xinLienHe,
    "Không biết mình đang tìm hiểu phương pháp này để hỗ trợ vấn đề gì cụ thể, hay mình chỉ muốn tham khảo thêm thôi ạ?",
  ].join(" ");
}

const HOT_RE = /(gi[áa]\b|bao nhi[êe]u|mua|đặt|order|ship|giao|cod|s[ốô] đi[ệe]n tho[ạa]i|sđt|t[ưu] v[ấâ]n|combo|li[ệe]u tr[ìi]nh)/i;
const PHONE_RE = /(0|\+?84)\d{8,10}/;

export type InboundResult = {
  reply: string; hot: boolean; capturedPhone: string | null;
  medical?: boolean; flagged?: string[];

  yKhach?: YKhach;

  handoffNote?: string;

  chanBoi?: string[];
};

const CAU_GIAO_NGUOI = "Dạ để em nhờ chuyên viên bên em nhắn lại cho mình ngay nhé, cho chắc chắn ạ.";

const duLieuNap = (system: string, history: Array<{ content: string }>, clean: string) =>
  [system, ...history.map((h) => h.content), clean].join("\n");

const cauBotDaGui = (history: Array<{ role: string; content: string }>) =>
  history.filter((h) => h.role === "assistant").map((h) => h.content);

function ghiChuGiao(lyDo: string[], clean: string, history: Array<{ role: string; content: string }>, phone: string | null): string {
  const said = [...history.filter((h) => h.role === "user").map((h) => h.content), clean]
    .map((x) => (x || "").trim()).filter(Boolean).slice(-5);
  return [...lyDo.map((l) => `BOT CHUYỂN NGƯỜI: ${l}`), phone ? `SĐT khách để lại: ${phone}` : "Khách chưa để lại SĐT.",
    "Khách đã nói:", ...said.map((x) => `  - "${x.slice(0, 160)}"`)].join("\n");
}

const replyTouchesDisease = (s: string) =>
  /(ung thư|tiểu đường|huyết áp|hoá trị|xạ trị|phác đồ|giai đoạn|liều|kê đơn|xét nghiệm|chỉ số)/i.test(s || "");

function buildHandoff(clean: string, history: Array<{ role: string; content: string }>, phone: string | null): string {
  const said = [...history.filter((h) => h.role === "user").map((h) => h.content), clean]
    .map((s) => (s || "").trim()).filter(Boolean).slice(-5);
  return [
    "KHÁCH CHẠM CHUYỆN BỆNH LÝ — bot đã từ chối tư vấn y tế, cần người thật tiếp.",
    phone ? `SĐT khách để lại: ${phone}` : "Khách chưa để lại SĐT.",
    "Khách đã nói:",
    ...said.map((s) => `  - "${s.slice(0, 160)}"`),
    "LƯU Ý CHO SALE: KHÔNG tư vấn bệnh, KHÔNG nói sản phẩm tác động tới bệnh.",
    "Chỉ đồng hành phần ăn uống/sinh hoạt, và khuyên khách hỏi bác sĩ phần bệnh lý.",
  ].join("\n");
}

const stripEmoji = (s: string) =>
  (s || "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}]/gu, "").replace(/[ \t]{2,}/g, " ");

const stripMarkdown = (s: string) =>
  (s || "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|$)/g, "$1$2")
    .replace(/^#{1,6}\s+/gm, "").replace(/^[-•]\s+/gm, "").replace(/\n{3,}/g, "\n\n").trim();

function capSentences(s: string, n: number, maxChars = 320): string {
  const t = stripEmoji(s || "").replace(/\n{2,}/g, " ").replace(/\s+/g, " ").trim();
  const parts = t.match(/[^.!?…]+[.!?…]+|\S[^.!?…]*$/g);
  if (!parts) return t;
  const out: string[] = [];
  for (const p of parts.slice(0, n)) {
    const next = (out.join(" ") + " " + p).trim();
    if (out.length && next.length > maxChars) break;
    out.push(p.trim());
  }
  return (out.join(" ") || parts[0]).trim();
}

async function askClaude(system: string, messages: any[]): Promise<string> {
  const key = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!key) return "";
  try {
    const model = await layModel("hangLoat");
    const t0 = Date.now();
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, thinking: { type: "disabled" }, max_tokens: 400, system: await heThongCoCache(system), messages }),
      cache: "no-store",
    });
    const j: any = await res.json().catch(() => ({}));
    ghiNhatKyAI({ noi: "zalo-agent", model, inTok: j?.usage?.input_tokens, outTok: j?.usage?.output_tokens, ms: Date.now() - t0, ok: res.ok, ...tokenCache(j?.usage) });
    if (j?.stop_reason === "max_tokens") return "";
    return stripMarkdown((j?.content?.find((b: { type?: string }) => b.type === "text")?.text || "").trim());
  } catch { return ""; }
}

export async function handleInboundMessage(text: string, history: Array<{ role: "user" | "assistant"; content: string }> = [], hocDuoc = "", kenh: KenhChat = "zalo", traDon?: NguCanhTraDon): Promise<InboundResult> {
  const clean = (text || "").trim();
  const hot = HOT_RE.test(clean);
  const pm = clean.match(PHONE_RE);
  const capturedPhone = pm ? pm[0] : null;

  const yKhach = docYKhach(clean);
  if (yKhach.chenLenh || yKhach.ngungNhan) {
    return { reply: "", hot: false, capturedPhone: null, flagged: [], yKhach, handoffNote: yKhach.lyDoChuyen.join("\n") };
  }

  const touchedMedical = MEDICAL_RE.test(clean);
  const already = inMedicalThread(history);

  const orderContext = await lookupOrderContext(clean, traDon).catch(() => null);
  const withOrders = (system: string) =>
    orderContext ? `${system}\n\nDỮ LIỆU ĐƠN HÀNG (hệ thống tra theo thông tin khách vừa gửi):\n${orderContext}` : system;

  const withHoc = (system: string) =>
    hocDuoc.trim()
      ? `${system}\n\nBÀI HỌC TỪ NHỮNG LẦN TƯ VẤN THẬT CỦA ĐỘI (bám theo, đừng trả lời máy móc):\n${hocDuoc.trim().slice(0, 1800)}`
      : system;

  const withFaq = (system: string) =>
    FAQ_RE.test(clean)
      ? `${system}\n\nKHO HỎI ĐÁP CHUẨN (ưu tiên trả lời theo đây khi khách hỏi trùng):\n${FAQ_BANK}`
      : system;

  const withCachNoi = (system: string) => `${system}\n\n${DISC_NEN}\n\n${TAM_LY_HANH_VI_NEN}\n\n${VAN_PHONG_VIET_KHACH}`;

  if (LIEU_PHAP_RE.test(clean) && !coBenhThatSu(clean) && !already) {

    const reply = hot
      ? `${cauChotLieuPhap(kenh)}\nEm để chuyên viên bên em gọi lại tư vấn và báo giá cụ thể cho mình ngay nhé.`
      : cauChotLieuPhap(kenh);
    return { reply, hot: true, capturedPhone, flagged: [] };
  }

  if (touchedMedical && !already) {
    return {
      reply: MEDICAL_OPENER, hot: true, capturedPhone, medical: true,
      handoffNote: buildHandoff(clean, history, capturedPhone),
    };
  }

  if (already) {
    const sysBenh = withHoc(withOrders(MEDICAL_THREAD_SYSTEM));
    const raw = await askClaude(sysBenh, [
      ...history.slice(-6), { role: "user" as const, content: clean.slice(0, 1000) },
    ]);
    const reply = capSentences(sanitizeContent(raw), 4);
    const flagged = findBanned(reply);
    const chot = chotKiemTraLoi(reply, duLieuNap(sysBenh, history, clean), cauBotDaGui(history));

    if (!reply || flagged.length || replyTouchesDisease(reply) || !chot.ok) {
      return {
        reply: "Dạ phần này để chuyên viên bên em nhắn lại với mình cho chắc chắn ạ. Em cảm ơn mình đã chia sẻ.",
        hot: true, capturedPhone, medical: true, flagged, ...(chot.ok ? {} : { chanBoi: chot.loi }),
        handoffNote: buildHandoff(clean, history, capturedPhone),
      };
    }
    return { reply, hot: true, capturedPhone, medical: true, flagged: [], handoffNote: buildHandoff(clean, history, capturedPhone) };
  }

  if (yKhach.khieuNaiNang || yKhach.muonGapNguoi) {
    return { reply: CAU_GIAO_NGUOI, hot: true, capturedPhone, flagged: [], yKhach,
      handoffNote: ghiChuGiao(yKhach.lyDoChuyen, clean, history, capturedPhone) };
  }

  const sysThuong = [withCachNoi(SYSTEM), MOC_CACHE, ...(FAQ_RE.test(clean) ? [withFaq("").trim(), MOC_CACHE] : [])].join("\n\n");
  const sysDayDu = withHoc(withOrders(sysThuong));
  let reply = await askClaude(sysDayDu, [...history.slice(-6), { role: "user" as const, content: clean.slice(0, 1000) }])
    || (orderContext
      ? "Dạ em đã nhận thông tin của mình, để chuyên viên bên em kiểm tra đơn và nhắn lại mình ngay ạ."
      : "Cảm ơn bạn đã nhắn NOVA. Bạn đang quan tâm điều gì về sức khoẻ hay sản phẩm của mình ạ?");

  reply = capSentences(sanitizeContent(reply), 4);
  const flagged = findBanned(reply);
  if (flagged.length || replyTouchesDisease(reply)) {
    return { reply: CAU_GIAO_NGUOI, hot: true, capturedPhone, flagged, yKhach };
  }

  const chot = chotKiemTraLoi(reply, duLieuNap(sysDayDu, history, clean), cauBotDaGui(history));
  if (!chot.ok) {
    return { reply: CAU_GIAO_NGUOI, hot: true, capturedPhone, flagged: [], yKhach, chanBoi: chot.loi,
      handoffNote: ghiChuGiao([`Bot định trả lời nhưng bị chốt kiểm chặn: ${chot.loi.join("; ")}`, ...yKhach.lyDoChuyen], clean, history, capturedPhone) };
  }

  if (hot) reply += "\nMình để chuyên viên gọi lại tư vấn & báo giá cụ thể cho bạn ngay nhé.";

  return { reply, hot, capturedPhone, flagged: [], yKhach,
    handoffNote: yKhach.macCa ? ghiChuGiao(yKhach.lyDoChuyen, clean, history, capturedPhone) : undefined };
}

export function chamTinKhach(
  text: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
): Pick<InboundResult, "hot" | "capturedPhone" | "medical" | "handoffNote" | "yKhach"> {
  const clean = (text || "").trim();
  const pm = clean.match(PHONE_RE);
  const capturedPhone = pm ? pm[0] : null;
  const already = inMedicalThread(history);
  const lieuPhap = LIEU_PHAP_RE.test(clean) && !coBenhThatSu(clean) && !already;
  const medical = already || (!lieuPhap && MEDICAL_RE.test(clean));
  const yKhach = docYKhach(clean);
  if (yKhach.chenLenh || yKhach.ngungNhan) return { hot: false, capturedPhone: null, yKhach, handoffNote: yKhach.lyDoChuyen.join("\n") };
  const hot = HOT_RE.test(clean) || lieuPhap || medical || yKhach.khieuNaiNang || yKhach.muonGapNguoi;
  return {
    hot, capturedPhone, medical: medical || undefined, yKhach,
    handoffNote: medical ? buildHandoff(clean, history, capturedPhone)
      : yKhach.lyDoChuyen.length ? ghiChuGiao(yKhach.lyDoChuyen, clean, history, capturedPhone) : undefined,
  };
}
