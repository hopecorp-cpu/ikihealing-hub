import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove, isMktPosition } from "@/lib/auth";
import { computeRevenueLoop } from "@/lib/revenue-loop";
import { getMonthPlan, getQuarterRollup, quarterOfMonth } from "@/lib/campaign-calendar";
import { salesEventsForMonth, type ExtraEvent } from "@/lib/sales-events";
import { lunarMarkersForMonth } from "@/lib/lunar";
import { getConfigValue } from "@/lib/app-config";
import { vnDateStr } from "@/lib/payroll";
import CalendarClient from "./CalendarClient";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Lịch chiến dịch | IKIHEALING Hub") };
}

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove(user.role) && !isMktPosition((user as any).position)) redirect("/?denied=lich-chien-dich");

  const month = vnDateStr().slice(0, 7);
  const [loop, plan, quy] = await Promise.all([
    computeRevenueLoop(month).catch(() => null as any),
    getMonthPlan(month),
    getQuarterRollup(quarterOfMonth(month)).catch(() => null),
  ]);

  const head = loop ? {
    annualTarget: loop.annualTarget, quarter: loop.quarter,
    monthTarget: loop.monthTarget, monthActual: loop.monthActual,
    gap: Math.max(0, loop.needGap || 0), pacePct: loop.pacePct, expectedPct: loop.expectedPct, finLight: loop.finLight,
  } : null;

  let extra: ExtraEvent[] = [];
  try { const raw = await getConfigValue("sales_events_extra"); const a = raw ? JSON.parse(raw) : null; if (Array.isArray(a)) extra = a; } catch { }

  const lunar: ExtraEvent[] = lunarMarkersForMonth(month).map((m) => m.kind === "mung1"
    ? { date: m.date, name: "Mùng 1 — Thanh lọc đầu tháng", type: "reset", goldenHour: "20:00–22:00", hook: "Khởi động chu trình dưỡng sinh: combo detox nhẹ, tặng trà thảo mộc; nội dung 'sống nhẹ đầu tháng'." }
    : { date: m.date, name: "Rằm — An lành tịnh dưỡng", type: "holiday", goldenHour: "20:00–22:00", hook: "Ưu đãi tặng quà cho khách ăn chay/thanh lọc ngày rằm; nội dung thiền, tịnh tâm, dưỡng sinh." });
  const events = salesEventsForMonth(month, [...extra, ...lunar]);
  return <CalendarClient month={month} head={head} plan={plan} quy={quy} events={events} />;
}
