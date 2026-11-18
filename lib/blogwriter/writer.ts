import { CATEGORIES, type CategoryKey } from "./site";
import { bocMang, bocObject } from "./json-cut";
import { layTuyenBai, tieuDeCoTuKhoa } from "./tuyen-bai";
import { DISC_NOI_DUNG } from "@/lib/covan/knowledge_dockhach";
import { layModel } from "@/lib/ai-model";
import { ghiNhatKyAI } from "@/lib/ai-nhat-ky";

const API_URL = "https://api.anthropic.com/v1/messages";

export type Topic = {
  slug: string;
  title: string;
  categoryKey: CategoryKey;
  angle: string;

  tuKhoa?: string;
};

export type Draft = {
  title: string;
  description: string;
  answerBox: string;
  lamNgay?: string[];
  bodyHtml: string;
  faq: Array<{ q: string; a: string }>;
  related: Array<{ slug: string; title: string }>;
  heroAlt: string;
  heroPrompt: string;
  readMinutes: number;
};

type ContentBlock = { type?: string; text?: string };
type LLMKetQua = { text: string; cut: boolean; ra: number; nghi: number };

const conLai = (hanChot?: number): number =>
  hanChot ? hanChot - Date.now() : Number.POSITIVE_INFINITY;

const conGio = (hanChot: number | undefined, can: number): boolean => conLai(hanChot) > can;
const loiText = (e: unknown): string => String(e instanceof Error ? e.message : e);
const nghiTay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const LOI_TAM = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529]);
const SO_LUOT_GOI = 3;

async function callClaude(
  system: string,
  user: string,
  maxTokens: number,
  hanChot?: number
): Promise<LLMKetQua> {
  const apiKey = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!apiKey) throw new Error("Chưa cấu hình ANTHROPIC_API_KEY");
  const MODEL = await layModel("thuong");
  let loiCuoi = "";
  for (let lan = 0; lan < SO_LUOT_GOI; lan++) {
    if (lan > 0) {

      if (!conGio(hanChot, 60_000)) break;
      await nghiTay(1500 * lan);
    }
    let res: Response;
    const t0 = Date.now();
    try {

      const hanLuot = Math.max(30_000, Math.min(240_000, conLai(hanChot) - 10_000));
      res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: user }],
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(hanLuot),
      });
    } catch (e) {
      ghiNhatKyAI({ noi: "blogwriter", model: MODEL, ms: Date.now() - t0, ok: false });
      loiCuoi = `gọi Anthropic hỏng: ${loiText(e)}`;
      continue;
    }
    if (!res.ok) {
      ghiNhatKyAI({ noi: "blogwriter", model: MODEL, ms: Date.now() - t0, ok: false });
      const errText = await res.text().catch(() => "");
      loiCuoi = `Anthropic API ${res.status}: ${errText.slice(0, 200)}`;
      if (LOI_TAM.has(res.status)) continue;
      throw new Error(loiCuoi);
    }
    const data = (await res.json()) as {
      content?: ContentBlock[];
      stop_reason?: string;
      usage?: { input_tokens?: number; output_tokens?: number; output_tokens_details?: { thinking_tokens?: number } };
    };
    ghiNhatKyAI({ noi: "blogwriter", model: MODEL, inTok: data.usage?.input_tokens, outTok: data.usage?.output_tokens, ms: Date.now() - t0, ok: true });
    const text = (data.content || [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("");

    return {
      text,
      cut: data.stop_reason === "max_tokens",
      ra: data.usage?.output_tokens ?? 0,
      nghi: data.usage?.output_tokens_details?.thinking_tokens ?? 0,
    };
  }
  throw new Error(loiCuoi || "Không gọi được Anthropic");
}

