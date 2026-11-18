import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { ngheGemini } from "@/lib/gemini";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TU_RIENG = "ACME, NOVA, Đạm Mẫu, Trà Mẫu A, Trà Mẫu B, Trợ lý AI, Cố vấn AI, Sơn, Đào, Cúc, Lan, Hoa, Thu Hằng, Thu Ngân, Salework, J&T, MISA, Shopee, TikTok, Zalo, Telegram, sale, lead, KPI, ads";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ceo" && user.role !== "admin")) return NextResponse.json({ error: "Chỉ CEO dùng được" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const audio = String(b.audio || "");
  const mime = String(b.mime || "audio/webm").split(";")[0];
  if (!audio || audio.length > 8_000_000) return NextResponse.json({ error: "Đoạn ghi âm trống hoặc quá dài" }, { status: 400 });
  const r = await ngheGemini(audio, mime, TU_RIENG);
  if (!r.ok) return NextResponse.json({ error: "Chưa nghe được, anh nói lại giúp em" }, { status: 502 });
  return NextResponse.json({ text: r.text });
}
