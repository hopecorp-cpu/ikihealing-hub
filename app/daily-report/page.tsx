import { requireUser } from "@/lib/auth-server";
import { getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove, isSalePosition } from "@/lib/auth";
import { vnDateStr } from "@/lib/payroll";
import { SALE_DEPT } from "@/lib/dept-report-templates";
import { computeAuto } from "@/lib/sales-checklist";
import { DailyReportClient } from "./client";

export const dynamic = "force-dynamic";

export default async function DailyReportPage({ searchParams }: { searchParams: { view?: string; d?: string; return?: string } }) {
  const user = await requireUser();
  const isManager = isManagerOrAbove(user.role);
  const view = searchParams.view || "mine";
  const today = vnDateStr();
  const date = searchParams.d || today;

  const sb = getServiceClient();

  const [{ data: meRow }, { data: myReports }] = await Promise.all([
    sb.from("users").select("full_name, position, departments!users_department_id_fkey(name)").eq("id", user.id).maybeSingle(),
    sb.from("daily_reports").select("*").eq("user_id", user.id).order("report_date", { ascending: false }).limit(14),
  ]);
  const myDept = (meRow as any)?.departments?.name || null;

  const isSale = myDept === SALE_DEPT || isSalePosition((meRow as any)?.position);
  const saleAuto = isSale ? await computeAuto(sb, (meRow as any)?.full_name || "", today, user.id) : null;

  const todayReport = (myReports ?? []).find((r: any) => r.report_date === today);

  let teamReports: any[] = [];
  if (isManager && view === "team") {
    const { data } = await sb.from("daily_reports")
      .select("*, users!daily_reports_user_id_fkey(full_name, position, departments!users_department_id_fkey(name))")
      .eq("report_date", date)
      .order("submitted_at");
    teamReports = data ?? [];
  }

  return (
    <DailyReportClient
      todayReport={todayReport}
      myReports={myReports ?? []}
      teamReports={teamReports}
      view={view}
      isManager={isManager}
      currentDate={date}
      myDept={myDept}
      saleAuto={saleAuto}
      returnTo={searchParams.return || null}
    />
  );
}
