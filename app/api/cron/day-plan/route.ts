import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { sendTelegramMay, telegramConfigured } from "@/lib/telegram";
import { expireStaleDayTasks, buildDayPlan, planToTelegram } from "@/lib/day-plan";
import { chanMay, khoaCron } from "@/lib/kiem-cron";
import { BOD_EMAILS } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;
  const dry = url.searchParams.get("dry") === "1";

  try {
    const expired = await expireStaleDayTasks(dry);

    const sb = getServiceClient();
    const { data: ceo } = await sb
      .from("users")
      .select("id, full_name")
      .eq("email", BOD_EMAILS[0] || "")
      .maybeSingle();

    const plan = await buildDayPlan(ceo?.id || null);
    const text = planToTelegram(plan, expired);

    if (dry) return NextResponse.json({ ok: true, dry: true, expired, plan: summarize(plan), text });
    if (!telegramConfigured()) return NextResponse.json({ ok: false, error: "Chưa cấu hình TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID", expired });

    const sent = await sendTelegramMay("ke-hoach-ngay", text);
    return NextResponse.json({ ok: sent.ok, expired, plan: summarize(plan), telegram: sent });
  } catch (e: any) {

    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

const summarize = (p: any) => ({
  cap: p.cap,
  totalOpen: p.totalOpen,
  overdue: p.overdue,
  today: p.days[0]?.count ?? 0,
  pushed: p.days.slice(1).reduce((s: number, d: any) => s + d.count, 0),
  overload: p.overload.length,
});
