import { NextResponse } from "next/server";
import { layModel } from "@/lib/ai-model";
import { ghiNhatKyAI } from "@/lib/ai-nhat-ky";

export const runtime = "nodejs";

type Body = { topic?: string; tone?: string; length?: string };

const lengthGuide: Record<string, { secs: number; words: number }> = {
  "30 giây": { secs: 30, words: 75 },
  "60 giây": { secs: 60, words: 150 },
  "2 phút": { secs: 120, words: 300 },
};

export async function POST(req: Request) {
  const { topic, tone = "thân thiện", length = "60 giây" } = (await req.json()) as Body;
  if (!topic || !topic.trim()) {
    return NextResponse.json({ error: "Thiếu chủ đề" }, { status: 400 });
  }
  const target = lengthGuide[length] ?? lengthGuide["60 giây"];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      script: fallbackScript(topic, tone, target),
      note: "AI fallback (chưa set ANTHROPIC_API_KEY).",
    });
  }

  const prompt = `Bạn là copywriter cho video ngắn. Hãy viết kịch bản tiếng Việt cho video về chủ đề:

"${topic}"

Yêu cầu:
- Tông giọng: ${tone}
- Độ dài mục tiêu: ${target.secs} giây (~${target.words} từ)
- Mở đầu trong 3 giây đầu phải gây chú ý
- Mỗi câu ngắn, dễ đọc trên teleprompter
- Có call-to-action ở cuối
- Chỉ trả về nội dung kịch bản, không thêm tiêu đề hay chú thích.`;

  try {
    const model = await layModel("hangLoat");
    const t0 = Date.now();
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model, thinking: { type: "disabled" },
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) {
      ghiNhatKyAI({ noi: "api/tools/generate-script", model, ms: Date.now() - t0, ok: false });
      const text = await r.text();
      return NextResponse.json({ error: `Anthropic API ${r.status}: ${text}` }, { status: 500 });
    }
    const data = await r.json();
    ghiNhatKyAI({ noi: "api/tools/generate-script", model, inTok: data?.usage?.input_tokens, outTok: data?.usage?.output_tokens, ms: Date.now() - t0, ok: true });
    const script = (data.content?.find((b: { type?: string }) => b.type === "text")?.text ?? "").trim();
    if (!script) {
      return NextResponse.json({ error: "Không nhận được nội dung" }, { status: 500 });
    }
    return NextResponse.json({ script });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Lỗi không xác định" }, { status: 500 });
  }
}

function fallbackScript(topic: string, tone: string, target: { secs: number; words: number }) {
  return `Xin chào! Hôm nay chúng ta sẽ nói về: ${topic}.

Đây là một chủ đề rất thú vị mà nhiều người quan tâm.

Với tông giọng ${tone}, tôi muốn chia sẻ vài điểm chính:

Thứ nhất, hãy hiểu rõ vấn đề trước khi bắt đầu.

Thứ hai, áp dụng từng bước nhỏ và đo kết quả.

Thứ ba, kiên trì và điều chỉnh khi cần.

Nếu thấy hữu ích, hãy like và đăng ký kênh để xem thêm video mới!

(Đây là kịch bản mẫu — set ANTHROPIC_API_KEY trong .env.local để dùng AI thực sự, độ dài mục tiêu ~${target.words} từ.)`;
}
