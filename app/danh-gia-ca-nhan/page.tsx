import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { vnDateStr } from "@/lib/payroll";
import { getConfigValue } from "@/lib/app-config";
import { CONFIG_KEY_ANNUAL_TARGET, DEFAULT_ANNUAL_TARGET_2026, buildMonthlyTargets2026 } from "@/lib/bi-targets";
import PersonScorecards from "./PersonScorecards";
import { getT } from "@/lib/i18n-server";
import { layDoanhThu, gopTenSale } from "@/lib/doanh-thu";
import { tenGoiCuaNick } from "@/lib/zalo-nick-sale";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Đánh giá cá nhân | ACME Ops Hub") };
}

const norm = (s: string) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
const weightFor = (pos?: string | null) => {
  const p = (pos || "").toLowerCase();
  if (/trực page|truc page/.test(p)) return 0;
  if (/leader/.test(p)) return 1.5;
  if (/thử việc|thu viec/.test(p)) return 0.7;
  return 1.0;
};
const SALE_DEPT = "Kinh Doanh & Sale";

export default async function DanhGiaCaNhanPage({ searchParams }: { searchParams: { m?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove(user.role)) redirect("/?denied=danhgia");

  const { t } = getT();
  const sb = getServiceClient();
  const month = searchParams.m || vnDateStr().slice(0, 7);
  const dim = new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate();
  const from = `${month}-01`, to = `${month}-${String(dim).padStart(2, "0")}`;
  const todayStr = vnDateStr();
  const daysElapsed = todayStr.slice(0, 7) === month ? +todayStr.slice(8, 10) : dim;
  const expectedPct = Math.round(daysElapsed / dim * 100);

  const { data: users } = await sb.from("users")
    .select("id, full_name, position, departments!users_department_id_fkey(name)").eq("active", true);

  const li = (await layDoanhThu(sb, from, to)).rows;
  const gopTen = gopTenSale((users ?? []).map((u: any) => ({ ten: u.full_name || "" })));
  const revByName: Record<string, { revenue: number; orders: Set<string>; custs: Set<string> }> = {};
  for (const r of li) {
    const k = norm(gopTen(r.sale_name));
    if (!k) continue;
    const s = (revByName[k] ??= { revenue: 0, orders: new Set(), custs: new Set() });
    s.revenue += r.net_amount || 0; s.orders.add(r.order_code); if (r.customer_phone) s.custs.add(r.customer_phone);
  }

  const { data: chats } = await sb.from("salework_chat_analysis").select("account_id, score, analyzed_at")
    .gte("analyzed_at", from).lte("analyzed_at", to + "T23:59:59");
  const chatBySale: Record<string, { sum: number; n: number }> = {};
  for (const c of chats ?? []) {
    const sk = tenGoiCuaNick(c.account_id, c.analyzed_at); if (!sk || c.score == null) continue;
    const o = (chatBySale[sk] ??= { sum: 0, n: 0 }); o.sum += Number(c.score); o.n++;
  }

  const { data: careM } = await sb.from("customer_care_log").select("sale_name, last_contact").gte("last_contact", from).lte("last_contact", to);
  const careByName: Record<string, number> = {};
  for (const r of careM ?? []) { const k = norm(r.sale_name || ""); if (k) careByName[k] = (careByName[k] || 0) + 1; }

  const callByName: Record<string, number> = {}, chotByName: Record<string, number> = {};
  try {
    const cl = JSON.parse((await getConfigValue("call_log")) || "{}");
    for (const [d, bysale] of Object.entries(cl)) {
      if (!d.startsWith(month)) continue;
      for (const [sale, v] of Object.entries(bysale as any)) {
        const k = norm(sale); if (!k) continue;
        const n = typeof v === "number" ? v : ((v as any)?.n || 0);
        const chot = typeof v === "number" ? 0 : ((v as any)?.chot || 0);
        callByName[k] = (callByName[k] || 0) + n; chotByName[k] = (chotByName[k] || 0) + chot;
      }
    }
  } catch { }

  const { data: reports } = await sb.from("daily_reports").select("user_id, report_date, mood, energy_level")
    .gte("report_date", from).lte("report_date", to);
  const repByUser: Record<string, { count: number; last: string; energy: number[] }> = {};
  for (const r of reports ?? []) {
    const o = (repByUser[r.user_id] ??= { count: 0, last: "", energy: [] });
    o.count++; if (r.report_date > o.last) o.last = r.report_date; if (r.energy_level) o.energy.push(r.energy_level);
  }

  const annualTarget = await getConfigNumber_(sb);
  const { rows: tRows } = buildMonthlyTargets2026(annualTarget, {}, month);
  const teamTarget = tRows.find(r => r.month === month)?.target || 0;
  const saleUsers = (users ?? []).filter((u: any) => u.departments?.name === SALE_DEPT);
  const sumWeight = saleUsers.reduce((s: number, u: any) => s + weightFor(u.position), 0) || 1;

  const people = (users ?? []).map((u: any) => {
    const dept = u.departments?.name || t("(chưa gán)");
    const isSale = dept === SALE_DEPT;
    const rk = norm(u.full_name);
    const rev = revByName[rk];
    const weight = isSale ? weightFor(u.position) : 0;
    const target = weight > 0 ? Math.round(teamTarget * weight / sumWeight) : 0;
    const revenue = rev?.revenue || 0;

    let chatScore: number | null = null;
    for (const [sk, v] of Object.entries(chatBySale)) { if (rk.includes(sk)) { chatScore = Math.round(v.sum / v.n * 10) / 10; break; } }
    const rep = repByUser[u.id];
    return {
      id: u.id, name: u.full_name, position: u.position || "", dept, isSale,
      revenue, target, pct: target > 0 ? Math.round(revenue / target * 100) : null,
      orders: rev?.orders.size || 0, custs: rev?.custs.size || 0,
      chatScore, careMonth: careByName[rk] || 0, callsMonth: callByName[rk] || 0, chotMonth: chotByName[rk] || 0, reports: rep?.count || 0, lastReport: rep?.last || null,
      energyAvg: rep?.energy.length ? Math.round(rep.energy.reduce((a, b) => a + b, 0) / rep.energy.length * 10) / 10 : null,
    };
  });

  const aiKeys = await sb.from("config").select("key, value").like("key", `ai_person_%_${month}`);
  const aiCache: Record<string, string> = {};
  for (const r of aiKeys.data ?? []) { const id = r.key.replace("ai_person_", "").replace(`_${month}`, ""); aiCache[id] = r.value; }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{t("Đánh giá cá nhân")} — {month}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("Hiệu suất từng người theo phòng · đã qua")} {expectedPct}% {t("tháng. Sale có KPI + điểm chat; mọi người có báo cáo ngày.")}</p>
        </div>
        <form className="flex gap-2 items-center">
          <input type="month" name="m" defaultValue={month} className="p-2 border border-gray-200 rounded-lg text-sm" />
          <button className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm">{t("Xem")}</button>
        </form>
      </div>
      <PersonScorecards people={people} month={month} expectedPct={expectedPct} aiCache={aiCache} />
    </div>
  );
}

async function getConfigNumber_(sb: any): Promise<number> {
  const { data } = await sb.from("config").select("value").eq("key", CONFIG_KEY_ANNUAL_TARGET).maybeSingle();
  const n = Number(data?.value); return Number.isFinite(n) && n > 0 ? n : DEFAULT_ANNUAL_TARGET_2026;
}
