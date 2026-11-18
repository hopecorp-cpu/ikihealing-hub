import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { GIONG, giongHopLe, lamSachDeDoc } from "@/lib/tro-ly-giong";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ceo" && user.role !== "admin")) return NextResponse.json({ error: "Chỉ CEO dùng được" }, { status: 403 });
  const key = (process.env.ELEVENLABS_API_KEY || "").trim();
  if (!key) return new NextResponse(null, { status: 204 });
  const b = await req.json().catch(() => ({}));
  const text = lamSachDeDoc(String(b.text || "")).slice(0, 1000);
  if (!text) return NextResponse.json({ error: "Không có chữ để đọc" }, { status: 400 });
  const giong = giongHopLe(String(b.giong || "")) ? String(b.giong) : (process.env.ELEVENLABS_VOICE_ID || GIONG[0].id).trim();
  const model = (process.env.ELEVENLABS_MODEL || "eleven_flash_v2_5").trim();
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${giong}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: model, language_code: "vi", voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: 1.05 } }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!res || !res.ok) {
    const loi = res ? await res.text().catch(() => "") : "mất kết nối";
    return NextResponse.json({ error: `ElevenLabs lỗi ${res?.status ?? ""}`.trim(), chiTiet: loi.slice(0, 300) }, { status: 502 });
  }
  return new NextResponse(res.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}
