import { requireAdmin, tuChoiBod } from "@/lib/auth-server";
import { getT } from "@/lib/i18n-server";
import { listContracts } from "./actions";
import Link from "next/link";
import { FileSignature, Plus, CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react";
import { fmtVND } from "@/lib/payroll";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  thu_viec: "Thử việc",
  xac_dinh_1_nam: "XĐ 1 năm",
  xac_dinh_2_nam: "XĐ 2 năm",
  khong_xac_dinh: "Không xác định",
  ctv: "CTV",
  khoan_viec: "Khoán việc",
};

const STATUS_CFG: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Nháp", color: "bg-gray-100 text-gray-700", icon: AlertCircle },
  pending_signatures: { label: "Chờ ký", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  signed_by_employee: { label: "NV đã ký", color: "bg-blue-100 text-blue-700", icon: Clock },
  signed_by_employer: { label: "Công ty đã ký", color: "bg-blue-100 text-blue-700", icon: Clock },
  active: { label: "Có hiệu lực", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  expired: { label: "Hết hạn", color: "bg-gray-100 text-gray-500", icon: XCircle },
  terminated: { label: "Đã chấm dứt", color: "bg-red-100 text-red-700", icon: XCircle },
};

export default async function ContractsListPage() {
  tuChoiBod(await requireAdmin());
  const { t } = getT();
  const contracts = await listContracts();

  const stats = {
    total: contracts.length,
    active: contracts.filter((c: any) => c.status === "active").length,
    pending: contracts.filter((c: any) => c.status === "pending_signatures" || c.status === "signed_by_employee" || c.status === "signed_by_employer").length,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileSignature className="w-6 h-6 text-brand-600" /> {t("Hợp đồng lao động")}
        </h1>
        <Link href="/admin/contracts/new"
          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-semibold inline-flex items-center gap-1">
          <Plus className="w-4 h-4" /> {t("Tạo HĐ mới")}
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <KPI label={t("TỔNG HĐ")} value={stats.total} color="#3B82F6" />
        <KPI label={t("ĐANG HIỆU LỰC")} value={stats.active} color="#10B981" />
        <KPI label={t("CHỜ KÝ")} value={stats.pending} color="#F59E0B" pulse={stats.pending > 0} />
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="text-left p-3">{t("Số HĐ")}</th>
              <th className="text-left p-3">{t("Nhân viên")}</th>
              <th className="text-left p-3">{t("Loại")}</th>
              <th className="text-left p-3">{t("Thời hạn")}</th>
              <th className="text-right p-3">{t("Lương")}</th>
              <th className="text-left p-3">{t("Trạng thái")}</th>
              <th className="text-right p-3"></th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((c: any) => {
  const { t: t } = getT();
              const cfg = STATUS_CFG[c.status] || STATUS_CFG.draft;
              const Icon = cfg.icon;
              return (
                <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="p-3 tabular-nums text-xs font-semibold">{c.contract_number}</td>
                  <td className="p-3">
                    <div className="font-medium">{c.user?.full_name}</div>
                    <div className="text-xs text-gray-500">{c.position}</div>
                  </td>
                  <td className="p-3 text-xs">{t(TYPE_LABEL[c.contract_type]) ? t(TYPE_LABEL[c.contract_type]) : c.contract_type}</td>
                  <td className="p-3 text-xs">
                    {c.effective_date} {c.end_date ? `→ ${c.end_date}` : `→ ${t("vô thời hạn")}`}
                    {c.probation_end_date && <div className="text-amber-700 mt-0.5">{t("Thử việc đến")} {c.probation_end_date}</div>}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {fmtVND(c.base_salary)}
                    {c.salary_pct < 100 && <div className="text-xs text-amber-600">{c.salary_pct}%</div>}
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded inline-flex items-center gap-1 ${cfg.color}`}>
                      <Icon className="w-3 h-3" /> {t(cfg.label)}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <Link href={`/admin/contracts/${c.id}`} className="text-xs text-brand-600 hover:underline">
                      {t("Xem")} →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {contracts.length === 0 && (
              <tr><td colSpan={7} className="p-12 text-center text-gray-400">
                {t('Chưa có HĐ nào — bấm "Tạo HĐ mới"')}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KPI({ label, value, color, pulse }: any) {
  return (
    <div className={`bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4 ${pulse ? "ring-2 ring-yellow-200 animate-pulse" : ""}`}>
      <div className="text-xs uppercase font-semibold text-gray-500">{label}</div>
      <div className="text-2xl font-bold mt-1" style={{ color }}>{value}</div>
    </div>
  );
}
