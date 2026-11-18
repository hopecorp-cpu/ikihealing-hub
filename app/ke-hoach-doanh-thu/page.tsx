import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { vnDateStr } from "@/lib/payroll";
import { getConfigNumber, getConfigValue } from "@/lib/app-config";
import { CONFIG_KEY_ANNUAL_TARGET, DEFAULT_ANNUAL_TARGET_2026, buildMonthlyTargets2026 } from "@/lib/bi-targets";
import { isSalePosition } from "@/lib/auth";
import { toGross } from "@/lib/money";
import { KpiPlanner } from "./client";
import { getT } from "@/lib/i18n-server";
import { layDoanhThu, gopTenSaleTuSo } from "@/lib/doanh-thu";

export const dynamic = "force-dynamic";

export default async function KeHoachDoanhThuPage() {
  const { t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isAdmin = user.role === "admin" || user.role === "ceo";
  const isSale = isSalePosition(user.position);
  if (!isAdmin && !isSale) redirect("/");

  const sb = getServiceClient();
  const curMonth = vnDateStr().slice(0, 7);

  const norm = (s?: string | null) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
  const nextMonthStart = curMonth.slice(5) === "12"
    ? `${+curMonth.slice(0, 4) + 1}-01-01`
    : `${curMonth.slice(0, 4)}-${String(+curMonth.slice(5) + 1).padStart(2, "0")}-01`;

  const monthActual: Record<string, number> = {};
  try { const mr = JSON.parse((await getConfigValue("sum_monthly_revenue") as any) ?? "{}"); for (const m in mr) monthActual[m] = mr[m].rev || 0; } catch { }

  const cuoiThang = new Date(new Date(nextMonthStart).getTime() - 864e5).toISOString().slice(0, 10);
  const [{ rows: li }, gopTen] = await Promise.all([layDoanhThu(sb, `${curMonth}-01`, cuoiThang), gopTenSaleTuSo(sb)]);
  const revByName: Record<string, number> = {}; const ordSet = new Set<string>();
  for (const r of li) { const k = norm(gopTen(r.sale_name)); if (k) revByName[k] = (revByName[k] || 0) + (r.net_amount || 0); ordSet.add(r.order_code); }
  const monthTotalRev = li.reduce((s, r) => s + (r.net_amount || 0), 0);
  const realAov = ordSet.size > 0 ? Math.round(monthTotalRev / ordSet.size) : 1_200_000;

  const annualTarget = await getConfigNumber(CONFIG_KEY_ANNUAL_TARGET, DEFAULT_ANNUAL_TARGET_2026);
  const { rows } = buildMonthlyTargets2026(annualTarget, { ...monthActual, [curMonth]: monthTotalRev }, curMonth);
  const curRow = rows.find(r => r.month === curMonth);
  const monthTarget = curRow?.target || 0;
  const monthActualNow = monthTotalRev;

  const { data: saleUsers } = await sb.from("users").select("id, full_name, position").eq("active", true);
  const isSalePos = (p?: string | null) => /(sale|trực page|tư vấn|telesale)/i.test(p || "");
  const sales = (saleUsers ?? []).filter((u: any) => isSalePos(u.position));
  const saleRevGross: Record<string, number> = {};
  for (const s of sales) saleRevGross[s.id] = Math.round(revByName[norm(s.full_name)] || 0);

  const weightFor = (pos?: string | null) => {
    const p = (pos || "").toLowerCase();
    if (/trực page|truc page/.test(p)) return 0;
    if (/leader/.test(p)) return 1.5;
    if (/thử việc|thu viec/.test(p)) return 0.7;
    return 1.0;
  };
  const saleStats = sales.map((s: any) => {

    const net = Math.round(saleRevGross[s.id] || 0);
    return { id: s.id, name: s.full_name, position: s.position, revenueGross: toGross(net), revenueNet: net, weight: weightFor(s.position) };
  }).sort((a, b) => b.weight - a.weight || b.revenueGross - a.revenueGross);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("Phân rã KPI doanh thu")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("Từ target → quý / tháng / tuần / ngày · số khách & đơn cần đạt · combo nên bán + chiết khấu giữ margin.")}
        </p>
      </div>
      <KpiPlanner
        month={curMonth}
        monthTarget={monthTarget}
        monthActual={monthActualNow}
        annualTarget={annualTarget}
        defaultAov={realAov}
        saleStats={saleStats}
        canEdit={isAdmin}
      />
    </div>
  );
}
