import { computeAuto } from "./sales-checklist";
import { norm } from "./sale-metrics";
import { isSalePosition, isMktPosition, isCskhPosition, isKhoPosition, isAccountantPosition } from "./auth";
import { getConfigValue } from "./app-config";
import { layDoanhThu } from "./doanh-thu";

export type Thresholds = {
  revenuePct: number;
  revenueAbs: number;
  ordersAbs: number;
  callsAbs: number;
};
export const DEFAULT_THRESHOLDS: Thresholds = { revenuePct: 0.2, revenueAbs: 500_000, ordersAbs: 2, callsAbs: 5 };

export type MetricRow = {
  key: string;
  label: string;
  reported: number;
  measured: number;
  diff: number;
  money: boolean;
  hard: boolean;
  flagged: boolean;
};
export type PersonReconcile = {
  userId: string;
  name: string;
  kind: "sale" | "mkt";
  metrics: MetricRow[];
  anyFlagged: boolean;
};
export type FlaggedEntry = { userId: string; name: string; kind: "sale" | "mkt"; lines: MetricRow[] };
export type ReconcileResult = {
  date: string;
  measurable: boolean;
  misaRows: number;
  thresholds: Thresholds;
  people: PersonReconcile[];
  flagged: FlaggedEntry[];
  notReported: { name: string; dept: string }[];
};

async function loadThresholds(): Promise<Thresholds> {
  try {
    const v = JSON.parse((await getConfigValue("reconcile_thresholds")) || "null");
    if (v && typeof v === "object") return { ...DEFAULT_THRESHOLDS, ...v };
  } catch { }
  return DEFAULT_THRESHOLDS;
}

const expectsReport = (position?: string | null) =>
  isSalePosition(position) || isMktPosition(position) || isCskhPosition(position) || isKhoPosition(position) || isAccountantPosition(position);

const deptOf = (u: any): string => u?.departments?.name || u?.position || "—";

export async function computeReportReconcile(sb: any, date: string): Promise<ReconcileResult> {
  const th = await loadThresholds();

  const { data: usersRaw } = await sb.from("users")
    .select("id, full_name, position, active, departments!users_department_id_fkey(name)")
    .eq("active", true);
  const users = (usersRaw ?? []) as any[];

  const { data: reps } = await sb.from("daily_reports")
    .select("user_id, status, orders_closed, revenue_today, calls_made, customer_interactions, fields")
    .eq("report_date", date);
  const repByUser = new Map<string, any>();
  for (const r of reps ?? []) if (r.status === "submitted") repByUser.set(r.user_id, r);

  const { rows: donNgay } = await layDoanhThu(sb, date, date);
  const misaRows = new Set(donNgay.map((r) => r.order_code)).size;
  const measurable = misaRows > 0;

  const { data: ci } = await sb.from("content_items").select("author_id, publish_date, created_at");
  const postsByAuthor = new Map<string, number>();
  for (const c of ci ?? []) {
    const d = (c.publish_date || c.created_at || "").slice(0, 10);
    if (d !== date || !c.author_id) continue;
    postsByAuthor.set(c.author_id, (postsByAuthor.get(c.author_id) || 0) + 1);
  }

  const people: PersonReconcile[] = [];
  const notReported: { name: string; dept: string }[] = [];

  const saleUsers = users.filter(u => isSalePosition(u.position));
  const saleAuto = await Promise.all(saleUsers.map(u =>
    repByUser.has(u.id) ? computeAuto(sb, u.full_name, date, u.id) : Promise.resolve(null)
  ));
  saleUsers.forEach((u, i) => {
    const rep = repByUser.get(u.id);
    if (!rep) return;
    const auto = saleAuto[i]!;
    const orders: MetricRow = mkMetric("orders", "Đơn chốt", num(rep.orders_closed), auto.orders, false, true);

    const revenue: MetricRow = mkMetric("revenue", "Doanh số", num(rep.revenue_today), num(auto.revenueGross), true, true);
    const calls: MetricRow = mkMetric("calls", "Cuộc gọi", num(rep.calls_made), auto.calls, false, false);

    orders.flagged = measurable && (Math.abs(orders.diff) >= th.ordersAbs || (orders.reported >= 1 && orders.measured === 0));
    const rBase = Math.max(revenue.reported, revenue.measured, 1);
    revenue.flagged = measurable && Math.abs(revenue.diff) >= th.revenueAbs && Math.abs(revenue.diff) / rBase >= th.revenuePct;
    calls.flagged = Math.abs(calls.diff) >= th.callsAbs;
    const metrics = [orders, revenue, calls];
    people.push({ userId: u.id, name: u.full_name, kind: "sale", metrics, anyFlagged: metrics.some(m => m.flagged) });
  });

  for (const u of users.filter(x => isMktPosition(x.position))) {
    const rep = repByUser.get(u.id);
    if (!rep) continue;
    const f = rep.fields || {};
    const reportedPosts = ["posts_fb", "posts_tiktok", "posts_youtube", "posts_website"].reduce((a, k) => a + num(f[k]), 0);
    const measuredPosts = postsByAuthor.get(u.id) || 0;
    const posts = mkMetric("posts", "Bài đăng", reportedPosts, measuredPosts, false, false);
    posts.flagged = Math.abs(posts.diff) >= 2;
    people.push({ userId: u.id, name: u.full_name, kind: "mkt", metrics: [posts], anyFlagged: posts.flagged });
  }

  for (const u of users) {
    if (!expectsReport(u.position)) continue;
    if (repByUser.has(u.id)) continue;
    notReported.push({ name: u.full_name, dept: deptOf(u) });
  }

  const flagged: FlaggedEntry[] = people
    .filter(p => p.anyFlagged)
    .map(p => ({ userId: p.userId, name: p.name, kind: p.kind, lines: p.metrics.filter(m => m.flagged) }));

  return { date, measurable, misaRows, thresholds: th, people, flagged, notReported };
}

const num = (v: any) => Number(v) || 0;
function mkMetric(key: string, label: string, reported: number, measured: number, money: boolean, hard: boolean): MetricRow {
  return { key, label, reported, measured, diff: reported - measured, money, hard, flagged: false };
}
