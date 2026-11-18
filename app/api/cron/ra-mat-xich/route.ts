import { NextResponse } from "next/server";
import { buildChainFacts, buildChainReview } from "@/lib/covan/chain-review";
import { covanSendCEO, covanTelegramConfigured } from "@/lib/covan/telegram";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;

  if (new URL(req.url).searchParams.get("dry") === "1") {
    try {
      return NextResponse.json({ ok: true, dry: true, facts: await buildChainFacts() });
    } catch (e) {
      return NextResponse.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
    }
  }
  if (!covanTelegramConfigured()) {
    return NextResponse.json({ ok: false, error: "Chưa cấu hình COVAN_BOT_TOKEN / COVAN_CHAT_ID" });
  }
  try {
    const { text } = await buildChainReview();
    const sent = await covanSendCEO(text);
    return NextResponse.json({ ok: sent.ok, telegram: sent });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
