import { getServiceClient } from "@/lib/supabase-server";
import { fmtVND } from "@/lib/payroll";
import { requireManager } from "@/lib/auth-server";
import { FolderKanban, ListTodo, CheckCircle2, Clock } from "lucide-react";
import { getT } from "@/lib/i18n-server";
import { getPortfolio } from "@/lib/portfolio";
import PortfolioCockpit from "./PortfolioCockpit";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; color: string }> = {
  planning: { label: "Lập kế hoạch", color: "bg-gray-100 text-gray-700" },
  active: { label: "Đang chạy", color: "bg-green-100 text-green-700" },
  paused: { label: "⏸ Tạm dừng", color: "bg-yellow-100 text-yellow-700" },
  done: { label: "Xong", color: "bg-blue-100 text-blue-700" },
  cancelled: { label: "Huỷ", color: "bg-red-100 text-red-700" }
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-gray-500",
  medium: "text-blue-600",
  high: "text-orange-600",
  urgent: "text-red-600 font-bold"
};

export default async function DuAnPage() {
  const { t: tDich } = getT();
  const user = await requireManager();
  const { t } = getT();

  const sb = getServiceClient();
  const [{ data: projects }, { data: tasks }, portfolio] = await Promise.all([
    sb.from("projects").select("*, departments(name, color), users!projects_owner_id_fkey(full_name)").order("due_date", { ascending: true, nullsFirst: false }),
    sb.from("project_tasks").select("*, projects(name)").order("due_date", { ascending: true, nullsFirst: false }).limit(50),
    getPortfolio(),
  ]);

  const all = projects ?? [];
  const active = all.filter((p: any) => p.status === "active").length;
  const done = all.filter((p: any) => p.status === "done").length;
  const overdueTasks = (tasks ?? []).filter((t: any) => t.due_date && t.due_date < new Date().toISOString().slice(0, 10) && t.status !== "done").length;
  const myTasks = (tasks ?? []).filter((t: any) => t.assignee_id === user.id && t.status !== "done").length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2"><FolderKanban className="w-6 h-6 text-brand-600" /> {t("Quản lý dự án")}</h1>
      </div>

      <PortfolioCockpit items={portfolio as any} />

      <h2 className="text-lg font-bold flex items-center gap-2 pt-2"><ListTodo className="w-5 h-5 text-gray-400" /> {t("Dự án nội bộ (giao việc & tiến độ)")}</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label={t("DỰ ÁN")} value={String(all.length)} color="#1a73e8" icon={FolderKanban} />
        <KPICard label={t("ĐANG CHẠY")} value={String(active)} color="#10B981" icon={Clock} />
        <KPICard label={t("HOÀN THÀNH")} value={String(done)} color="#8B5CF6" icon={CheckCircle2} />
        <KPICard label={t("TASK QUÁ HẠN")} value={String(overdueTasks)} color="#EF4444" icon={ListTodo} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {all.map((p: any) => {
          const stat = STATUS[p.status] || { label: p.status, color: "bg-gray-100" };
          return (
            <div key={p.id} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5 hover:shadow-md transition">
              <div className="flex justify-between items-start gap-2 mb-2">
                <div className="font-bold flex-1">{p.name}</div>
                <span className={`px-2 py-0.5 rounded text-xs flex-shrink-0 ${stat.color}`}>{t(stat.label)}</span>
              </div>
              {tDich(p.description) && <p className="text-sm text-gray-600 line-clamp-2 mb-3">{tDich(p.description)}</p>}

              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{t("Sơn độ")}</span>
                  <span>{p.progress_percent}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-brand-500 to-brand-700" style={{ width: `${p.progress_percent}%` }} />
                </div>
              </div>

              <div className="flex justify-between text-xs text-gray-500">
                <span>{p.users?.full_name || "—"}</span>
                <span className={PRIORITY_COLORS[p.priority] || ""}>{p.priority}</span>
              </div>
              {p.due_date && (
                <div className="text-xs text-gray-500 mt-1">{t("Deadline:")} {p.due_date}</div>
              )}
            </div>
          );
        })}
        {all.length === 0 && (
          <div className="col-span-3 text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
            <FolderKanban className="w-12 h-12 mx-auto mb-3 opacity-30" />
            {t("Chưa có dự án nào — bấm \"+ Dự án mới\" để tạo")}
          </div>
        )}
      </div>

      {myTasks > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
          <h3 className="font-semibold mb-3">{t("Task của tôi đang mở")} ({myTasks})</h3>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="text-left p-2">{t("Task")}</th>
                <th className="text-left p-2">{t("Dự án")}</th>
                <th className="text-left p-2">{t("Priority")}</th>
                <th className="text-left p-2">{t("Deadline")}</th>
              </tr>
            </thead>
            <tbody>
              {(tasks ?? []).filter((t: any) => t.assignee_id === user.id && t.status !== "done").slice(0, 10).map((t: any) => (
                <tr key={t.id} className="border-t border-gray-100">
                  <td className="p-2 font-medium">{tDich(t.title)}</td>
                  <td className="p-2 text-xs">{t.projects?.name}</td>
                  <td className={`p-2 text-xs ${PRIORITY_COLORS[t.priority] || ""}`}>{t.priority}</td>
                  <td className="p-2 text-xs">{t.due_date || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function KPICard({ label, value, color, icon: Icon }: any) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-gray-500 uppercase font-semibold">{label}</div>
        {Icon && <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + "22" }}><Icon className="w-4 h-4" style={{ color }} /></div>}
      </div>
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
    </div>
  );
}
