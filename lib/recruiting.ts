import { askGeminiPdf } from "@/lib/gemini";

export type JobOpening = {
  id: number;
  title: string;
  jd_text: string;
  must_have?: string;
  nice_have?: string;
};

export type Screening = {
  name: string;
  email: string;
  phone: string;
  score: number;
  verdict: string;
  strengths: string[];
  concerns: string[];
  red_flags: string[];
  culture_fit: string;
  summary: string;
  cv_excerpt: string;
};

const SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    email: { type: "string" },
    phone: { type: "string" },
    score: { type: "integer" },
    verdict: { type: "string", enum: ["strong", "good", "maybe", "weak"] },
    strengths: { type: "array", items: { type: "string" } },
    concerns: { type: "array", items: { type: "string" } },
    red_flags: { type: "array", items: { type: "string" } },
    culture_fit: { type: "string" },
    summary: { type: "string" },
    cv_excerpt: { type: "string" },
  },
  required: ["name", "score", "verdict", "strengths", "concerns", "summary"],
};

const SYSTEM =
  "Bạn là chuyên viên tuyển dụng của ACME Corp (công ty thực phẩm bổ sung + sức khỏe, thương hiệu ACME/NOVA). " +
  "Nhiệm vụ: đọc CV (file đính kèm) và chấm mức phù hợp với MÔ TẢ CÔNG VIỆC được cung cấp. " +
  "Nguyên tắc:\n" +
  "1. CHẤM CÔNG BẰNG theo JD: score 0-100 (85+ = xuất sắc, 70-84 = tốt, 50-69 = tạm, <50 = yếu). " +
  "verdict: strong/good/maybe/weak tương ứng.\n" +
  "2. Trích đúng name/email/phone từ CV (không bịa; không có thì để rỗng).\n" +
  "3. strengths + concerns: bám bằng chứng THẬT trong CV, ngắn gọn từng ý.\n" +
  "4. red_flags: nhảy việc dày bất thường, khoảng trống dài không giải thích, thông tin mâu thuẫn — chỉ ghi khi CÓ.\n" +
  "5. culture_fit: đánh giá hợp văn hóa ACME (làm thật, tử tế, cam kết, cầu tiến) — 1-2 câu.\n" +
  "6. summary: 2-3 câu tóm tắt để nhà tuyển dụng quyết nhanh.\n" +
  "7. cv_excerpt: 1-2 dòng đầu/nổi bật của CV để đối chiếu.\n" +
  "Trả lời TIẾNG VIỆT, KHÔNG bịa dữ kiện ngoài CV.";

export async function screenCvPdf(job: JobOpening, base64Pdf: string): Promise<Screening | null> {
  const jd =
    `VỊ TRÍ: ${job.title}\n\nMÔ TẢ CÔNG VIỆC:\n${job.jd_text}` +
    (job.must_have ? `\n\nBẮT BUỘC PHẢI CÓ: ${job.must_have}` : "") +
    (job.nice_have ? `\n\nƯU TIÊN: ${job.nice_have}` : "");
  const r = await askGeminiPdf(
    base64Pdf,
    "application/pdf",
    SYSTEM,
    `Chấm CV đính kèm cho vị trí dưới đây. Trả JSON đúng khung.\n\n${jd}`,
    SCHEMA,

    { maxOutputTokens: 4000 }
  );
  if (!r.ok || !r.data) return null;
  const d = r.data as Partial<Screening>;
  return {
    name: String(d.name || ""),
    email: String(d.email || ""),
    phone: String(d.phone || ""),
    score: Math.max(0, Math.min(100, Math.round(Number(d.score) || 0))),
    verdict: String(d.verdict || "maybe"),
    strengths: Array.isArray(d.strengths) ? d.strengths.map(String) : [],
    concerns: Array.isArray(d.concerns) ? d.concerns.map(String) : [],
    red_flags: Array.isArray(d.red_flags) ? d.red_flags.map(String) : [],
    culture_fit: String(d.culture_fit || ""),
    summary: String(d.summary || ""),
    cv_excerpt: String(d.cv_excerpt || ""),
  };
}
