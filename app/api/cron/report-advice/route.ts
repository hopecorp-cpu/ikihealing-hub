import { NextResponse } from "next/server";
import { buildReportAdvice } from "@/lib/report-advisor";
import { chanMay, khoaBaoCao, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KHOA_ROUTE = [khoaCron({ bearer: true, query: ["secret"] }), khoaBaoCao({ headers: ["x-report-token"], query: ["token"] })];

export async function GET(req: Request) {
  const chanKhoa = await chanMay(req, KHOA_ROUTE); if (chanKhoa) return chanKhoa;
  try {
    const advice = await buildReportAdvice();
    const slim = new URL(req.url).searchParams.get("slim") === "1";
    const ready = advice.ideas.filter((i) => i.ready);
    return NextResponse.json({
      ok: true,
      month: advice.month,
      prevMonth: advice.prevMonth,
      readyCount: ready.length,
      published: advice.published,
      ideas: advice.ideas,
      snapshot: advice.snapshot,
      ...(slim ? {} : { fbDraft: advice.fbDraft }),
      generatedAt: advice.generatedAt,
    });
  } catch (e: any) {

    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