const VOICE =
  "Bạn là cây bút của blog NOVA (example.com) — blog chăm sóc sức khoẻ chủ động cho người Việt. " +
  "Giọng văn nhẹ nhàng, khoa học đời thường, gần gũi bếp Việt, không giật gân. " +
  "LUẬT SẮT (vi phạm là bài bị loại): đây là nội dung kiến thức lối sống, KHÔNG nói về tác dụng chữa bệnh. " +
  "CẤM TUYỆT ĐỐI các từ/cụm: chữa bệnh, trị bệnh, điều trị, khỏi bệnh, thải độc, giải độc, mát gan, đặc trị, " +
  "thực phẩm chức năng, TPCN, 'hiệu quả sau X ngày', cam kết khỏi, hạ huyết áp, hạ đường huyết. " +
  "Không hứa hẹn kết quả sức khoẻ, không so sánh với thuốc, không khuyên ngừng thuốc. " +
  "KHÔNG dùng emoji ở bất cứ đâu. Viết tiếng Việt đủ dấu.\n\n" +

  DISC_NOI_DUNG;

export async function pickTopics(
  existingSlugs: string[],
  n: number,
  hanChot?: number,
  boQua?: Set<string>
): Promise<Topic[]> {
  const tuKho = layTuyenBai(existingSlugs, n, boQua);
  if (tuKho.length >= n) return tuKho;
  const conThieu = n - tuKho.length;

  const tranhTrung = [...existingSlugs, ...tuKho.map((t) => t.slug), ...Array.from(boQua || [])];

  const pillars = (Object.keys(CATEGORIES) as CategoryKey[])
    .map((k) => `- ${k}: ${CATEGORIES[k].label}`)
    .join("\n");
  const user =
    `Blog hiện có các bài với slug sau (TRÁNH trùng hoặc na ná chủ đề):\n${tranhTrung.join(", ")}\n\n` +
    `4 trụ nội dung (categoryKey):\n${pillars}\n\n` +
    `Chọn ${conThieu} chủ đề MỚI cho bài blog DÀI (thân tối thiểu 2500 TỪ), trải đều các trụ (không dồn 1 trụ). ` +
    `Ưu tiên chủ đề đời thường người Việt quan tâm, tra cứu được trên Google. ` +
    `Trả về DUY NHẤT một mảng JSON, mỗi phần tử: ` +
    `{"slug":"khong-dau-gach-ngang","title":"Tiêu đề bài","categoryKey":"dinh-duong|thoi-quen|thuc-pham|cam-nang","angle":"góc khai thác 1-2 câu"}`;

  const than: string[] = [];
  for (const [i, tran] of [6000, 10000].entries()) {
    if (i > 0 && !conGio(hanChot, 60_000)) break;
    try {
      const r = await callClaude(VOICE, user, tran, hanChot);
      const valid = bocMang<Topic>(r.text).filter(
        (t) =>
          t &&
          typeof t.slug === "string" &&
          /^[a-z0-9-]{3,80}$/.test(t.slug) &&
          !tranhTrung.includes(t.slug) &&
          typeof t.title === "string" &&
          (Object.keys(CATEGORIES) as string[]).includes(t.categoryKey)
      );

      if (valid.length) return [...tuKho, ...valid.slice(0, conThieu)];
      than.push(
        r.cut
          ? `lượt ${i + 1}: LLM trả cụt (trần ${tran}, ra ${r.ra} token, nghĩ ${r.nghi}), vớt không ra chủ đề nào`
          : `lượt ${i + 1}: không có chủ đề hợp lệ (${r.text.length} ký tự)`
      );
    } catch (e) {
      than.push(`lượt ${i + 1}: ${loiText(e)}`);
    }
  }

  if (tuKho.length) return tuKho;
  throw new Error(`Không chọn được chủ đề hợp lệ — ${than.join(" · ")}`);
}

