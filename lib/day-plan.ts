import { getServiceClient } from "@/lib/supabase-server";
import { vnDateStr } from "@/lib/payroll";
import { getConfigValue, setConfigValue } from "@/lib/app-config";

export type TaskKind = "goi" | "noi-dung" | "so-lieu" | "quan-tri" | "khac";

export type PlanTask = {
  id: string;
  title: string;
  priority: string | null;
  due_date: string | null;
  status: string;
  assignee_id: string | null;
  assignee_name: string;
  estimated_hours: number | null;
  kind: TaskKind;
  overdue: boolean;
};

export type SlotDef = {
  key: string;
  label: string;
  from: string;
  to: string;
  hint: string;
  kinds: TaskKind[];
  cap: number;
};

export const SLOTS: SlotDef[] = [
  { key: "mo-ngay", label: "Mở ngày", from: "08:00", to: "09:00", hint: "Xem số hôm qua, chốt 3 việc quan trọng nhất", kinds: ["so-lieu"], cap: 1 },
  { key: "vang-sang", label: "Khung vàng sáng — gọi & chốt", from: "09:00", to: "11:30", hint: "Giờ khách dễ nghe máy nhất. Chỉ gọi và chốt, không họp", kinds: ["goi"], cap: 3 },
  { key: "giua-ngay", label: "Giữa ngày — việc nhẹ", from: "11:30", to: "13:30", hint: "Nhắn tin, trả inbox, việc không cần tập trung sâu", kinds: ["noi-dung", "khac"], cap: 1 },
  { key: "vang-chieu", label: "Khung vàng chiều — gọi & việc chuyên môn", from: "13:30", to: "16:30", hint: "Gọi tiếp tệp còn lại, rồi tới việc cần nghĩ sâu", kinds: ["goi", "quan-tri", "noi-dung"], cap: 3 },
  { key: "dong-ngay", label: "Đóng ngày — báo cáo & nhập số", from: "16:30", to: "17:30", hint: "Nộp báo cáo, đối chiếu sổ, chuẩn bị việc mai", kinds: ["so-lieu", "quan-tri"], cap: 1 },
];

export function kindOf(title: string): TaskKind {
  const t = (title || "").toLowerCase();
  if (/g[oọ]i|chu k[yỳ] đ[aặ]t l[aạ]i|telesales|ch[oố]t đơn|ch[aă]m s[oó]c|kh[aá]ch t[oớ]i h[aạ]n|xin c[aả]m nh[aậ]n|case study/.test(t)) return "goi";
  if (/b[aà]i|content|n[oộ]i dung|đ[aă]ng|vi[eế]t|reels|video|[aả]nh|fanpage|blog/.test(t)) return "noi-dung";
  if (/b[aá]o c[aá]o|đ[oố]i chi[eế]u|s[oổ]|doanh thu|chi ph[ií]|k[eế] to[aá]n|c[oô]ng n[ơợ]|t[oồ]n kho|s[oố] li[eệ]u/.test(t)) return "so-lieu";
  if (/tuy[eể]n|quy đ[iị]nh|h[oọ]p|h[oợ]p đ[oồ]ng|b[aà]n giao|playbook|ch[ií]nh s[aá]ch|nh[aâ]n s[ưự]/.test(t)) return "quan-tri";
  return "khac";
}

const PRIO_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const rankOf = (p: string | null) => PRIO_RANK[String(p || "medium").toLowerCase()] ?? 2;

const DAY_SCOPED = [/^\s*\[chu k[yỳ] đ[aặ]t l[aạ]i\]/i, /^\s*\[[^\]]+\][^\n]*đ[eế]n h[aạ]n h[oô]m nay/i];
export const isDayScoped = (title: string) => DAY_SCOPED.some((re) => re.test(title || ""));

function callCountOf(title: string): number {
  const m = /g[oọ]i\s+(\d+)\s+kh[aá]ch/i.exec(title || "");
  return m ? Number(m[1]) || 0 : 0;
}

export type ExpireResult = {
  expired: number;
  missedCalls: number;
  byPerson: Record<string, { tasks: number; calls: number }>;
  oldest: string | null;
};

