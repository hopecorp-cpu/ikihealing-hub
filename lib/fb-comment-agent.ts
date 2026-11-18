import { getServiceClient } from "@/lib/supabase-server";
import { askGemini, geminiConfigured } from "@/lib/gemini";
import { findBanned } from "@/lib/banned-words";
import { lyDoDung } from "@/lib/dung-khan-cap";
import { MEDICAL_DECLINE } from "@/lib/coach-persona";
import { getPageToken } from "@/lib/fb-publish";
import { insertAndAssign } from "@/lib/leads";
import { vnDateStr } from "@/lib/payroll";
import { chonCauMau, dienCauMau } from "@/lib/cskh-cau-mau";

const G = "https://graph.facebook.com/v21.0";
import { timBaiHop } from "./blog-goi-y";
import { ganUtm } from "@/lib/utm";
import { VAN_PHONG_VIET_KHACH } from "@/lib/van-phong-viet";

const CFG = "fb_comment_agent";

export const MAY_KHONG_TU_GUI = true;

export const PAGE_TU_GUI_MAU_CO_DINH = new Set<string>(["00000000000000"]);
const CHO_DUYET = "nháp chờ duyệt — máy không tự gửi";

export type AgentConfig = {

  pages?: string[];

  pageTags?: Record<string, string>;

  camps?: any[];

  thanksTheoPage?: Record<string, string>;

  pageChu?: Record<string, string>;
  enabled: boolean;
  autoReply: boolean;

  thaTim: boolean;

  traLoiNguCanh: "tat" | "xem-thu" | "bat";

  cauMauCskh?: boolean;
  lookbackDays: number;
  keywords: string[];
  replyTemplate: string;
  thanksTemplate: string;
  medicalDecline: boolean;
  medicalDeclineTemplate: string;
  answerFromBlog: boolean;
  blogAnswerTemplate: string;

  campEbook: {
    bat: boolean;
    tuKhoa: string[];
    link: string;
    privateTemplate: string;
    publicTemplate: string;
    publicFallbackTemplate: string;
  };
};

export const DEFAULT_CFG: AgentConfig = {
  enabled: false,
  autoReply: false,
  thaTim: true,
  traLoiNguCanh: "xem-thu",
  cauMauCskh: true,
  lookbackDays: 7,

  keywords: [
    "CÓ", "QUAN TÂM", "TÔI QUAN TÂM", "TÔI MUỐN", "BỔ MÁU", "PROTEIN", "NOVA", "CAFE", "LÁ MƠ", "DƯA CHUỘT", "NGÒ GAI",
    "TÌM HIỂU", "MUỐN TÌM HIỂU", "CẦN TƯ VẤN", "TƯ VẤN", "ĐĂNG KÝ", "MUỐN MUA", "ĐẶT HÀNG", "CF", "QT", "CÀ PHÊ",
  ],
  replyTemplate:
    "Dạ em chào {ten}, em là trợ lý của Học Viện. Em gửi {ten} thông tin chi tiết qua tin nhắn nhé. " +
    "{ten} để lại giúp em số điện thoại (hoặc nhắn tin cho trang) để bên em gửi tận nơi ạ. Em cảm ơn {ten}.",
  thanksTemplate:
    "Dạ em cảm ơn {ten} đã để lại thông tin. Bên em sẽ liên hệ với {ten} trong thời gian sớm nhất ạ.",

  medicalDecline: false,
  medicalDeclineTemplate: MEDICAL_DECLINE,

  answerFromBlog: false,
  blogAnswerTemplate:
    "Dạ {ten} ơi, câu này bên em có viết chi tiết trong bài \"{tieude}\" ạ: {link}. " +
    "{ten} đọc thử nhé, cần bên em tư vấn thêm thì nhắn tin cho trang giúp em ạ.",
  campEbook: {
    bat: false,
    tuKhoa: ["ĐẠM", "DAM", "EBOOK", "NHẬN SÁCH", "XIN SÁCH"],
    link: "https://example.com/qua/100-bua-an-du-dam/",

    privateTemplate:
      "Dạ em chào {xung} {ten}, em là trợ lý của NOVA. Em gửi {xung} bộ 100 BỮA ĂN ĐỦ ĐẠM KHÔNG CẦN THỊT như đã hứa ạ.\n\n" +
      "Để nhận ebook, {xung} làm giúp em 2 bước, chưa tới 1 phút ạ:\n" +
      "1. {Xung} bấm vào link: {link}\n" +
      "2. Điền tên + email (thêm số điện thoại nếu {xung} muốn bên em gửi kèm thực đơn 3 ngày qua Zalo) rồi bấm NHẬN EBOOK MIỄN PHÍ — nút tải hiện ra ngay, bản PDF cũng được gửi vào hộp thư của {xung} ạ.\n\n" +
      "{Xung} cần hỏi gì cứ nhắn lại cho em tại đây nhé ạ.",
    publicTemplate:
      "Dạ em đã gửi link nhận sách qua tin nhắn cho {xung} {ten} rồi ạ, {xung} kiểm tra Messenger giúp em nhé — tin có thể nằm trong mục Tin nhắn chờ ạ.",

    publicFallbackTemplate:
      "Dạ {xung} {ten} ơi, em nhắn riêng cho {xung} chưa được ạ — {xung} bấm nút Gửi tin nhắn cho trang giúp em, em gửi link nhận sách qua Messenger ngay ạ.",
  },
};

