import { NextResponse } from "next/server";
import { ACME_IDENTITY, buildLiveContext } from "@/lib/acme-brain";
import { geminiConfigured, askGemini } from "@/lib/gemini";

export const maxDuration = 60;

type Turn = { role: "user" | "model"; text: string };

const KENH_GIONG_NOI = `

## KÊNH GIỌNG NÓI (đọc thành tiếng cho CEO — nói như NGƯỜI THẬT đang trò chuyện)
- NGẮN GỌN 1-3 câu, mỗi câu 1 ý cho dễ nghe. Xưng "em", gọi "anh".
- Nói MỘC và ẤM như cộng sự thân thiết — được dùng từ đệm tự nhiên ("dạ", "à", "để em xem chút nhé"), có chút cảm xúc. TRÁNH giọng doanh nghiệp cứng nhắc (không nói "phương án", "tối ưu", "gỡ nghẽn"); diễn đạt đời thường thay vào đó.
- KHÔNG markdown, KHÔNG gạch đầu dòng, KHÔNG bảng, KHÔNG emoji, KHÔNG ký hiệu đặc biệt.
- Số liệu làm tròn cho dễ nghe (ví dụ "khoảng ba trăm hai mươi triệu").
- Câu cần bảng/chi tiết dài: nói ý chính bằng lời rồi bảo "chi tiết em gửi qua Telegram cho anh nhé", đừng đọc số dài dòng.`;

export async function POST(req: Request) {
  const secret = (process.env.TRO_LY_VOICE_SECRET || "").trim();
  const given = (req.headers.get("x-tro-ly-secret") || "").trim();
  if (!secret || given !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!geminiConfigured()) {
    return NextResponse.json({ ok: false, error: "no_gemini" }, { status: 503 });
  }

  let body: { text?: unknown; history?: unknown } = {};
  try {
    body = await req.json();
  } catch {}
  const text = String(body.text || "").trim().slice(0, 4000);
  if (!text) {
    return NextResponse.json({ ok: false, error: "empty_text" }, { status: 400 });
  }
  const history: Turn[] = Array.isArray(body.history)
    ? (body.history as Turn[])
        .filter((t) => t && (t.role === "user" || t.role === "model") && typeof t.text === "string")
        .slice(-12)
    : [];

  const live = await buildLiveContext();
  const system = ACME_IDENTITY + live + KENH_GIONG_NOI;

  const ans = await askGemini(system, history, text, { maxOutputTokens: 500 });
  if (!ans.ok || !ans.text) {
    return NextResponse.json({ ok: false, error: ans.error || "empty_answer" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, reply: ans.text });
}
