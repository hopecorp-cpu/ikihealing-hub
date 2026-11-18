import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { buildSaleNudge } from "@/lib/task-nudge";
import { sendTelegramMay } from "@/lib/telegram";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;

  const salesChat = (process.env.TELEGRAM_SALES_CHAT_ID || "").trim();
  if (!salesChat) return NextResponse.json({ ok: false, error: "Chưa đặt TELEGRAM_SALES_CHAT_ID (nhóm sale)" }, { status: 200 });

  const vnHour = new Date(Date.now() + 7 * 3600e3).getUTCHours();
  const includeReports = vnHour >= 17;

  const sb = getServiceClient();
  const r = await buildSaleNudge(sb, { includeReports });
  if (!r.ok || !r.text) return NextResponse.json({ ok: true, tagged: 0, skipped: r.skipped });

  const sent = await sendTelegramMay("doc-viec-sale", r.text);
  return NextResponse.json({ ok: true, tagged: r.tagged, sent: (sent as any).ok !== false });
}
