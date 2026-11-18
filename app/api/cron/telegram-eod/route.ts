import { NextResponse } from "next/server";
import { sendTelegramMay, telegramConfigured } from "@/lib/telegram";
import { buildEodReport, saveEodSnapshot } from "@/lib/eod-report";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;
  const dry = url.searchParams.get("dry") === "1";

  try {
    const { text, snapshot, badSources } = await buildEodReport();
    if (dry) return NextResponse.json({ ok: true, dry: true, snapshot, badSources, text });
    if (!telegramConfigured()) return NextResponse.json({ ok: false, error: "Chưa cấu hình TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID" }, { status: 500 });

    const sent = await sendTelegramMay("tong-ket-cuoi-ngay", text);

    if (sent.ok) await saveEodSnapshot(snapshot);
    return NextResponse.json({ ok: sent.ok, snapshot, badSources, telegram: sent });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
