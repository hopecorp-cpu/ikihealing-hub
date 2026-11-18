import { getServiceClient } from "@/lib/supabase-server";
import { fmtVND } from "@/lib/payroll";
import { requireManager } from "@/lib/auth-server";
import { Briefcase, UserPlus, Search, Award } from "lucide-react";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

const STAGES: { v: string; l: string; c: string }[] = [
  { v: "new", l: "Mới", c: "bg-gray-100 text-gray-700" },
  { v: "screening", l: "Sàng lọc", c: "bg-blue-100 text-blue-700" },
  { v: "interview", l: "Phỏng vấn", c: "bg-yellow-100 text-yellow-700" },
  { v: "offer", l: "Offer", c: "bg-purple-100 text-purple-700" },
  { v: "hired", l: "Trúng tuyển", c: "bg-green-100 text-green-700" },
  { v: "rejected", l: "Loại", c: "bg-red-100 text-red-700" }
];

export default async function TuyenDungPage() {
  const { t } = getT();
  const user = await requireManager();

  const sb = getServiceClient();
  const [{ data: jobs }, { data: candidates }] = await Promise.all([
    sb.from("job_postings").select("*, departments(name, color)").order("opened_at", { ascending: false }),
    sb.from("candidates").select("*, job_postings(title), users!candidates_interviewer_id_fkey(full_name)").order("created_at", { ascending: false }).limit(100)
  ]);

  const all = candidates ?? [];
  const openJobs = (jobs ?? []).filter((j: any) => j.status === "open").length;
  const hired = all.filter((c: any) => c.status === "hired").length;
  const inPipeline = all.filter((c: any) => ["new", "screening", "interview", "offer"].includes(c.status)).length;

  const byStage: Record<string, any[]> = {};
  STAGES.forEach(s => byStage[s.v] = all.filter((c: any) => c.status === s.v));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Briefcase className="w-6 h-6 text-brand-600" /> {t("Tuyển dụng")}</h1>
        <div className="flex gap-2">
          <button className="px-4 py-2 border border-gray-200 rounded-lg text-sm">{t("+ Tin tuyển dụng")}</button>
          <button className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium">{t("+ Ứng viên")}</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label={t("VỊ TRÍ MỞ")} value={String(openJobs)} color="#1a73e8" icon={Briefcase} />
        <KPICard label={t("ỨNG VIÊN")} value={String(all.length)} color="#8B5CF6" icon={UserPlus} />
        <KPICard label={t("ĐANG XỬ LÝ")} value={String(inPipeline)} color="#F59E0B" icon={Search} />
        <KPICard label={t("TRÚNG TUYỂN")} value={String(hired)} color="#10B981" icon={Award} />
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
        <h3 className="font-semibold mb-3">{t("Vị trí đang tuyển")}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(jobs ?? []).filter((j: any) => j.status === "open").map((j: any) => {
            const applicants = all.filter((c: any) => c.job_id === j.id).length;
            return (
              <div key={j.id} className="border border-gray-200 rounded-lg p-4">
                <div className="font-semibold">{t(j.title)}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {j.departments?.name} · {j.salary_range || t("Thoả thuận")}
                </div>
                <div className="text-sm mt-2">
                  <b>{applicants}</b> {t("ứng viên · Cần")} <b>{j.required_count}</b>
                </div>
              </div>
            );
          })}
          {(!jobs || jobs.filter((j: any) => j.status === "open").length === 0) && (
            <div className="col-span-3 text-center py-4 text-gray-400 text-sm">{t("Chưa có vị trí mở")}</div>
          )}
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-3">{t("Pipeline ứng viên")}</h3>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {STAGES.map(s => (
            <div key={s.v} className="bg-gray-50 rounded-lg p-3">
              <div className={`text-xs font-semibold mb-2 px-2 py-1 rounded ${s.c}`}>{t(s.l)} ({byStage[s.v].length})</div>
              <div className="space-y-2">
                {byStage[s.v].slice(0, 5).map((c: any) => (
                  <div key={c.id} className="bg-white border border-gray-200 rounded p-2 text-xs">
                    <div className="font-semibold">{c.full_name}</div>
                    <div className="text-gray-500 mt-0.5">{c.position_applying || t(c.job_postings?.title) || "—"}</div>
                    {c.expected_salary && <div className="text-brand-700 mt-0.5">{fmtVND(c.expected_salary)}</div>}
                  </div>
                ))}
                {byStage[s.v].length === 0 && <div className="text-center py-3 text-gray-300 text-xs">—</div>}
                {byStage[s.v].length > 5 && <div className="text-xs text-gray-500 text-center">+{byStage[s.v].length - 5} {t("khác")}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
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
