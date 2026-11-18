import { getServiceClient } from "@/lib/supabase-server";
import { NICK_SALE, tenGoiCuaNick } from "@/lib/zalo-nick-sale";
import { getConfigValue } from "@/lib/app-config";
import { CONFIG_KEY_ANNUAL_TARGET, DEFAULT_ANNUAL_TARGET_2026, buildMonthlyTargets2026 } from "@/lib/bi-targets";
import { loadOrderOverrides } from "@/lib/order-attribution";
import { doanhThuTheoSale } from "@/lib/doanh-thu";

export const SALE_DEPT = "Kinh Doanh & Sale";
export const norm = (s: string) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();

export const ACC_SALE: Record<string, string> = Object.fromEntries(Object.keys(NICK_SALE).map((id) => [id, tenGoiCuaNick(id) || ""]));

export function weightFor(pos?: string | null): number {
  const p = (pos || "").toLowerCase();
  if (/trực page|truc page/.test(p)) return 0;
  if (/leader/.test(p)) return 1.5;
  if (/thử việc|thu viec/.test(p)) return 0.7;
  return 1.0;
}

export type SaleMetric = {
  userId: string; name: string; position: string;
  revenue: number; target: number; pct: number | null;
  orders: number; custs: number;
  chatScore: number | null;
  careToday: number; careMonth: number;
  callsToday: number; callsMonth: number;
  unreplied: { count: number; oldestHours: number; oldestName: string } | null;
  rank: number; teamSize: number;
};

export type SucKhoeSoSale = {

  chuaRo: { net: number; don: number; ngay: string[] };
  canhBao: string[];
};

export async function getAllSaleMetrics(month: string): Promise<SaleMetric[]> {
  return (await getSaleMetricsFull(month)).metrics;
}

export async function getSaleMetricsFull(month: string): Promise<{ metrics: SaleMetric[] } & SucKhoeSoSale> {
  const sb = getServiceClient();
  const dim = new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate();
  const from = `${month}-01`, to = `${month}-${String(dim).padStart(2, "0")}`;

  const { data: users } = await sb.from("users")
    .select("id, full_name, position, active, departments!users_department_id_fkey(name)")
    .eq("active", true);
  const saleUsers = (users ?? []).filter((u: any) => u.departments?.name === SALE_DEPT);

  const ov = await loadOrderOverrides(sb);
  const dt = await doanhThuTheoSale(sb, from, to, {
    ov,
    dsSale: (users ?? []).filter((u: any) => u.full_name).map((u: any) => ({ ten: u.full_name })),
  });
  const revByName: Record<string, { revenue: number; orders: number; custs: number }> = {};
  for (const s of dt.theoSale) revByName[s.khoa] = { revenue: s.net, orders: s.don, custs: s.khach };

  const { data: chats } = await sb.from("salework_chat_analysis").select("account_id, score, analyzed_at")
    .gte("analyzed_at", from).lte("analyzed_at", to + "T23:59:59");
  const chatBySale: Record<string, { sum: number; n: number }> = {};
  for (const c of chats ?? []) {
    const sk = tenGoiCuaNick(c.account_id, c.analyzed_at); if (!sk || c.score == null) continue;
    const o = (chatBySale[sk] ??= { sum: 0, n: 0 }); o.sum += Number(c.score); o.n++;
  }

  const todayVN = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const { data: careRows } = await sb.from("customer_care_log").select("sale_name, last_contact")
    .gte("last_contact", from).lte("last_contact", to);
  const careMonthBy: Record<string, number> = {}, careTodayBy: Record<string, number> = {};
  for (const r of careRows ?? []) {
    const k = norm(r.sale_name || ""); if (!k) continue;
    careMonthBy[k] = (careMonthBy[k] || 0) + 1;
    if (r.last_contact === todayVN) careTodayBy[k] = (careTodayBy[k] || 0) + 1;
  }

  const callsTodayBy: Record<string, number> = {}, callsMonthBy: Record<string, number> = {};
  try {
    const cl = JSON.parse((await getConfigValue("call_log")) || "{}");
    for (const [d, bysale] of Object.entries(cl)) {
      if (!d.startsWith(month)) continue;
      for (const [sale, v] of Object.entries(bysale as any)) {
        const k = norm(sale); if (!k) continue;
        const n = typeof v === "number" ? v : ((v as any)?.n || 0);
        callsMonthBy[k] = (callsMonthBy[k] || 0) + n;
        if (d === todayVN) callsTodayBy[k] = (callsTodayBy[k] || 0) + n;
      }
    }
  } catch { }

  let unreplied: any = { bySale: [] };
  try { unreplied = JSON.parse((await getConfigValue("sale_unreplied")) || "{}"); unreplied.bySale ||= []; } catch { }
  const unrepBy: Record<string, any> = {};
  for (const u of unreplied.bySale) unrepBy[norm(u.sale)] = u;

  const annual = Number(await getConfigValue(CONFIG_KEY_ANNUAL_TARGET)) || DEFAULT_ANNUAL_TARGET_2026;
  const { rows: tRows } = buildMonthlyTargets2026(annual, {}, month);
  const teamTarget = tRows.find(r => r.month === month)?.target || 0;
  const sumWeight = saleUsers.reduce((s: number, u: any) => s + weightFor(u.position), 0) || 1;

  const metrics: SaleMetric[] = saleUsers.map((u: any) => {
    const rk = norm(u.full_name);
    const rev = revByName[rk];
    const weight = weightFor(u.position);
    const target = weight > 0 ? Math.round(teamTarget * weight / sumWeight) : 0;
    const revenue = rev?.revenue || 0;
    let chatScore: number | null = null;
    for (const [sk, v] of Object.entries(chatBySale)) { if (rk.includes(sk)) { chatScore = Math.round(v.sum / v.n * 10) / 10; break; } }
    let unrep: any = unrepBy[rk] || null;
    if (!unrep) for (const [sk, v] of Object.entries(unrepBy)) { if (sk && (rk.includes(sk) || sk.includes(rk))) { unrep = v; break; } }
    return {
      userId: u.id, name: u.full_name, position: u.position || "",
      revenue, target, pct: target > 0 ? Math.round(revenue / target * 100) : null,
      orders: rev?.orders || 0, custs: rev?.custs || 0,
      chatScore, careToday: careTodayBy[rk] || 0, careMonth: careMonthBy[rk] || 0,
      callsToday: callsTodayBy[rk] || 0, callsMonth: callsMonthBy[rk] || 0,
      unreplied: unrep ? { count: unrep.count || 0, oldestHours: unrep.oldestHours || 0, oldestName: unrep.oldestName || "" } : null,
      rank: 0, teamSize: saleUsers.length,
    };
  });

  metrics.sort((a, b) => b.revenue - a.revenue);
  metrics.forEach((m, i) => { m.rank = i + 1; });
  return { metrics, chuaRo: dt.chuaRo, canhBao: dt.suc.canhBao };
}

export async function getSaleSnapshot(userFullName: string, month: string): Promise<{ me: SaleMetric | null; leaderboard: SaleMetric[] }> {
  const all = await getAllSaleMetrics(month);
  const me = all.find(m => norm(m.name) === norm(userFullName)) || null;
  return { me, leaderboard: all };
}
