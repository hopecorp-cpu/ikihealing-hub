import { getServiceClient } from "@/lib/supabase-server";
import { fmtVND } from "@/lib/payroll";
import { requireManager } from "@/lib/auth-server";
import { GraduationCap, BookOpen, TrendingUp, Trophy } from "lucide-react";
import { HocVienTable } from "./HocVienTable";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  lead: { label: "Lead", color: "bg-gray-100 text-gray-700" },
  contacted: { label: "Đã liên hệ", color: "bg-blue-100 text-blue-700" },
  enrolled: { label: "Đã đăng ký", color: "bg-yellow-100 text-yellow-700" },
  learning: { label: "Đang học", color: "bg-purple-100 text-purple-700" },
  completed: { label: "Hoàn thành", color: "bg-green-100 text-green-700" },
  dropped: { label: "Bỏ học", color: "bg-orange-100 text-orange-700" },
  refunded: { label: "Hoàn tiền", color: "bg-red-100 text-red-700" }
};

export default async function HocVienPage({ searchParams }: { searchParams: { status?: string } }) {
  const { t } = getT();
  const user = await requireManager();

  const statusFilter = searchParams.status ?? "all";
  const sb = getServiceClient();

  let q = sb.from("students").select("*, courses(name, price), users!students_consultant_id_fkey(full_name)");
  if (statusFilter !== "all") q = q.eq("status", statusFilter);

  const [{ data: students }, { data: courses }] = await Promise.all([
    q.order("created_at", { ascending: false }).limit(100),
    sb.from("courses").select("*").eq("active", true)
  ]);

  const allStudents = students ?? [];
  const totalRevenue = allStudents.reduce((s: number, x: any) => s + (x.paid_amount || 0), 0);
  const learning = allStudents.filter((s: any) => s.status === "learning").length;
  const completed = allStudents.filter((s: any) => s.status === "completed").length;
  const leads = allStudents.filter((s: any) => s.status === "lead").length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2"><GraduationCap className="w-6 h-6 text-brand-600" /> {t("Học viên")}</h1>
        <button className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium">{t("+ Thêm học viên")}</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label={t("TỔNG HV")} value={String(allStudents.length)} color="#1a73e8" icon={GraduationCap} />
        <KPICard label={t("ĐANG HỌC")} value={String(learning)} color="#8B5CF6" icon={BookOpen} />
        <KPICard label={t("HOÀN THÀNH")} value={String(completed)} color="#10B981" icon={Trophy} />
        <KPICard label={t("DT KHOÁ HỌC")} value={fmtVND(totalRevenue)} color="#F59E0B" icon={TrendingUp} />
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
        <h3 className="font-semibold mb-3">{t("Khoá học đang mở")}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(courses ?? []).map((c: any) => {
            const studentsOfCourse = allStudents.filter((s: any) => s.course_id === c.id);
            return (
              <div key={c.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                <div className="font-semibold">{c.name}</div>
                <div className="text-xs text-gray-500 mt-1">{c.duration_days} {t("ngày")} · {fmtVND(c.price)}</div>
                <div className="text-sm mt-2">
                  <b>{studentsOfCourse.length}</b> {t("học viên ·")}
                  <b className="ml-1 text-brand-700">{fmtVND(studentsOfCourse.reduce((s: number, x: any) => s + (x.paid_amount || 0), 0))}</b>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <FilterPill href="/hoc-vien?status=all" active={statusFilter === "all"} label={`${t("Tất cả")} (${allStudents.length})`} />
        {Object.entries(STATUS_LABELS).map(([s, info]) => {
          const count = allStudents.filter((x: any) => x.status === s).length;
          return <FilterPill key={s} href={`/hoc-vien?status=${s}`} active={statusFilter === s} label={`${t(info.label)} (${count})`} />;
        })}
      </div>

      <HocVienTable students={students ?? []} />
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

function FilterPill({ href, active, label }: any) {
  return <a href={href} className={`px-3 py-1.5 rounded-md text-sm font-medium ${active ? "bg-brand-600 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}>{label}</a>;
}