export async function expireStaleDayTasks(dryRun = false): Promise<ExpireResult> {
  const sb = getServiceClient();
  const today = vnDateStr();
  const { data } = await sb
    .from("tasks")
    .select("id, title, due_date, assignee_id")
    .in("status", ["todo", "doing", "review", "blocked"])
    .not("due_date", "is", null)
    .lt("due_date", today)
    .limit(500);

  const rows = (data || []).filter((t: any) => isDayScoped(t.title));
  const out: ExpireResult = { expired: 0, missedCalls: 0, byPerson: {}, oldest: null };
  if (!rows.length) return out;

  const names = await userNames(sb, rows.map((r: any) => r.assignee_id));
  for (const t of rows as any[]) {
    const who = names[t.assignee_id] || "(chưa giao)";
    const calls = callCountOf(t.title);
    (out.byPerson[who] ??= { tasks: 0, calls: 0 });
    out.byPerson[who].tasks++;
    out.byPerson[who].calls += calls;
    out.expired++;
    out.missedCalls += calls;
    if (!out.oldest || t.due_date < out.oldest) out.oldest = t.due_date;
  }

  if (!dryRun) {

    const byDue: Record<string, string[]> = {};
    for (const t of rows as any[]) (byDue[t.due_date] ??= []).push(t.id);
    for (const [due, ids] of Object.entries(byDue)) {
      const { error } = await sb
        .from("tasks")
        .update({
          status: "cancelled",
          blocker_reason: `Hết hiệu lực: việc của ngày ${due}, máy sinh theo ngày nên qua ngày là hết nghĩa. Khách chưa gọi KHÔNG mất — vẫn nằm ở /cham-soc-kh và máy sinh lại việc mới hôm sau.`,
          updated_at: new Date().toISOString(),
        })
        .in("id", ids);
      if (error) throw new Error(`Đóng việc hết hiệu lực thất bại (${due}): ${error.message}`);
    }
    await setConfigValue(
      "day_plan_expired_last",
      JSON.stringify({ date: today, at: new Date().toISOString(), ...out }),
      "Lần dọn việc hết hiệu lực gần nhất (trợ lý chia việc theo ngày)",
    );
  }
  return out;
}

async function userNames(sb: any, ids: (string | null)[]): Promise<Record<string, string>> {
  const uniq = Array.from(new Set(ids.filter(Boolean))) as string[];
  if (!uniq.length) return {};
  const { data } = await sb.from("users").select("id, full_name").in("id", uniq);
  return Object.fromEntries((data || []).map((u: any) => [u.id, u.full_name]));
}

export type PlannedSlot = { slot: SlotDef; tasks: PlanTask[] };
export type PlanDay = { date: string; label: string; slots: PlannedSlot[]; count: number };
export type DayPlan = {
  person: string;
  days: PlanDay[];
  overload: PlanTask[];
  totalOpen: number;
  overdue: number;
  cap: number;
};

const dayLabel = (offset: number) => (offset === 0 ? "Hôm nay" : offset === 1 ? "Ngày mai" : "Ngày kia");
const addDays = (d: string, n: number) => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

export function planTasks(tasks: PlanTask[], opts?: { cap?: number; days?: number; today?: string }): DayPlan {
  const cap = opts?.cap ?? 6;
  const nDays = opts?.days ?? 3;
  const today = opts?.today ?? vnDateStr();
  const horizon = addDays(today, nDays - 1);

  const inWindow = tasks.filter((t) => !t.due_date || t.due_date <= horizon);
  const sorted = [...inWindow].sort(
    (a, b) =>
      Number(b.overdue) - Number(a.overdue) ||
      rankOf(a.priority) - rankOf(b.priority) ||
      String(a.due_date || "9999").localeCompare(String(b.due_date || "9999")) ||
      a.title.localeCompare(b.title),
  );

  const days: PlanDay[] = Array.from({ length: nDays }, (_, i) => ({
    date: addDays(today, i),
    label: dayLabel(i),
    slots: SLOTS.map((slot) => ({ slot, tasks: [] as PlanTask[] })),
    count: 0,
  }));
  const overload: PlanTask[] = [];

  for (const t of sorted) {
    let placed = false;
    for (const day of days) {

      if (t.due_date && day.date < t.due_date) continue;
      if (day.count >= cap) continue;

      const fit = day.slots.find((s) => s.slot.kinds.includes(t.kind) && s.tasks.length < s.slot.cap)
        ?? day.slots.find((s) => s.tasks.length < s.slot.cap);
      if (!fit) continue;
      fit.tasks.push(t);
      day.count++;
      placed = true;
      break;
    }
    if (!placed) overload.push(t);
  }

  return {
    person: "",
    days,
    overload,
    totalOpen: tasks.length,
    overdue: tasks.filter((t) => t.overdue).length,
    cap,
  };
}

