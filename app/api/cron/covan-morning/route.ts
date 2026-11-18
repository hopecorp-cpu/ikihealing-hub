import { NextResponse } from "next/server";
import { computePnl } from "@/lib/covan/pnl";
import { buildForecast } from "@/lib/covan/forecast";
import { runAlerts } from "@/lib/covan/alerts";
import { buildBriefing } from "@/lib/covan/briefing";
import { measureDue } from "@/lib/covan/learning";
import { isCampaignRec, sendAfterActionReport } from "@/lib/covan/after-action";
import { covanSendCEO, covanTelegramConfigured } from "@/lib/covan/telegram";
import { costLineForBriefing } from "@/lib/covan/cost";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;
  if (!covanTelegramConfigured()) {
    return NextResponse.json({
      ok: false,
      error: "Chưa cấu hình COVAN_BOT_TOKEN / COVAN_CHAT_ID trong Vercel env",
    });
  }

  const measured = await measureDue(false);

  let afterAction = 0;
  for (const m of measured.measured) {
    if (isCampaignRec(m.title) && (await sendAfterActionReport(m))) afterAction++;
  }

  const pnl = await computePnl();
  const fc = await buildForecast(pnl);
  const alerts = await runAlerts({ pnl, forecast: fc });
  const brief = await buildBriefing({ pnl, forecast: fc, alerts });

  const parts: string[] = [`BẢN TIN SÁNG AI CỐ VẤN\n\n${brief.briefing}`];
  if (measured.measured.length) {
    parts.push(
      "\nKẾT QUẢ ĐO SÁNG NAY:\n" +
        measured.measured
          .map((m) => `#${m.id} [${m.verdict.toUpperCase()}] ${m.title} — ${m.outcome}`)
          .join("\n")
    );
  }
  const cost = await costLineForBriefing();
  if (cost) parts.push(`\n${cost}`);
  const sent = await covanSendCEO(parts.join("\n"));

  return NextResponse.json({
    ok: sent.ok,
    measured: measured.count,
    after_action_reports: afterAction,
    alerts: alerts.alerts_count,
    recommendations: alerts.recommendations_count,
    polished: brief.polished,
    telegram: sent,
  });
}
