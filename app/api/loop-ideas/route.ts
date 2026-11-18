import { NextResponse } from "next/server";
import { layModel } from "@/lib/ai-model";
import { ghiNhatKyAI } from "@/lib/ai-nhat-ky";
import { getCurrentUser } from "@/lib/supabase-server";
import { findBanned, sanitizeContent } from "@/lib/banned-words";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !(user.role === "admin" || user.role === "ceo" || user.role === "manager"))
      return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ ok: false, reason: "no_api_key" });

    const { month, gap, needOrders, topMargin, channels } = await req.json();
    const monthNum = +String(month || "").slice(5) || (new Date().getMonth() + 1);
    const topList = (topMargin || []).slice(0, 5).map((p: any) => `${p.name} (biên ${Math.round((p.margin || 0) * 100)}%, giá ${Math.round((p.price || 0) / 1000)}k)`).join("; ");
    const chList = (channels || []).slice(0, 4).map((c: any) => `${c.channel} ${c.pctRev}%`).join(", ");

    const system = `Bạn là Giám đốc Kinh doanh ACME Corp (Đạm Mẫu và NOVA là thực phẩm bổ sung; Trà Mẫu A là trà thảo mộc, không phải thực phẩm bổ sung; Học Viện NOVA).
TUÂN THỦ (bắt buộc): SP là "thực phẩm bổ sung" — KHÔNG gọi TPCN/thực phẩm chức năng. KHÔNG nói chữa/trị/điều trị/thải độc/giảm cân/đặc trị/thay thế thuốc, KHÔNG từ tuyệt đối (số 1, tốt nhất, duy nhất). Chỉ "bổ sung dinh dưỡng / hỗ trợ".
Nguyên tắc bán: KHÔNG chiết khấu tiền mặt — TẶNG QUÀ giá vốn thấp (lớp Zoom, tư vấn 1-1, trà) để giữ giá & biên. Ưu tiên SP biên cao.`;

    const prompt = `Tháng ${monthNum}. Team đang còn thiếu ~${Math.round((gap || 0) / 1e6)} triệu doanh thu để đạt KPI, cần chốt thêm ~${needOrders || 0} đơn.
SP biên cao nhất: ${topList || "(chưa có dữ liệu)"}.
Kênh doanh thu: ${chList || "(chưa có)"}.
Hãy đề xuất NGẮN GỌN (tiếng Việt, gạch đầu dòng, ≤180 từ):
1. 1–2 chương trình ưu đãi/deal theo mùa vụ tháng ${monthNum} (tặng quà, KHÔNG chiết khấu) để tăng doanh số.
2. 1 ý upsell (nâng combo), 1 ý cross-sell (bán kèm), 1 ý downsell (giữ khách phân vân).
Mỗi ý kèm 1 câu chào mẫu cho sale. Bám SP biên cao, đúng ngôn ngữ tuân thủ.`;

    const model = await layModel("hangLoat");
    const t0 = Date.now();
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, thinking: { type: "disabled" }, max_tokens: 700, system, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) {
      ghiNhatKyAI({ noi: "api/loop-ideas", model, ms: Date.now() - t0, ok: false });
      return NextResponse.json({ ok: false, reason: "api_error" });
    }
    const data = await res.json();
    ghiNhatKyAI({ noi: "api/loop-ideas", model, inTok: data?.usage?.input_tokens, outTok: data?.usage?.output_tokens, ms: Date.now() - t0, ok: true });
    let answer = data.content?.find((b: { type?: string }) => b.type === "text")?.text || "";
    const banned = findBanned(answer);
    if (banned.length) answer = sanitizeContent(answer);
    return NextResponse.json({ ok: true, answer, banned });
  } catch (err: any) {
    return NextResponse.json({ ok: false, reason: err.message });
  }
}
