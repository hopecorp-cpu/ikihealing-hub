import { NextResponse } from "next/server";
import { buildDailyBalance } from "@/lib/balance-report";
import { sendTelegramMay, telegramConfigured, tgEscape } from "@/lib/telegram";
import { appLink } from "@/lib/app-url";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

async function notify(text: string) {

  if (telegramConfigured()) return sendTelegramMay("can-doi-quy", text);
  return { ok: false, error: "no telegram" };
}

export async function GET(req: Request) {
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;

  const r = await buildDailyBalance();
  if (!r.ok) {
    await notify(`⚠️ <b>Bảng cân đối chưa dựng được</b> — ${tgEscape(r.error || "")}`);

    return NextResponse.json({ ok: false, error: r.error }, { status: 500 });
  }
  const sent = await notify(`${r.text}\n\n👉 <a href="${appLink("/tai-chinh")}">Chi tiết tài chính</a>`);
  return NextResponse.json({ ok: true, sent: (sent as any).ok !== false });
}