const getCfgRaw = async (key: string) => {
  const sb = getServiceClient();
  try { return (await sb.from("config").select("value").eq("key", key).maybeSingle()).data?.value ?? null; } catch { return null; }
};
const setCfgRaw = async (key: string, value: string) => {
  const sb = getServiceClient();
  const { error } = await sb.from("config").upsert({ key, value }, { onConflict: "key" });
  if (error) throw new Error(`Ghi config "${key}" thất bại: ${error.message}`);
};

export async function getAgentConfig(): Promise<AgentConfig> {
  try {
    const v = await getCfgRaw(CFG);
    return v ? { ...DEFAULT_CFG, ...JSON.parse(v) } : DEFAULT_CFG;
  } catch { return DEFAULT_CFG; }
}
export const saveAgentConfig = (c: Partial<AgentConfig>) =>
  getAgentConfig().then((cur) => setCfgRaw(CFG, JSON.stringify({ ...cur, ...c })));

export function findPhone(text: string): string | null {
  const s = String(text || "").replace(/[.\-\s()]/g, "");
  const m = s.match(/(?:\+?84|0)(3|5|7|8|9)\d{8}/);
  if (!m) return null;
  let p = m[0];
  if (p.startsWith("+84")) p = "0" + p.slice(3);
  else if (p.startsWith("84")) p = "0" + p.slice(2);
  return p.length === 10 ? p : null;
}

