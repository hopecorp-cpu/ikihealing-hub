import { requireUser } from "@/lib/auth-server";
import { getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { TasksBoard } from "./client";
import MayBoard from "./may-client";
import { listDepartmentsWithMembers } from "./actions";
import { listViecMay, tomTatMay } from "@/lib/viec-may";
import { ListTodo, Clock, AlertTriangle, CheckCircle2, Bot, PackageCheck, ShieldAlert } from "lucide-react";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function TasksPage({ searchParams }: { searchParams: { view?: string } }) {
  const { t: tDich } = getT();
  const user = await requireUser();
  const isManager = isManagerOrAbove(user.role);
  const view = searchParams.view || (isManager ? "team" : "mine");
  const sb = getServiceClient();

  if (view === "may") {
    const [runs, tt] = await Promise.all([listViecMay({ limit: 150 }), tomTatMay(1)]);
    const { t: tMay } = getT();
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <Header isManager={isManager} t={tMay} />
        <div className="inline-flex gap-1 bg-gray-100 p-1 rounded-xl">
          <ViewTab v="mine" current={view} label={tMay(tDich("Task của tôi"))} />
          {isManager && <ViewTab v="assigned" current={view} label={tMay(tDich("Tôi giao"))} />}
          {isManager && <ViewTab v="team" current={view} label={tMay(tDich("Toàn team"))} />}
          <ViewTab v="may" current={view} label={tMay(tDich("Máy"))} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI label={tMay(tDich("LƯỢT MÁY CHẠY"))} value={String(tt.tongLuot)} color="#6B7280" icon={Bot} />
          <KPI label={tMay(tDich("CHỜ DUYỆT"))} value={String(tt.choDuyet)} color="#8B5CF6" icon={PackageCheck} />
          <KPI label={tMay(tDich("CHẠY RA 0"))} value={String(tt.tongKhongCoGi)} color="#F59E0B" icon={ShieldAlert} />
          <KPI label={tMay(tDich("HỎNG"))} value={String(tt.tongHong)} color="#EF4444" icon={AlertTriangle} />
        </div>
        <MayBoard runs={runs as any} tomTat={tt} canDuyet={isManager} />
      </div>
    );
  }

  let q = sb.from("tasks").select(`
    *,
    assignee:users!tasks_assignee_id_fkey(full_name, position),
    assigner:users!tasks_assigner_id_fkey(full_name),
    target_department:departments!tasks_target_department_id_fkey(name)
  `).order("due_date", { ascending: true, nullsFirst: false });

  if (view === "mine") q = q.eq("assignee_id", user.id);
  else if (view === "assigned") q = q.eq("assigner_id", user.id);

  const [{ data: tasks }, { data: users }, departments] = await Promise.all([
    q.limit(200),
    sb.from("users").select("id, full_name, position, role").eq("active", true).order("full_name"),
    isManager ? listDepartmentsWithMembers() : Promise.resolve([] as Awaited<ReturnType<typeof listDepartmentsWithMembers>>),
  ]);

  const parentIds = (tasks ?? []).filter((t: any) => t.is_dept_summary).map((t: any) => t.id);
  let progressMap: Record<string, { done: number; total: number }> = {};
  if (parentIds.length > 0) {
    const { data: children } = await sb.from("tasks")
      .select("parent_task_id, status")
      .in("parent_task_id", parentIds);
    for (const c of children ?? []) {
      const pid = (c as any).parent_task_id;
      if (!progressMap[pid]) progressMap[pid] = { done: 0, total: 0 };
      progressMap[pid].total++;
      if ((c as any).status === "done") progressMap[pid].done++;
    }
  }

  for (const t of tasks ?? []) {
    if ((t as any).is_dept_summary) {
      (t as any).progress = progressMap[(t as any).id] || { done: 0, total: 0 };
    }
  }

  const maCC = (t: any) => String(t.description || "").match(/\[CC:([a-z0-9]+)\]/i)?.[1];
  if ((tasks ?? []).some((t: any) => maCC(t))) {
    const { anhChupHangDoi } = await import("@/lib/cc-queue");
    const cc = new Map((await anhChupHangDoi()).map((x) => [x.id, x] as const));
    for (const t of tasks ?? []) {
      const ma = maCC(t); const x = ma ? cc.get(ma) : undefined;
      if (!ma || (t as any).status === "done" || (t as any).status === "cancelled") continue;
      const pct = x?.status === "done" ? 100 : typeof x?.tienDo === "number" ? x.tienDo : 0;
      const nhan = !x ? "Claude Code" : x.status === "approved" ? "Claude Code · chờ máy nhận" : x.status === "failed" ? "Claude Code · trục trặc" : `Claude Code${x.buoc ? " · " + x.buoc : ""}`;
      (t as any).tienDo = { pct, nhan, that: true };
    }
  }
  const { PHAN_TRAM_TRANG_THAI } = await import("@/lib/brain-skills");
  for (const t of tasks ?? []) {
    const tt = t as any;
    if (tt.tienDo || tt.is_dept_summary || tt.assigner_id !== user.id || !(tt.status in PHAN_TRAM_TRANG_THAI) || tt.status === "done") continue;
    tt.tienDo = { pct: PHAN_TRAM_TRANG_THAI[tt.status], nhan: "theo trạng thái", that: false };
  }

  const all = tasks ?? [];
  const todoCount = all.filter((t: any) => t.status === "todo").length;
  const doingCount = all.filter((t: any) => t.status === "doing").length;
  const overdueCount = all.filter((t: any) => t.due_date && t.due_date < new Date().toISOString().slice(0, 10) && t.status !== "done" && t.status !== "cancelled").length;
  const doneToday = all.filter((t: any) => t.status === "done" && t.completed_at?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length;

  const { t } = getT();

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <Header isManager={isManager} t={t} />

      <div className="inline-flex gap-1 bg-gray-100 p-1 rounded-xl">
        <ViewTab v="mine" current={view} label={t("Task của tôi")} />
        {isManager && <ViewTab v="assigned" current={view} label={t("Tôi giao")} />}
        {isManager && <ViewTab v="team" current={view} label={t("Toàn team")} />}
        <ViewTab v="may" current={view} label={t("Máy")} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label={t("TODO")} value={String(todoCount)} color="#6B7280" icon={ListTodo} />
        <KPI label={t("ĐANG LÀM")} value={String(doingCount)} color="#3B82F6" icon={Clock} />
        <KPI label={t("QUÁ HẠN")} value={String(overdueCount)} color="#EF4444" icon={AlertTriangle} />
        <KPI label={t("DONE HÔM NAY")} value={String(doneToday)} color="#10B981" icon={CheckCircle2} />
      </div>

      <TasksBoard tasks={all} users={users ?? []} departments={departments} canAssign={isManager} currentUserId={user.id} />
    </div>
  );
}

