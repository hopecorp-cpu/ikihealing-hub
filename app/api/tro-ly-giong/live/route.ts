import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { getLocale } from "@/lib/i18n-server";
import { ACME_IDENTITY, buildLiveContext } from "@/lib/acme-brain";
import { SKILL_DECLS } from "@/lib/brain-skills";
import { MODEL_LIVE, GIONG_LIVE, giongLiveHopLe, LUAT_LIVE, HOI_CLAUDE_DECL, taoTokenLive } from "@/lib/gemini-live";

export const dynamic = "force-dynamic";

let soLieu: { luc: number; text: Promise<string> } | null = null;
function laySoLieu(): Promise<string> {
  if (!soLieu || Date.now() - soLieu.luc > 60_000) soLieu = { luc: Date.now(), text: buildLiveContext().catch(() => "") };
  return soLieu.text;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ceo" && user.role !== "admin")) return NextResponse.json({ error: "Chỉ CEO dùng được" }, { status: 403 });
  await laySoLieu();
  return NextResponse.json({ ok: true });
}

const LUAT_TIENG_ANH = "\n\nLANGUAGE: The user is using the English interface. Always listen for and reply in natural, fluent American English with a native accent, short and professional. Keep Vietnamese only for people's names, product names and page paths.";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ceo" && user.role !== "admin")) return NextResponse.json({ error: "Chỉ CEO dùng được" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const giong = giongLiveHopLe(String(b.giong || "")) ? String(b.giong) : GIONG_LIVE[0].id;
  const handle = typeof b.handle === "string" && b.handle.length < 500 ? b.handle : undefined;

  const live = await laySoLieu();

  const en = getLocale() === "en";
  const setup = {
    model: `models/${MODEL_LIVE()}`,
    generationConfig: { responseModalities: ["AUDIO"], speechConfig: { ...(en ? { languageCode: "en-US" } : {}), voiceConfig: { prebuiltVoiceConfig: { voiceName: giong } } } },
    systemInstruction: { parts: [{ text: ACME_IDENTITY + live + LUAT_LIVE + (en ? LUAT_TIENG_ANH : "") }] },
    tools: [{ functionDeclarations: [...SKILL_DECLS, HOI_CLAUDE_DECL] }],
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    sessionResumption: handle ? { handle } : {},
    contextWindowCompression: { slidingWindow: {} },
  };
  const tk = await taoTokenLive(setup);
  if (!tk.ok) return NextResponse.json({ error: "Chưa mở được phiên Gemini Live", chiTiet: tk.error }, { status: 502 });

  return NextResponse.json({ token: tk.token, setup: { model: setup.model } });
}
