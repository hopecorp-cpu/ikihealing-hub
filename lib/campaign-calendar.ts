import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { computeRevenueLoop } from "@/lib/revenue-loop";
import { getContentPlan } from "@/lib/content-plan-server";
import { buildSlots, FUNNEL_LABEL, type Funnel, type ContentPlan } from "@/lib/content-plan";

export type CalStatus = "planned" | "drafted" | "published";
export type DaySlot = { date: string; weekday: string; funnel: Funnel; pillar: string; status: CalStatus };
export type WeekPlan = { week: number; from: string; to: string; funnel: Funnel; theme: string; postsPlanned: number; slots: DaySlot[] };
export type MonthPlan = {
  month: string; target: number; gap: number; quarterLabel: string;
  behind: boolean; focus: string; postsPerWeek: number;
  weeks: WeekPlan[]; generatedAt: string;
};

const KEY = "campaign_calendar";
const WD = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const pad = (n: number) => String(n).padStart(2, "0");
const vnd = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n || 0)) + "đ";

export async function getCalendar(): Promise<Record<string, MonthPlan>> {
  try { const raw = await getConfigValue(KEY); if (raw) { const o = JSON.parse(raw); if (o && typeof o === "object") return o.months || o; } } catch { }
  return {};
}
export async function getMonthPlan(month: string): Promise<MonthPlan | null> {
  const all = await getCalendar();
  return all[month] || null;
}
async function saveMonthPlan(plan: MonthPlan): Promise<void> {
  const all = await getCalendar();
  all[plan.month] = plan;
  await setConfigValue(KEY, JSON.stringify({ months: all, updatedAt: new Date().toISOString() }));
}

export async function slotsForDate(date: string): Promise<DaySlot[]> {
  const plan = await getMonthPlan(date.slice(0, 7));
  if (!plan) return [];
  return plan.weeks.flatMap((w) => w.slots).filter((s) => s.date === date);
}

export async function markSlots(date: string, status: Exclude<CalStatus, "planned">, n = 99): Promise<number> {
  const month = date.slice(0, 7);
  const all = await getCalendar();
  const plan = all[month];
  if (!plan) return 0;
  const bac: Record<CalStatus, number> = { planned: 0, drafted: 1, published: 2 };
  let doi = 0;
  for (const w of plan.weeks) {
    for (const s of w.slots) {
      if (doi >= n) break;
      if (s.date !== date) continue;
      if (bac[s.status] >= bac[status]) continue;
      s.status = status;
      doi++;
    }
  }
  if (doi) await setConfigValue(KEY, JSON.stringify({ months: all, updatedAt: new Date().toISOString() }));
  return doi;
}

export type ThongKeThang = {
  month: string; coLich: boolean;
  daXep: number; daViet: number; daDang: number;
  theoTang: Record<Funnel, number>;
  target: number; behind: boolean;
};
export type QuarterRollup = {
  quarter: string;
  label: string;
  months: ThongKeThang[];
  daXep: number; daViet: number; daDang: number;
  theoTang: Record<Funnel, number>;
  tyLeTang: Record<Funnel, number>;
  thangTrong: string[];
  tyLeThucThi: number;
  nhanXet: string;
};

export function monthsOfQuarter(quarter: string): string[] {
  const m = /^(\d{4})-Q([1-4])$/.exec(quarter);
  if (!m) return [];
  const y = Number(m[1]), q = Number(m[2]);
  return [0, 1, 2].map((i) => `${y}-${pad((q - 1) * 3 + 1 + i)}`);
}

export function quarterOfMonth(month: string): string {
  const [y, mo] = month.split("-").map(Number);
  return `${y}-Q${Math.floor((mo - 1) / 3) + 1}`;
}

export async function getQuarterRollup(quarter: string): Promise<QuarterRollup> {
  const all = await getCalendar();
  const ms = monthsOfQuarter(quarter);
  const zero = (): Record<Funnel, number> => ({ TOFU: 0, MOFU: 0, BOFU: 0 });

  const months: ThongKeThang[] = ms.map((month) => {
    const p = all[month];
    if (!p) return { month, coLich: false, daXep: 0, daViet: 0, daDang: 0, theoTang: zero(), target: 0, behind: false };
    const slots = p.weeks.flatMap((w) => w.slots);
    const theoTang = zero();
    for (const s of slots) theoTang[s.funnel]++;
    return {
      month, coLich: true,
      daXep: slots.length,
      daViet: slots.filter((s) => s.status !== "planned").length,
      daDang: slots.filter((s) => s.status === "published").length,
      theoTang, target: p.target || 0, behind: !!p.behind,
    };
  });

  const theoTang = zero();
  for (const m of months) for (const f of ["TOFU", "MOFU", "BOFU"] as Funnel[]) theoTang[f] += m.theoTang[f];
  const daXep = months.reduce((s, m) => s + m.daXep, 0);
  const daViet = months.reduce((s, m) => s + m.daViet, 0);
  const daDang = months.reduce((s, m) => s + m.daDang, 0);
  const tong = theoTang.TOFU + theoTang.MOFU + theoTang.BOFU;
  const tyLeTang = {
    TOFU: tong ? Math.round((theoTang.TOFU / tong) * 100) : 0,
    MOFU: tong ? Math.round((theoTang.MOFU / tong) * 100) : 0,
    BOFU: tong ? Math.round((theoTang.BOFU / tong) * 100) : 0,
  } as Record<Funnel, number>;
  const thangTrong = months.filter((m) => !m.coLich).map((m) => m.month);
  const tyLeThucThi = daXep ? Math.round((daDang / daXep) * 100) : 0;

  let nhanXet: string;
  if (thangTrong.length === months.length) nhanXet = "Cả quý chưa dựng lịch tháng nào — bấm Sinh lịch cho từng tháng trước đã.";
  else if (thangTrong.length) nhanXet = `Còn ${thangTrong.length} tháng chưa dựng lịch (${thangTrong.join(", ")}) — nhịp quý đang hổng.`;
  else if (daXep && tyLeThucThi < 40) nhanXet = `Mới đăng ${tyLeThucThi}% số bài đã xếp — kế hoạch đang nằm trên giấy, không phải thiếu kế hoạch.`;
  else if (tyLeTang.BOFU >= 50) nhanXet = `Quý này nghiêng CHỐT (${tyLeTang.BOFU}% BOFU) — bán được ngay nhưng tệp mới không được nuôi, quý sau sẽ hụt.`;
  else if (tyLeTang.TOFU >= 65) nhanXet = `Quý này nghiêng NUÔI (${tyLeTang.TOFU}% TOFU) — tệp dày lên nhưng ít bài chốt, doanh thu trong quý sẽ chậm.`;
  else nhanXet = `Phễu cân (${tyLeTang.TOFU}/${tyLeTang.MOFU}/${tyLeTang.BOFU}) và đã đăng ${tyLeThucThi}% số bài đã xếp.`;

  const y = quarter.slice(0, 4), q = quarter.slice(-1);
  return { quarter, label: `Quý ${q}/${y}`, months, daXep, daViet, daDang, theoTang, tyLeTang, thangTrong, tyLeThucThi, nhanXet };
}