function Header({ isManager, t }: { isManager: boolean; t: (s: string) => string }) {
  return (
    <div className="flex justify-between items-start flex-wrap gap-3">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2.5 text-gray-900">
          <span className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center"><ListTodo className="w-5 h-5 text-brand-600" /></span>
          {t("Bảng công việc")}
        </h1>
        <p className="text-sm text-gray-500 mt-1 ml-[46px]">{t("Kéo–thả thẻ giữa các cột để đổi trạng thái.")}</p>
      </div>
      {isManager && (
        <a href="/tasks/recurring"
          className="px-3.5 py-2 bg-white text-violet-700 border border-violet-200 rounded-xl text-sm font-semibold hover:bg-violet-50 inline-flex items-center gap-1.5 shadow-sm transition">
          {t("Task lặp lại →")}
        </a>
      )}
    </div>
  );
}

function ViewTab({ v, current, label }: any) {
  return (
    <a href={`/tasks?view=${v}`}
      className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition ${
        current === v ? "bg-white shadow-sm text-brand-700" : "text-gray-500 hover:text-gray-700"
      }`}>{label}</a>
  );
}

function KPI({ label, value, color, icon: Icon }: any) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-sm transition">
      <div className="flex justify-between items-center mb-2">
        <div className="text-[11px] text-gray-500 uppercase font-semibold tracking-wide">{label}</div>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + "1A" }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
    </div>
  );
}
