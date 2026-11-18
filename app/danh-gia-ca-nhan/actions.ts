"use server";
import { getCurrentUser } from "@/lib/supabase-server";
import { layModel } from "@/lib/ai-model";
import { ghiNhatKyAI } from "@/lib/ai-nhat-ky";
import { setConfigValue } from "@/lib/app-config";
import { isManagerOrAbove } from "@/lib/auth";
import { sanitizeContent } from "@/lib/banned-words";

export async function generatePersonAnalysis(person: any, month: string): Promise<{ ok: boolean; text?: string; error?: string }> {
  const user = await getCurrentUser();
  if (!user || !isManagerOrAbove(user.role)) return { ok: false, error: "Không có quyền" };
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: "Thiếu ANTHROPIC_API_KEY" };

  const prompt = `Bạn là quản lý nhân sự/vận hành tại ACME (bán thực phẩm bổ sung + khoá học sức khoẻ). Đánh giá NGẮN GỌN 1 nhân viên tháng ${month}, đưa khuyến nghị thực chiến.

NHÂN VIÊN:
- Tên: ${person.name} · Vị trí: ${person.position} · Phòng: ${person.dept}
${person.isSale ? `- Doanh số: ${person.revenue?.toLocaleString("vi")}đ / KPI ${person.target?.toLocaleString("vi")}đ = ${person.pct ?? "—"}% · ${person.orders} đơn · ${person.custs} khách
- Điểm chất lượng tư vấn (chat AI): ${person.chatScore ?? "chưa có"}` : ""}
- Báo cáo ngày đã nộp: ${person.reports} · Năng lượng TB: ${person.energyAvg ?? "—"}/5

Viết tiếng Việt, Markdown ngắn:
- **Đánh giá:** 1-2 câu (đạt/chưa đạt mục tiêu, điểm mạnh/yếu).
- **Cần cải thiện:** chỉ số/điểm yếu cụ thể.
- **Việc cần làm:** 2-3 hành động cụ thể, đo được, để cải thiện hiệu suất/doanh số.
Bám số liệu đã cho, đừng bịa. Không dùng từ "chữa/trị/thải độc".`;

  try {
    const model = await layModel("thuong");
    const t0 = Date.now();
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, thinking: { type: "between_tools" }, max_tokens: 900, messages: [{ role: "user", content: prompt }] }),
    });
    const j: any = await res.json();
    ghiNhatKyAI({ noi: "danh-gia-ca-nhan", model, inTok: j?.usage?.input_tokens, outTok: j?.usage?.output_tokens, ms: Date.now() - t0, ok: res.ok && !j?.error });
    if (j.error) return { ok: false, error: j.error.message || "Lỗi API" };
    const text = sanitizeContent((j.content?.find((b: { type?: string }) => b.type === "text")?.text || "").trim());
    if (!text) return { ok: false, error: "AI trả rỗng" };
    await setConfigValue(`ai_person_${person.id}_${month}`, text, "Đánh giá AI cá nhân");
    return { ok: true, text };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}
