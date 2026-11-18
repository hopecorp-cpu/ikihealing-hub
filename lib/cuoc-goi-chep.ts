import { geminiKey } from "@/lib/gemini";
import { ghiNhatKyAI } from "@/lib/ai-nhat-ky";

const LENH_CHEP = `Đây là file ghi âm một cuộc gọi điện thoại giữa NHÂN VIÊN SALE của công ty thực phẩm bổ sung ACME/NOVA và một KHÁCH HÀNG, tiếng Việt.
Chép lại NGUYÊN VĂN toàn bộ lời nói, theo thứ tự thời gian, mỗi lượt nói một dòng, bắt đầu bằng "Sale:" hoặc "Khách:".
Tự suy ai là sale (người giới thiệu sản phẩm, tư vấn, chốt đơn) và ai là khách theo nội dung.
Không tóm tắt, không sửa lời, không thêm bình luận. Đoạn nghe không rõ ghi [không rõ]. Không có tiếng người nói thì chỉ trả đúng chữ: [không có lời].`;

export async function chepLoiCuocGoi(
  b64: string, mime: string,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const key = geminiKey();
  if (!key) return { ok: false, error: "thiếu GEMINI_API_KEY_BRAIN" };
  const model = (process.env.GEMINI_MODEL || "gemini-3.5-flash").trim();
  const t0 = Date.now();
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ inline_data: { mime_type: mime, data: b64 } }, { text: LENH_CHEP }] }],

          generationConfig: { temperature: 0, maxOutputTokens: 16000, thinkingConfig: { thinkingBudget: 0 } },
        }),
        cache: "no-store",
      },
    );
    const j: any = await res.json().catch(() => ({}));
    const u = j?.usageMetadata || {};
    ghiNhatKyAI({ noi: "cham-cuoc-goi:chep", model, inTok: u.promptTokenCount, outTok: u.candidatesTokenCount, ms: Date.now() - t0, ok: res.ok });
    if (!res.ok) return { ok: false, error: j?.error?.message || `HTTP ${res.status}` };
    const text = (j?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text || "").join("").trim();
    if (!text) return { ok: false, error: "Gemini trả rỗng: " + (j?.promptFeedback?.blockReason || j?.candidates?.[0]?.finishReason || "?") };
    if (j?.candidates?.[0]?.finishReason === "MAX_TOKENS") return { ok: false, error: "bản chép bị cụt (MAX_TOKENS)" };
    return { ok: true, text };
  } catch (e: any) {
    ghiNhatKyAI({ noi: "cham-cuoc-goi:chep", model, ms: Date.now() - t0, ok: false });
    return { ok: false, error: String(e?.message || e) };
  }
}
