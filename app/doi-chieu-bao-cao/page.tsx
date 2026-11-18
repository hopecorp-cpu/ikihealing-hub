import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { vnDateStr, fmtVND } from "@/lib/payroll";
import { computeReportReconcile, type MetricRow, type PersonReconcile } from "@/lib/report-reconcile";
import { ClipboardCheck, AlertTriangle, CheckCircle2, Info } from "lucide-react";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Đối chiếu báo cáo ↔ số đo | ACME Ops Hub") };
}

const val = (m: MetricRow, v: number) => (m.money ? fmtVND(v) : String(v));

export default async function DoiChieuBaoCaoPage() {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove(user.role)) redirect("/?denied=doichieubaocao");

  const sb = getServiceClient();
  const today = vnDateStr();
  const r = await computeReportReconcile(sb, today);

  const sales = r.people.filter(p => p.kind === "sale");
  const mkt = r.people.filter(p => p.kind === "mkt");

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-indigo-600" strokeWidth={1.75} />
            {t("Đối chiếu báo cáo tự khai ↔ số đo")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("So số nhân viên TỰ KHAI trong báo cáo cuối ngày với số ĐO thực tế (đơn/doanh số từ MISA, gọi từ call log, bài đăng từ Content log). Đơn & doanh số là cờ cứng; gọi/bài đăng chỉ tham khảo (nguồn cũng tự log).")}
          </p>
        </div>
        <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg self-start">{t("Ngày")} {today.slice(8)}/{today.slice(5, 7)}/{today.slice(0, 4)}</span>
      </div>

      {!r.measurable && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-sm">
          <Info className="w-5 h-5 shrink-0 mt-0.5" strokeWidth={1.75} />
          <span>{t("MISA chưa có dữ liệu đơn hàng cho ngày này (chưa đồng bộ / ngày nghỉ). Chưa đo được nên KHÔNG đánh cờ đơn & doanh số — đợi MISA về (tối) rồi so lại.")}</span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card label={t("Người lệch cần xem")} value={String(r.flagged.length)} tone={r.flagged.length ? "red" : "green"} />
        <Card label={t("Chưa nộp báo cáo")} value={String(r.notReported.length)} tone={r.notReported.length ? "amber" : "green"} />
        <Card label={t("Đã nộp & so")} value={String(r.people.length)} tone="gray" />
      </div>

      <ReconTable title={t("Sale — đơn & doanh số vs MISA")} people={sales} empty={t("Chưa có sale nào nộp báo cáo hôm nay.")} />
      <ReconTable title={t("Marketing — số bài vs Content log")} people={mkt} empty={t("Chưa có MKT nào nộp báo cáo hôm nay.")} />

      <section className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
        <h2 className="font-bold mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" strokeWidth={1.75} />{t("Chưa nộp báo cáo cuối ngày (")}{r.notReported.length})</h2>
        {r.notReported.length === 0 ? (
          <p className="text-sm text-gray-400 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" strokeWidth={1.75} />{t("Cả nhóm đã nộp.")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {r.notReported.map((u, i) => (
              <span key={i} className="text-xs px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-100">{u.name} <span className="text-amber-400">· {u.dept}</span></span>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-gray-400 leading-relaxed">
        {t("Lệch KHÔNG mặc định là khai ảo — có thể do đơn ghi nhận trễ, đổi tên sale, hoặc MISA về muộn. Đây là bảng để quản lý xem và đào thêm 1 lớp trước khi kết luận. Ngưỡng lệch chỉnh ở config")} <code>reconcile_thresholds</code>.
      </p>
    </div>
  );
}

function Card({ label, value, tone }: { label: string; value: string; tone: "red" | "amber" | "green" | "gray" }) {
  const c = { red: "text-red-600", amber: "text-amber-600", green: "text-emerald-600", gray: "text-gray-700" }[tone];
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${c}`}>{value}</div>
    </div>
  );
}

function ReconTable({ title, people, empty }: { title: string; people: PersonReconcile[]; empty: string }) {
  const { t: t } = getT();
  return (
    <section className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
      <h2 className="font-bold mb-3">{title}</h2>
      {people.length === 0 ? (
        <p className="text-sm text-gray-400 py-3 text-center">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="text-left p-2">{t("Nhân viên")}</th>
                <th className="text-left p-2">{t("Chỉ số")}</th>
                <th className="text-right p-2">{t("Tự khai")}</th>
                <th className="text-right p-2">{t("Đo được")}</th>
                <th className="text-right p-2">{t("Lệch")}</th>
              </tr>
            </thead>
            <tbody>
              {people.map(p => p.metrics.map((m, mi) => (
                <tr key={p.userId + m.key} className={`border-t border-gray-100 ${m.flagged ? "bg-red-50" : ""}`}>
                  {mi === 0 && <td className="p-2 font-medium align-top" rowSpan={p.metrics.length}>{p.name}{p.anyFlagged && <AlertTriangle className="inline w-3.5 h-3.5 text-red-500 ml-1 -mt-0.5" strokeWidth={2} />}</td>}
                  <td className="p-2 text-gray-600">{t(m.label)}{!m.hard && <span className="text-[10px] text-gray-400 ml-1">{t("(tham khảo)")}</span>}</td>
                  <td className="p-2 text-right tabular-nums">{val(m, m.reported)}</td>
                  <td className="p-2 text-right tabular-nums">{val(m, m.measured)}</td>
                  <td className={`p-2 text-right tabular-nums ${m.flagged ? "font-bold text-red-600" : "text-gray-400"}`}>{m.diff > 0 ? "+" : ""}{val(m, m.diff)}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