function draftPrompt(topic: Topic, existingSlugs: string[]): string {
  const luatTieuDe = topic.tuKhoa
    ? `\n- TỪ KHOÁ BẮT BUỘC: tiêu đề bạn trả về PHẢI chứa nguyên văn cụm "${topic.tuKhoa}". ` +
      `Được sửa tiêu đề gợi ý cho hay hơn, nhưng cụm này phải còn nguyên trong đó, và nên đứng ` +
      `càng gần đầu tiêu đề càng tốt. Meta description cũng phải chứa cụm này.\n`
    : "";
  return (
    `Viết bài blog cho chủ đề:\n- Tiêu đề: ${topic.title}\n- Slug: ${topic.slug}\n` +
    `- Danh mục: ${CATEGORIES[topic.categoryKey].label}\n- Góc khai thác: ${topic.angle}\n${luatTieuDe}\n` +
    `Slug các bài đã có trên blog (dùng để chọn link nội bộ & bài liên quan, link dạng "<slug>.html"):\n` +
    `${existingSlugs.join(", ")}\n\n` +
    `YÊU CẦU KHUNG BÀI:\n` +
    `1. bodyHtml: thân bài HTML với 7-10 thẻ <h2> (không id), các đoạn <p>, tối đa 2 <ul> và tối đa 1 <blockquote>. ` +
    `Được dùng tối đa 2 thẻ <table> (có <thead> và <tbody>) cho phần so sánh hoặc số liệu — bảng làm bài ` +
    `nhìn được chứ không chỉ đọc được, và là thứ bài đối thủ thường không có. Bảng tối đa 4 cột để còn đọc ` +
    `được trên điện thoại. ` +
    `Mở đầu 1 đoạn dẫn trước h2 đầu tiên. Tổng phần chữ (bỏ thẻ) TỐI THIỂU 2500 TỪ — đếm TỪ, không phải ký tự. ` +
    `Mỗi mục h2 phải đủ sâu (vài đoạn) để bao trọn chủ đề. KHÔNG nhồi chữ, không lặp ý cho đủ số từ: ` +
    `bài mỏng và bài lặp đều bị Google coi là nội dung rác và không index.\n` +
    `1b. Chèn 3-5 link nội bộ <a href="ten-slug.html">chữ tự nhiên</a> tới bài đã có (chỉ dùng slug trong danh sách trên). ` +
    `Kết bài bằng 1 đoạn gợi hành động nhỏ nhẹ nhàng, không bán hàng.\n` +
    `1c. RÀO PHÁP LÝ (bắt buộc): ACME/NOVA là THỰC PHẨM BỔ SUNG. CẤM chữa/trị/điều trị/khỏi bệnh/thải độc/` +
    `giải độc gan/mát gan/đặc trị/thực phẩm chức năng/TPCN, cấm hứa "hiệu quả sau X ngày", cấm khoe kết quả ` +
    `sức khoẻ làm bằng chứng. Viết về THÓI QUEN và LỐI SỐNG, không nói công dụng chữa bệnh.\n` +
    `2. answerBox: đoạn "Trả lời nhanh" 40-60 từ, trả lời thẳng câu hỏi của bài (văn bản thuần, không HTML).\n` +
    `2b. lamNgay: ĐÚNG 3 việc người đọc LÀM ĐƯỢC NGAY HÔM NAY để nuôi dưỡng cơ thể theo đúng chủ đề bài. ` +
    `Mỗi việc 1 câu 12-25 từ, bắt đầu bằng ĐỘNG TỪ, phải CỤ THỂ tới mức làm được mà không cần mua gì ` +
    `(nêu rõ thời điểm hoặc liều lượng: "tối nay", "trước bữa sáng", "một cốc", "10 phút"). ` +
    `CẤM việc chung chung kiểu "ăn uống lành mạnh hơn", "chú ý sức khoẻ", "uống đủ nước". ` +
    `CẤM nhắc tên sản phẩm và CẤM mời mua — đây là việc tự làm, không phải lời chào hàng.\n` +
    `3. faq: ĐÚNG 5 câu hỏi thường gặp MỚI (không lặp lại nội dung answerBox), mỗi câu trả lời 2-4 câu, văn bản thuần.\n` +
    `3b. nguon: 2-3 nguồn tham khảo uy tín, mỗi mục là tên nguồn + nội dung tham khảo. KHÔNG bịa đường dẫn. ` +
    `Bắt buộc với bài sức khoẻ — Google lẫn AI search đều chấm E-E-A-T.\n` +
    `4. description: meta description 140-160 ký tự.\n` +
    `5. related: 3 bài liên quan chọn từ danh sách slug đã có: [{"slug":"...","title":"tiêu đề đoán từ slug, tiếng Việt tự nhiên"}].\n` +
    `6. heroAlt: mô tả ảnh hero tiếng Việt 1 câu. heroPrompt: prompt tiếng Anh tả ảnh hero ` +
    `(photorealistic, warm natural light, Vietnamese lifestyle, NO text/logo/person's face close-up).\n` +
    `7. readMinutes: số phút đọc (10-14).\n\n` +
    `Trả về DUY NHẤT một object JSON THEO ĐÚNG THỨ TỰ TRƯỜNG SAU (trường quan trọng đặt trước để ` +
    `bản trả lời có bị cắt cuối thì vẫn còn thân bài): ` +
    `{"title","description","answerBox","lamNgay":["..."x3],"bodyHtml","faq":[{"q","a"}x5],"nguon":["..."],` +
    `"related":[{"slug","title"}x3],"heroAlt","heroPrompt","readMinutes"}`
  );
}