const norm = (s: string) =>
  String(s || "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

const DANGER = new RegExp(
  "(^|\\s)(" + [

    "BENH", "CHUA", "TRI", "DIEU TRI", "THUOC", "KHOI", "TIEU DUONG", "UNG THU", "HUYET AP", "MO MAU",
    "TIM MACH", "DA DAY", "XUONG KHOP", "GOUT", "GUT", "THOAT VI", "VIEM", "DAU", "U", "KHOI U", "HACH",
    "SUY THAN", "SUY GAN", "XO GAN", "TUYEN GIAP", "MANG THAI", "BAU", "CHO CON BU", "DI UNG", "TAC DUNG PHU",
    "LIEU DUNG", "UONG NHU THE NAO", "DUNG DUOC KHONG", "UONG DUOC KHONG",

    "MAU SACH", "SACH MAU", "LOC MAU", "THANH LOC MAU", "THIEU MAU", "TIEU CAU", "HUYET",

    "BAC SI", "BENH VIEN", "KHAM", "XET NGHIEM", "SIEU AM", "NOI SOI", "CHAN DOAN", "TON THUONG",
    "DAI TRANG", "RUOT", "DA DAY", "GAN", "THAN", "PHOI", "TUI MAT", "TRIEU CHUNG", "DAU HIEU BENH",

    "GIA", "BAO NHIEU", "TIEN", "KHUYEN MAI", "GIAM GIA", "SALE", "CHIET KHAU", "SHIP", "PHI",

    "HOAN TIEN", "TRA HANG", "DOI TRA", "LUA", "SCAM", "KEM", "DOM", "GIA MAO", "KIEN", "TO CAO",
  ].join("|") + ")(\\s|$)"
);

export const isDangerous = (text: string) => DANGER.test(norm(text));

const FILLER = new Set([
  "A", "AH", "AK", "NHE", "NHA", "NHEE", "E", "EM", "EM A", "MINH", "VOI", "DI", "CHO", "XIN", "GUI", "CAN", "VS", "OK", "DA", "VANG",
  "TOI", "CHI", "ANH", "CO", "BAC", "MUON", "THEM", "VE", "GIUP", "DUOC", "SP", "AK A", "AJ", "Q", "NHAA",
]);
export function matchKeyword(text: string, keywords: string[]): string | null {
  const raw = String(text || "");
  if (/\?/.test(raw)) return null;
  if (isDangerous(raw)) return null;
  const t = norm(raw);
  if (!t || t.length > 30) return null;

  for (const k of keywords) {
    const nk = norm(k);
    if (!nk) continue;
    if (t === nk) return k;

    if (new RegExp(`(^|\\s)${nk}(\\s|$)`).test(t)) {
      const rest = t.replace(new RegExp(`(^|\\s)${nk}(\\s|$)`), " ").trim();
      if (!rest) return k;

      const laTuKhoa = new Set(keywords.map((x) => norm(x)).filter(Boolean));
      if (rest.split(" ").every((w) => FILLER.has(w) || laTuKhoa.has(w))) return k;
    }
  }
  return null;
}

export type CommentKind = "cta_keyword" | "left_phone" | "sensitive" | "question" | "spam" | "other";

export const THA_TIM_CHO: CommentKind[] = ["other", "question", "cta_keyword", "left_phone"];

export const TRA_LOI_CHO: CommentKind[] = ["other", "question"];
const TRAN_TRA_LOI_MOI_LUOT = 15;

export function soatCauTraLoi(cau: string, xung: "anh" | "chị" | "anh/chị" = "anh/chị"): string {
  const t = String(cau || "").trim();
  if (!t) return "rỗng";
  if (t.length > 280) return "dài quá 280 ký tự";
  if (/https?:\/\/|www\.|\.com\b|\.vn\b/i.test(t)) return "có đường link";
  if (/#\S/.test(t)) return "có hashtag";
  if (/(^|[^\p{L}])bạn([^\p{L}]|$)/iu.test(t)) return "gọi khách là 'bạn'";
  if (/\d[\d.,]*\s*(k|đ|đồng|vnd|nghìn|ngàn|triệu)(?![\p{L}])/iu.test(t)) return "nhắc giá tiền";
  const cam = findBanned(t);
  if (cam.length) return `dính từ cấm: ${cam.join(", ")}`;

  if (xung === "anh/chị" && /(^|[^\p{L}/])(anh|chị)(?![\p{L}/])/iu.test(t.replace(/anh\s*\/\s*chị|anh chị/giu, ""))) return "đoán giới tính khách";

  if (NOI_KIEN_THUC.test(t)) return "khẳng định kiến thức / tác dụng";
  if (NOI_UU_DAI.test(t)) return "tự nhắc ưu đãi / khuyến mãi";

  if (/(đã|vừa) (gửi|nhắn|inbox|ib|nhận được)/iu.test(t)) return "hứa đã nhắn tin riêng (máy không nhắn)";
  return "";
}
const NOI_KIEN_THUC = /(không làm mất|hấp thu|nuôi dưỡng|tốt cho|giúp (cơ thể|giảm|tăng|cải thiện|ổn định|bổ)|cải thiện|hiệu quả|công dụng|dinh dưỡng|bổ dưỡng|lành tính|đúng rồi|em có cho|trong công thức|thay đổi tích cực|kết quả)/iu;

const NOI_UU_DAI = /(ưu đãi|khuyến mãi|giảm giá|quà tặng|tặng quà|chương trình|miễn phí|freeship)/iu;

export async function soanTraLoi(o: { text: string; ten: string; bai: string; kind: CommentKind }):
  Promise<{ cau: string | null; lyDo: string }> {
  const boDau = (x: string) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const bl = boDau(o.text);
  if (bl && bl.split(" ").length <= 3 && ` ${boDau(o.bai)} `.includes(` ${bl} `))
    return { cau: null, lyDo: "khách gõ từ khoá bài yêu cầu — để người / mẫu chiến dịch" };
  if (!geminiConfigured()) return { cau: null, lyDo: "thiếu khoá Gemini" };
  const tokens = String(o.ten || "").trim().split(/\s+/).filter(Boolean);
  const tenGoi = tokens[tokens.length - 1] || "";
  const xung = danhXung(o.ten);
  const system = `Bạn là người trực fanpage của NOVA (thương hiệu thực phẩm bổ sung và lối sống khoẻ), đang trả lời MỘT bình luận công khai dưới bài đăng.
${VAN_PHONG_VIET_KHACH}

LUẬT RIÊNG CHO CÂU TRẢ LỜI BÌNH LUẬN:
- Xưng "em", gọi khách ĐÚNG là "${xung}"${tenGoi ? ` (có thể gọi kèm tên "${tenGoi}")` : ""}${xung === "anh/chị" ? ' — viết nguyên "anh/chị", không tự đoán là anh hay chị' : ""}. Không bao giờ gọi "bạn".
- Một đến hai câu, dưới 200 ký tự. Lịch sự, ấm, tự nhiên như người thật; bám đúng chi tiết khách vừa viết hoặc nội dung bài, đừng trả lời chung chung giống nhau.
- Khách khen / cảm ơn / thả biểu tượng cảm xúc: cảm ơn chân thành, có thể mời khách chia sẻ thêm cảm nhận hoặc theo dõi các bài sau.
- Khách hỏi chung (xin thông tin, "ib", hỏi mua ở đâu, hỏi cách làm...): KHÔNG trả lời nội dung câu hỏi, dù biết. Cảm ơn và mời ${xung} nhắn tin cho trang để em hỗ trợ kỹ hơn. KHÔNG được nói "em đã nhắn / đã gửi tin" vì em chưa hề nhắn.
- Không mô tả sản phẩm (mùi vị, cảm giác khi dùng, cách dùng).
- KHÔNG khẳng định bất kỳ kiến thức, sự thật, công thức hay tác dụng nào (kể cả về món ăn trong bài, kể cả để đồng tình với khách). Chỉ cảm ơn, ghi nhận điều khách chia sẻ, và mời.
- Không nhắc tên thương hiệu hay tên trang; nói "trang" hoặc "bài viết".
- CẤM: nói công dụng sản phẩm, nhắc bệnh / triệu chứng / sức khoẻ cải thiện, hứa kết quả, xin khách kể thay đổi của cơ thể, nhắc giá, ưu đãi, khuyến mãi, chương trình, đường link, hashtag, lặp lại từ ngữ tôn giáo hay tâm linh của khách.
- Tối đa một biểu tượng cảm xúc nhẹ, hoặc không có.
- Nếu bình luận chỉ là tag tên bạn bè, chỉ là một cái tên người, hoặc câu cụt không hiểu được: trả về đúng chữ BO_QUA.
Chỉ trả về câu trả lời, không giải thích, không đặt trong ngoặc kép.`;
  const user = `Nội dung bài (trích): «${String(o.bai || "").slice(0, 500)}»
Loại bình luận: ${o.kind === "question" ? "hỏi chung" : "khen / cảm ơn / cảm xúc"}
Bình luận của khách: «${String(o.text).slice(0, 400)}»`;
  const r: any = await askGemini(system, [], user, { maxOutputTokens: 300, temperature: 0.6, thinkingBudget: 0 });
  const cau = String(r?.text || "").trim().replace(/^["“”'«]+|["“”'»]+$/g, "").trim();
  if (!cau) return { cau: null, lyDo: `model trả rỗng${r?.finishReason ? " (" + r.finishReason + ")" : ""}` };
  if (/BO_QUA/i.test(cau)) return { cau: null, lyDo: "không nên trả lời (tag/tên/câu cụt)" };
  const truot = soatCauTraLoi(cau, xung);
  if (truot) return { cau: null, lyDo: `trượt soát: ${truot} | ${cau.slice(0, 120)}` };
  return { cau, lyDo: "" };
}

export async function classifyComment(text: string, keywords: string[]): Promise<CommentKind> {

  if (isDangerous(text)) return "sensitive";

  if (findPhone(text)) return "left_phone";
  if (matchKeyword(text, keywords)) return "cta_keyword";
  if (!geminiConfigured()) return "question";

  const system = `Bạn phân loại bình luận trên fanpage sức khoẻ (ACME — bán THỰC PHẨM BỔ SUNG).
Trả về ĐÚNG MỘT TỪ, không giải thích:
- sensitive : hỏi giá, xin khuyến mãi, hỏi về BỆNH/triệu chứng/thuốc/liều dùng, khiếu nại, đòi hoàn tiền, bình luận tiêu cực/công kích
- question  : hỏi chung chung khác (sản phẩm là gì, mua ở đâu, ship thế nào...)
- spam      : quảng cáo của người khác, link lạ, chửi bậy, vô nghĩa
- other     : khen, cảm ơn, thả tim, tag bạn bè, không cần trả lời
QUAN TRỌNG: bất cứ thứ gì liên quan BỆNH TẬT, GIÁ, KHUYẾN MÃI, KHIẾU NẠI đều là "sensitive".`;
  const r = await askGemini(system, [], `Bình luận: "${String(text).slice(0, 300)}"`, { maxOutputTokens: 10, temperature: 0 });
  const out = String((r as any).text || "").toLowerCase().trim();
  if (out.includes("sensitive")) return "sensitive";
  if (out.includes("spam")) return "spam";
  if (out.includes("question")) return "question";
  if (out.includes("other")) return "other";
  return "question";
}

const fill = (tpl: string, ten: string) => tpl.replace(/\{ten\}/g, ten || "mình");

const TEN_NU = new Set(["hương", "hoa", "lan", "ngọc", "trang", "thu", "thảo", "yến", "nhi", "my", "ly", "hà", "hằng", "hạnh", "dung", "thúy", "thuý", "huyền", "trâm", "tuyết", "quỳnh", "kiều", "diễm", "loan", "mai", "đào", "cúc", "oanh", "vy", "uyên", "nga", "nguyệt", "bích", "tiên", "thắm", "hồng", "nhung", "phượng", "thuỷ", "thủy", "vân", "yên", "quyên", "trinh", "thư", "ngân", "trà", "chi", "ánh"]);
const TEN_NAM = new Set(["hùng", "dũng", "tuấn", "đức", "nam", "quang", "thắng", "cường", "sơn", "long", "phong", "huy", "khoa", "toàn", "tùng", "trung", "kiên", "đạt", "hiếu", "vũ", "công", "hữu", "tiến", "dương", "quân", "việt", "khang", "phúc", "lâm", "tài", "nghĩa", "trường", "vinh", "tú", "đăng", "duy", "hoàng", "thịnh", "phát"]);
export function danhXung(tenDayDu: string): "anh" | "chị" | "anh/chị" {
  const tokens = String(tenDayDu || "").toLowerCase().trim().split(/\s+/);
  if (!tokens.length) return "anh/chị";
  if (tokens.includes("thị")) return "chị";
  if (tokens.includes("văn")) return "anh";
  const tenGoi = tokens[tokens.length - 1];
  if (TEN_NU.has(tenGoi)) return "chị";
  if (TEN_NAM.has(tenGoi)) return "anh";
  return "anh/chị";
}
const hoaDau = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function fillCamp(tpl: string, tenDayDu: string, link: string, pageTag = ""): string {
  const tokens = String(tenDayDu || "").trim().split(/\s+/).filter(Boolean);
  const tenGoi = tokens[tokens.length - 1] || "";
  const xung = danhXung(tenDayDu);
  return tpl
    .replace(/\{ten\}/g, tenGoi)
    .replace(/\{Xung\}/g, hoaDau(xung === "anh/chị" ? "anh/chị" : xung))
    .replace(/\{xung\}/g, xung)
    .replace(/\{link\}/g, ganUtm(link, { source: "facebook", medium: "social", campaign: "camp-" + (pageTag || "fb") }))
    .replace(/\{page\}/g, pageTag)
    .replace(/[ \t]+([,.!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ");
}

async function likeComment(commentId: string, pageToken: string): Promise<boolean> {
  if (await lyDoDung("nhan_khach")) return false;
  try {
    const r: any = await (await fetch(`${G}/${commentId}/likes`, {
      method: "POST",
      body: new URLSearchParams({ access_token: pageToken }),
    })).json();
    return !r.error;
  } catch { return false; }
}

async function privateReply(commentId: string, message: string, pageId: string, pageToken: string, choPhep = false): Promise<{ ok: boolean; error?: string }> {
  if (MAY_KHONG_TU_GUI && !choPhep) return { ok: false, error: CHO_DUYET };
  const banned = findBanned(message);
  if (banned.length) return { ok: false, error: `tin riêng dính từ cấm: ${banned.join(", ")}` };
  { const dung = await lyDoDung("nhan_khach"); if (dung) return { ok: false, error: dung }; }
  try {
    const r: any = await (await fetch(`${G}/${pageId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text: message }, access_token: pageToken }),
    })).json();
    return r.error ? { ok: false, error: r.error.message } : { ok: true };
  } catch (e: any) { return { ok: false, error: e?.message }; }
}

async function replyToComment(commentId: string, message: string, pageToken: string, choPhep = false): Promise<{ ok: boolean; error?: string }> {
  if (MAY_KHONG_TU_GUI && !choPhep) return { ok: false, error: CHO_DUYET };
  { const dung = await lyDoDung("nhan_khach"); if (dung) return { ok: false, error: dung }; }
  const banned = findBanned(message);
  if (banned.length) return { ok: false, error: `mẫu trả lời dính từ cấm: ${banned.join(", ")}` };
  try {
    const res = await fetch(`${G}/${commentId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ message, access_token: pageToken }),
      cache: "no-store",
    });
    const j: any = await res.json().catch(() => ({}));
    if (j.error) return { ok: false, error: j.error.message };
    return { ok: true };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}

export type RunResult = {
  ok: boolean; error?: string;
  scanned: number; replied: number; leads: number;
  forHuman: { id: string; from: string; text: string; kind: CommentKind; link: string }[];

  nhap: { page: string; link: string; kind: string; binhLuan: string; cau: string | null; cheDo: string; daDang: boolean }[];
  byKind: Record<string, number>;
};

export async function runCommentAgent(): Promise<RunResult> {
  const empty: RunResult = { ok: false, scanned: 0, replied: 0, leads: 0, forHuman: [], nhap: [], byKind: {} };
  const cfg = await getAgentConfig();

  const canReply = cfg.enabled && cfg.autoReply;

  let seen: string[] = [];
  try { seen = JSON.parse((await getCfgRaw("fb_comment_seen")) || "[]"); } catch { }
  const seenSet = new Set(seen);

  const sb = getServiceClient();
  const cutoff = Date.now() - cfg.lookbackDays * 864e5;
  const res: RunResult = { ok: true, scanned: 0, replied: 0, leads: 0, forHuman: [], nhap: [], byKind: {} };

  const pageIds: (string | undefined)[] = cfg.pages?.length ? cfg.pages : [undefined];
  let soPageOk = 0;

  const pageThieuQuyen: string[] = [];
  const soNhap: any[] = [];
  let soTraLoi = 0;
  for (const pid of pageIds) {
  const page = await getPageToken(pid);
  if (!page) { res.byKind[`khong_quyen_page_${pid || "macdinh"}`] = 1; pageThieuQuyen.push(String(pid || "macdinh")); continue; }
  const pageTag = (cfg.pageTags || {})[page.id] || page.id;
  const tuGui = PAGE_TU_GUI_MAU_CO_DINH.has(page.id);

  const ghiNhap = (c: any, kind: string, text: string, cau: string | null, lyDo: string) => {
    const cam = cau ? findBanned(cau) : [];
    soNhap.push({ t: new Date().toISOString(), page: pageTag, id: c.id, link: c.permalink_url || "", kind,
      binhLuan: text.slice(0, 300), cau: cam.length ? null : cau, lyDo: cam.length ? `dính từ cấm: ${cam.join(", ")} | ${lyDo}` : lyDo,
      cheDo: "nhap-cho-duyet", daDang: false });
  };

  const dangHoacNhap = async (c: any, kind: string, text: string, cau: string, nguon: string, boQuaNhap = false) => {
    const r = await replyToComment(c.id, cau, page.token);
    if (r.error === CHO_DUYET && !boQuaNhap) ghiNhap(c, kind, text, cau, nguon);
    return r;
  };

  const flds = `id,created_time,message,permalink_url,comments.limit(50){id,message,created_time,from,permalink_url,comment_count}`;
  const pj: any = await (await fetch(`${G}/${page.id}/published_posts?fields=${encodeURIComponent(flds)}&limit=25&access_token=${encodeURIComponent(page.token)}`, { cache: "no-store" })).json();
  if (pj.error) { res.byKind[`loi_fb_${page.id}`] = 1; continue; }
  soPageOk++;

  for (const post of pj.data || []) {
    if (new Date(post.created_time).getTime() < cutoff) continue;

    const dsBinhLuan: any[] = [...(post.comments?.data || [])];
    let trangSau: string | null = post.comments?.paging?.next || null;
    while (trangSau && dsBinhLuan.length < 600) {
      try {
        const j2: any = await (await fetch(trangSau, { cache: "no-store" })).json();
        if (j2.error) break;
        dsBinhLuan.push(...(j2.data || []));
        trangSau = j2.paging?.next || null;
      } catch { break; }
    }
    for (const c of dsBinhLuan) {
      if (!c.id || seenSet.has(c.id)) continue;
      const from = c.from?.name || "";
      const fromId = c.from?.id || "";
      if (fromId && fromId === page.id) continue;
      const text = String(c.message || "").trim();

      if (!text) { seenSet.add(c.id); continue; }

      res.scanned++;

      const dsCamp = [
        ...(cfg.campEbook ? [{ nhan: "camp_ebook", ...cfg.campEbook }] : []),
        ...((cfg.camps || []).map((x, i) => ({ nhan: `camp_${i}`, ...x }))),
      ];
      const camp = (!isDangerous(text) && !findPhone(text))
        ? dsCamp.find((x) => x.bat && matchKeyword(text, x.tuKhoa)
            && (Array.isArray(x.pages) ? x.pages.includes(page.id) : !tuGui))
        : undefined;
      seenSet.add(c.id);

      if (camp) {
        res.byKind[camp.nhan] = (res.byKind[camp.nhan] || 0) + 1;

        try { await setCfgRaw("fb_comment_seen", JSON.stringify(Array.from(seenSet).slice(-5000))); } catch { }
        await likeComment(c.id, page.token);
        const linkCamp = String(camp.link || "").replace(/\{page\}/g, pageTag);
        const tinRieng = fillCamp(camp.privateTemplate, from, linkCamp, pageTag);
        const choPhepCamp = tuGui && Array.isArray(camp.pages) && camp.pages.includes(page.id);
        const rieng = await privateReply(c.id, tinRieng, page.id, page.token, choPhepCamp);
        if (rieng.error === CHO_DUYET) {

          ghiNhap(c, "cta_keyword", text, `TIN RIÊNG: ${tinRieng}\n\nCÔNG KHAI: ${fillCamp(camp.publicTemplate, from, linkCamp, pageTag)}`,
            `${camp.nhan}: người nhắn riêng rồi trả lời công khai`);
          res.forHuman.push({ id: c.id, from, text, kind: "cta_keyword", link: c.permalink_url || "" });
          continue;
        }
        const cauCongKhai = rieng.ok
          ? fillCamp(camp.publicTemplate, from, linkCamp, pageTag)
          : fillCamp(camp.publicFallbackTemplate, from, linkCamp, pageTag);
        const r = await replyToComment(c.id, cauCongKhai, page.token, choPhepCamp);
        if (r.ok || rieng.ok) res.replied++;
        else res.forHuman.push({ id: c.id, from, text, kind: "cta_keyword", link: c.permalink_url || "" });
        continue;
      }

      const kind = await classifyComment(text, cfg.keywords);
      res.byKind[kind] = (res.byKind[kind] || 0) + 1;
      if (cfg.thaTim && THA_TIM_CHO.includes(kind) && await likeComment(c.id, page.token)) {
        res.byKind.tha_tim = (res.byKind.tha_tim || 0) + 1;
      }

      const camOnRieng = tuGui && kind === "left_phone" ? (cfg.thanksTheoPage || {})[page.id] : undefined;
      const mau = cfg.cauMauCskh !== false && kind !== "other" && !camOnRieng && !(Number(c.comment_count) > 0)
        ? chonCauMau(text, "cong-khai", kind === "left_phone" ? "CM11" : kind === "spam" ? "CM14" : undefined)
        : null;
      if (mau?.ma) {
        ghiNhap(c, kind, text, mau.cau ? dienCauMau(mau.cau, { xung: danhXung(from) }) : null, mau.lyDo);
        if (mau.cau) res.byKind.cau_mau = (res.byKind.cau_mau || 0) + 1;
      }
      const coMau = !!mau?.cau;

      const cheDo = cfg.traLoiNguCanh || "tat";
      if (cheDo !== "tat" && !coMau && TRA_LOI_CHO.includes(kind) && !(Number(c.comment_count) > 0)
          && !(kind === "question" && canReply && cfg.answerFromBlog) && soTraLoi < TRAN_TRA_LOI_MOI_LUOT) {
        const nhap = await soanTraLoi({ text, ten: from, bai: String(post.message || ""), kind })
          .catch((e: any) => ({ cau: null as string | null, lyDo: String(e?.message || e) }));
        let daDang = false, loiDang = "";
        if (cheDo === "bat" && nhap.cau) {
          const r = await replyToComment(c.id, nhap.cau, page.token);
          daDang = r.ok; loiDang = r.error || "";
          if (r.ok) { res.replied++; soTraLoi++; res.byKind.tra_loi_ngu_canh = (res.byKind.tra_loi_ngu_canh || 0) + 1; }
        }
        soNhap.push({ t: new Date().toISOString(), page: pageTag, id: c.id, link: c.permalink_url || "", kind,
          binhLuan: text.slice(0, 300), cau: nhap.cau, lyDo: nhap.lyDo || loiDang, cheDo, daDang });
      }

      if (kind === "left_phone") {
        const phone = findPhone(text)!;

        try {
          await insertAndAssign(sb, {
            customer_name: from || null, phone, source: `Bình luận ${page.name}`, channel: "facebook",
            pancake_link: c.permalink_url || post.permalink_url || null,
            external_id: `fbc:${c.id}`, note: text.slice(0, 120),
          }, { notify: true, assigneeId: (cfg.pageChu || {})[page.id] });
          res.leads++;
        } catch { }
        if (camOnRieng) {

          const cau = fill(camOnRieng, from);
          const r = await replyToComment(c.id, cau, page.token, true);
          if (r.ok) res.replied++;
          else ghiNhap(c, kind, text, cau, `cảm ơn SĐT tự gửi hỏng: ${r.error || ""}`);
        } else if (canReply) {
          const r = await dangHoacNhap(c, kind, text, fill(cfg.thanksTemplate, from), "mẫu cảm ơn (thanksTemplate)", coMau);
          if (r.ok) res.replied++;
        }
        continue;
      }

      if (kind === "cta_keyword") {
        if (canReply) {
          const r = await dangHoacNhap(c, kind, text, fill(cfg.replyTemplate, from), "mẫu từ khoá (replyTemplate)", coMau);
          if (r.ok) res.replied++;
          else res.forHuman.push({ id: c.id, from, text, kind, link: c.permalink_url || "" });
        } else {
          res.forHuman.push({ id: c.id, from, text, kind, link: c.permalink_url || "" });
        }
        continue;
      }

      if (kind === "sensitive" || kind === "question") {
        if (kind === "sensitive" && canReply && cfg.medicalDecline) {
          const r = await dangHoacNhap(c, kind, text, fill(cfg.medicalDeclineTemplate, from), "mẫu từ chối y tế (medicalDeclineTemplate)", coMau);
          if (r.ok) res.replied++;
        }

        if (kind === "question" && canReply && cfg.answerFromBlog) {
          const bai = await timBaiHop(text).catch(() => null);
          if (bai) {
            const cau = fill(cfg.blogAnswerTemplate, from)
              .replace(/\{tieude\}/g, bai.tieuDe)
              .replace(/\{link\}/g, ganUtm(bai.url, { source: "facebook", medium: "social", campaign: "binh-luan-goi-y" }));
            const r = await dangHoacNhap(c, kind, text, cau, "chỉ đường bài blog (blogAnswerTemplate)", coMau);
            if (r.ok) res.replied++;
          }
        }
        res.forHuman.push({ id: c.id, from, text, kind, link: c.permalink_url || post.permalink_url || "" });
      }

    }
  }

  }

  try {
    await setCfgRaw("fb_comment_quyen", JSON.stringify({
      at: new Date().toISOString(), date: vnDateStr(),
      thieu: pageThieuQuyen, du: soPageOk, tong: pageIds.length,
      tenThieu: pageThieuQuyen.map((id) => (cfg.pageTags || {})[id] || id),
    }));
  } catch { }
  if (!soPageOk) return { ...empty, error: "Không lấy được quyền trang nào (kiểm token FB + cfg.pages)" };

  await setCfgRaw("fb_comment_seen", JSON.stringify(Array.from(seenSet).slice(-5000)));
  if (soNhap.length) {
    let cu: any[] = [];
    try { cu = JSON.parse((await getCfgRaw("fb_comment_nhap")) || "[]"); } catch { }
    await setCfgRaw("fb_comment_nhap", JSON.stringify([...cu, ...soNhap].slice(-300)));
  }
  res.nhap = soNhap.map((x) => ({ page: x.page, link: x.link, kind: x.kind, binhLuan: x.binhLuan, cau: x.cau, cheDo: x.cheDo, daDang: x.daDang }));

  let thayBinhLuanLuc: string | null = null;
  try { thayBinhLuanLuc = JSON.parse((await getCfgRaw("fb_comment_agent_last")) || "{}")?.thayBinhLuanLuc || null; } catch { }
  if (res.scanned > 0) thayBinhLuanLuc = new Date().toISOString();
  await setCfgRaw("fb_comment_agent_last", JSON.stringify({
    at: new Date().toISOString(), date: vnDateStr(), thayBinhLuanLuc,
    scanned: res.scanned, replied: res.replied, leads: res.leads, forHuman: res.forHuman.length,
    nhap: res.nhap.length, choNguoiDang: res.nhap.filter((x) => !x.daDang && x.cau).length, byKind: res.byKind,
  }));
  return res;
}