const POST_DOW_ORDER = [1, 3, 5, 2, 4, 6, 0];

export async function generateMonthPlan(month: string, opts?: { postsPerWeek?: number }): Promise<MonthPlan> {
  const loop: any = await computeRevenueLoop(month).catch(() => null);
  const plan: ContentPlan = await getContentPlan();
  const [y, mo] = month.split("-").map(Number);
  const daysInMonth = new Date(y, mo, 0).getDate();

  const days: { d: number; dow: number }[] = [];
  for (let d = 1; d <= daysInMonth; d++) days.push({ d, dow: new Date(y, mo - 1, d).getDay() });
  const weekOf: Record<number, number> = {};
  let wk = 1;
  for (let i = 0; i < days.length; i++) { if (i > 0 && days[i].dow === 1) wk++; weekOf[days[i].d] = wk; }
  const weekNums = Array.from(new Set(Object.values(weekOf)));

  const behind = !!loop && (loop.finLight === "red" || loop.pacePct < loop.expectedPct - 5);
  const gap = Math.max(0, loop?.needGap || 0);
  const postsPerWeek = Math.min(5, Math.max(1, opts?.postsPerWeek || 3));

  const weekSlots = buildSlots(plan, weekNums.length, mo);
  const weekFunnels: Funnel[] = weekNums.map((_, i) => weekSlots[i]?.funnel || "TOFU");
  if (behind) {
    const half = Math.ceil(weekNums.length / 2);
    for (let i = weekNums.length - half; i < weekNums.length; i++) weekFunnels[i] = "BOFU";
  }

  const pillarsByFunnel: Record<Funnel, string[]> = { TOFU: [], MOFU: [], BOFU: [] };
  for (const p of plan.pillars) pillarsByFunnel[p.funnel].push(p.name);

  const weeks: WeekPlan[] = weekNums.map((weekNo, wi) => {
    const daysInWeek = days.filter((x) => weekOf[x.d] === weekNo);
    const funnel = weekFunnels[wi];
    const chosenDows = POST_DOW_ORDER.slice(0, postsPerWeek);
    const pillars = pillarsByFunnel[funnel].length ? pillarsByFunnel[funnel] : [FUNNEL_LABEL[funnel]];
    const slots: DaySlot[] = [];
    let pc = wi;
    for (const dow of chosenDows) {
      const day = daysInWeek.find((x) => x.dow === dow);
      if (!day) continue;
      const date = `${y}-${pad(mo)}-${pad(day.d)}`;
      slots.push({ date, weekday: WD[dow], funnel, pillar: pillars[pc % pillars.length], status: "planned" });
      pc++;
    }
    slots.sort((a, b) => a.date.localeCompare(b.date));
    const from = daysInWeek.length ? `${y}-${pad(mo)}-${pad(daysInWeek[0].d)}` : month + "-01";
    const to = daysInWeek.length ? `${y}-${pad(mo)}-${pad(daysInWeek[daysInWeek.length - 1].d)}` : month + "-01";
    return { week: weekNo, from, to, funnel, theme: `${FUNNEL_LABEL[funnel]} — ${pillars[wi % pillars.length]}`, postsPlanned: slots.length, slots };
  });

  const focus = behind
    ? `Chậm nhịp → DỒN CHỐT (BOFU) các tuần cuối để gỡ gap ${vnd(gap)}.`
    : `Đúng nhịp → cân phễu TOFU/MOFU/BOFU theo tuyến bài, nuôi tệp cho ${loop?.quarter?.label || "quý"}.`;

  const monthPlan: MonthPlan = {
    month, target: loop?.monthTarget || 0, gap, quarterLabel: loop?.quarter?.label || "",
    behind, focus, postsPerWeek, weeks, generatedAt: new Date().toISOString(),
  };
  await saveMonthPlan(monthPlan);
  return monthPlan;
}
