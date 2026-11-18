"use server";
import { getCurrentUser } from "@/lib/supabase-server";
import { layModel } from "@/lib/ai-model";
import { ghiNhatKyAI } from "@/lib/ai-nhat-ky";
import { isManagerOrAbove } from "@/lib/auth";
import { sanitizeContent } from "@/lib/banned-words";

export async function askCopilot(question: string, digest: any): Promise<{ ok: boolean; text?: string; error?: string }> {
  const user = await getCurrentUser();
  if (!user || !isManagerOrAbove(user.role)) return { ok: false, error: "Không có quyền" };
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: "Thiếu ANTHROPIC_API_KEY" };
  const prompt = `Bạn là trợ lý điều hành (COO copilot) của ACME — bán thực phẩm bổ sung + khoá học sức khoẻ. Dưới đây là SỐ LIỆU THỰC TẾ hôm nay (JSON). Trả lời câu hỏi của giám đốc NGẮN GỌN, bám số liệu, tiếng Việt, có đề xuất hành động nếu hợp lý. Nếu hỏi ngoài phạm vi dữ liệu, nói rõ chưa có dữ liệu. KHÔNG dùng từ "chữa/trị/thải độc".

SỐ LIỆU:
${JSON.stringify(digest)}

CÂU HỎI: ${question}`;
  try {
    const model = await layModel("thuong");
    const t0 = Date.now();
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, thinking: { type: "between_tools" }, max_tokens: 1200, messages: [{ role: "user", content: prompt }] }),
    });
    const j: any = await res.json();
    ghiNhatKyAI({ noi: "brief", model, inTok: j?.usage?.input_tokens, outTok: j?.usage?.output_tokens, ms: Date.now() - t0, ok: res.ok && !j?.error });
    if (j.error) return { ok: false, error: j.error.message };
    return { ok: true, text: sanitizeContent((j.content?.find((b: { type?: string }) => b.type === "text")?.text || "").trim()) };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}
