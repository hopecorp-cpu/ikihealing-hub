"use server";
import { getCurrentUser } from "@/lib/supabase-server";
import { layModel } from "@/lib/ai-model";
import { ghiNhatKyAI } from "@/lib/ai-nhat-ky";
import { FINANCE_WHITELIST } from "@/lib/auth";
import { setConfigValue } from "@/lib/app-config";
import { sanitizeContent } from "@/lib/banned-words";

const WHITELIST = FINANCE_WHITELIST;

export async function generateBgdAnalysis(month: string, metrics: any): Promise<{ ok: boolean; text?: string; error?: string }> {
  const user = await getCurrentUser();
  const email = (user?.email || "").toLowerCase().trim();
  if (!user || !(user.role === "ceo" || WHITELIST.includes(email))) return { ok: false, error: "Không có quyền" };

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: "Thiếu ANTHROPIC_API_KEY" };

  const prompt = `Bạn là Giám đốc Vận hành (COO) của ACME — công ty bán thực phẩm bổ sung & khoá học sức khoẻ. Dưới đây là số liệu THỰC TẾ vs MỤC TIÊU các phòng ban tháng ${month} (đã qua ${metrics.daThangPct}% tháng). Đơn vị tiền = VNĐ.

DỮ LIỆU:
${JSON.stringify(metrics, null, 2)}

Hãy viết BÁO CÁO PHÂN TÍCH & KHUYẾN NGHỊ ngắn gọn, thực chiến, bằng tiếng Việt, theo cấu trúc Markdown:

## Tổng quan
(2-3 câu: đang đạt/không đạt mục tiêu doanh số? điểm nóng nhất cần xử lý ngay?)

## Theo từng phòng
Với MỖI phòng có dữ liệu (Sale, Tài chính, Kho, Nhân sự), viết:
- **[Tên phòng]** — Trạng thái (tốt / cần chú ý / báo động) + 1 câu đánh giá so với mục tiêu.
  - *Chỉ số cần cải thiện:* (nêu cụ thể con số).
  - *Việc cần làm:* (1-3 hành động cụ thể, đo được, để đạt doanh số/mục tiêu).

## 3 ưu tiên tuần tới
(3 gạch đầu dòng hành động quan trọng nhất, có thể giao ngay).

YÊU CẦU: bám sát con số đã cho (đừng bịa số), ưu tiên hành động tăng doanh số, ngắn gọn đi thẳng vấn đề. Không dùng từ "chữa/trị/thải độc".`;

  try {
    const model = await layModel("thuong");
    const t0 = Date.now();
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, thinking: { type: "between_tools" }, max_tokens: 2000, messages: [{ role: "user", content: prompt }] }),
    });
    const j: any = await res.json();
    ghiNhatKyAI({ noi: "bang-dieu-hanh", model, inTok: j?.usage?.input_tokens, outTok: j?.usage?.output_tokens, ms: Date.now() - t0, ok: res.ok && !j?.error });
    if (j.error) return { ok: false, error: j.error.message || "Lỗi API" };
    const text = sanitizeContent((j.content?.find((b: { type?: string }) => b.type === "text")?.text || "").trim());
    if (!text) return { ok: false, error: "AI trả rỗng" };
    const stamped = text + `\n\n<sub>Cập nhật: ${new Date().toLocaleString("vi-VN")}</sub>`;
    await setConfigValue(`bgd_ai_${month}`, stamped, "Phân tích AI Bảng tổng BGĐ");
    return { ok: true, text: stamped };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}