function demTu(html: string): number {
  return String(html || "").replace(/<[^>]*>/g, " ").trim().split(/\s+/).filter(Boolean).length;
}

const TOI_THIEU_TU = 1200;

function loiDraft(d: any): string {
  if (!d || typeof d !== "object") return "không bóc được JSON";
  if (!d.title || !d.bodyHtml) return "thiếu title hoặc bodyHtml";
  const tu = demTu(d.bodyHtml);
  if (tu < TOI_THIEU_TU) return `thân bài chỉ ${tu} từ (nghi bị cắt giữa chừng)`;

  if (!/<\/[a-z0-9]+>\s*$/i.test(String(d.bodyHtml).trim())) return "thân bài đứt giữa câu (không kết bằng thẻ đóng)";
  if (!Array.isArray(d.faq) || d.faq.filter((f: any) => f?.q && f?.a).length < 3) {
    return "thiếu FAQ (cần ít nhất 3 câu)";
  }
  return "";
}

export async function writeArticle(
  topic: Topic,
  existingSlugs: string[],
  complaint?: string,
  hanChot?: number
): Promise<Draft> {
  let user = draftPrompt(topic, existingSlugs);
  if (complaint) {
    user +=
      `\n\nLƯU Ý VIẾT LẠI: bản trước vi phạm rào pháp lý (dính: ${complaint}). ` +
      `Viết lại toàn bộ, tuyệt đối không dùng các từ cấm dưới mọi biến thể.`;
  }

  const than: string[] = [];
  for (const [i, tran] of [24000, 28000].entries()) {
    if (i > 0 && !conGio(hanChot, 90_000)) break;
    try {
      const r = await callClaude(VOICE, user, tran, hanChot);
      const draft = bocObject<any>(r.text);
      const loi = loiDraft(draft);
      if (!loi) return chuanHoa(draft as Draft, existingSlugs, topic);
      than.push(
        (r.cut ? `lượt ${i + 1}: LLM trả cụt (trần ${tran}, ra ${r.ra} token, nghĩ ${r.nghi})` : `lượt ${i + 1}`) +
        ` — ${loi}`
      );
    } catch (e) {
      than.push(`lượt ${i + 1}: ${loiText(e)}`);
    }
  }
  throw new Error(`Không viết được bài (${topic.slug}) — ${than.join(" · ")}`);
}

function chuanHoa(draft: Draft, existingSlugs: string[], topic: Topic): Draft {

  if (!tieuDeCoTuKhoa(String(draft.title || ""), topic.tuKhoa)) draft.title = topic.title;
  draft.faq = (Array.isArray(draft.faq) ? draft.faq : [])
    .filter((f) => f?.q && f?.a)
    .slice(0, 3);
  draft.related = (Array.isArray(draft.related) ? draft.related : [])
    .filter((r) => r && existingSlugs.includes(r.slug))
    .slice(0, 3);
  draft.description = String(draft.description || "").trim();
  draft.answerBox = String(draft.answerBox || "").trim();
  draft.heroAlt = String(draft.heroAlt || "").trim();
  draft.heroPrompt = String(draft.heroPrompt || "").trim();
  draft.readMinutes = Math.min(9, Math.max(4, Number(draft.readMinutes) || 5));
  return draft;
}