export async function buildDayPlan(assigneeId?: string | null, opts?: { cap?: number }): Promise<DayPlan> {
  const sb = getServiceClient();
  const today = vnDateStr();
  let q = sb
    .from("tasks")
    .select("id, title, priority, due_date, status, assignee_id, estimated_hours")
    .in("status", ["todo", "doing", "review", "blocked"])
    .limit(300);
  if (assigneeId) q = q.eq("assignee_id", assigneeId);
  const { data } = await q;

  const names = await userNames(sb, (data || []).map((t: any) => t.assignee_id));
  const tasks: PlanTask[] = (data || [])

    .filter((t: any) => !(isDayScoped(t.title) && t.due_date && t.due_date < today))
    .map((t: any) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      due_date: t.due_date,
      status: t.status,
      assignee_id: t.assignee_id,
      assignee_name: names[t.assignee_id] || "(chưa giao)",
      estimated_hours: t.estimated_hours,
      kind: kindOf(t.title),
      overdue: !!t.due_date && t.due_date < today,
    }));

  const cap = opts?.cap ?? (await getConfigNumberSafe("day_plan_cap", 6));
  const plan = planTasks(tasks, { cap, today });
  plan.person = assigneeId ? tasks[0]?.assignee_name || "" : "Toàn công ty";
  return plan;
}

async function getConfigNumberSafe(key: string, fallback: number): Promise<number> {
  try {
    const v = await getConfigValue(key);
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  } catch {
    return fallback;
  }
}

export function planToTelegram(plan: DayPlan, expired?: ExpireResult): string {
  const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const L: string[] = [`\u{1F5D3}\u{FE0F} <b>KẾ HOẠCH NGÀY</b> — ${plan.days[0]?.date || ""}`];

  if (expired && expired.expired > 0) {
    L.push("", `\u{1F9F9} Đã dọn <b>${expired.expired}</b> việc hết hiệu lực (máy sinh theo ngày, đã qua ngày).`);
    if (expired.missedCalls > 0) L.push(`   \u{2192} tương ứng <b>${expired.missedCalls} lượt gọi</b> đã trôi qua không ai gọi. Khách vẫn còn ở /cham-soc-kh.`);
  }

  const d0 = plan.days[0];
  if (d0) {
    L.push("", `<b>HÔM NAY</b> — ${d0.count}/${plan.cap} việc`);
    for (const s of d0.slots) {
      if (!s.tasks.length) continue;
      L.push(`\u{23F0} <b>${s.slot.from}-${s.slot.to} · ${esc(s.slot.label)}</b>`);
      for (const t of s.tasks) L.push(`   • ${esc(t.title.slice(0, 80))}${t.overdue ? " (quá hạn)" : ""}`);
    }
    if (!d0.count) L.push("   (trống — hôm nay không có việc nào đến hạn)");
  }

  const rest = plan.days.slice(1).filter((d) => d.count > 0);
  if (rest.length) {
    L.push("", `<b>ĐÃ ĐẨY SANG NGÀY SAU</b> (để hôm nay không quá tải):`);
    for (const d of rest) L.push(`• ${d.label} (${d.date}): ${d.count} việc`);
  }

  if (plan.overload.length) {
    L.push("", `\u{26A0}\u{FE0F} <b>QUÁ TẢI: ${plan.overload.length} việc không còn chỗ trong 3 ngày.</b>`);
    L.push(`Đây là lúc BỎ BỚT hoặc giao người khác, không phải nhồi thêm:`);
    for (const t of plan.overload.slice(0, 5)) L.push(`   • ${esc(t.title.slice(0, 80))}`);
    if (plan.overload.length > 5) L.push(`   • …và ${plan.overload.length - 5} việc nữa`);
  }

  L.push("", `Xem đầy đủ: /ke-hoach-ngay`);
  return L.join("\n");
}
