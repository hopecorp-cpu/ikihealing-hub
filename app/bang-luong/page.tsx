import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { tuChoiBod } from "@/lib/auth-server";
import { isAccountantPosition } from "@/lib/auth";
import { fmtVND } from "@/lib/payroll";
import { thangTruoc, vnHomNay } from "@/lib/luong-thang";
import { ExportButton } from "./export-button";
import { PayrollEditButton } from "./payroll-edit";
import { ApproveButton, RowApprove, PaidToggle } from "./approve-button";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

const isSalePos = (p?: string | null) => !!p && /(sale|leader|trực page|tư vấn)/i.test(p);

export default async function BangLuongPage({ searchParams }: { searchParams: { m?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  tuChoiBod(user);

  const isAdmin = user.role === "admin" || user.role === "ceo";
  const isAccountant = isAccountantPosition((user as any).position);
  if (!isAdmin && !isAccountant) redirect("/");
  const { t } = getT();

  const month = searchParams.m ?? thangTruoc(vnHomNay());
  const sb = getServiceClient();
  const { data: rows } = await sb.from("payroll").select("*, users!payroll_user_id_fkey(full_name, position, base_salary, insurance_salary, hourly_rate, contract_type)").eq("month", month).order("net_salary", { ascending: false });

  const allowanceOf = (r: any) =>
    (r.allowance_phone || 0) + (r.allowance_attendance || 0) + (r.allowance_lunch || 0) +
    (r.allowance_fuel || 0) + (r.allowances || 0);

  const pendingCount = (rows ?? []).filter((r: any) => r.status === "preview" || r.status === "draft").length;
  const approvedCount = (rows ?? []).filter((r: any) => r.status === "approved" || r.status === "paid").length;

  const total = (rows ?? []).reduce((s, r: any) => s + (r.net_salary || 0), 0);
  const totalBonus = (rows ?? []).reduce((s, r: any) => s + (r.bonus_amount || 0), 0);
  const totalCost = (rows ?? []).reduce((s, r: any) => s + (r.total_company_cost || 0), 0);
  const totalAllowance = (rows ?? []).reduce((s, r: any) => s + allowanceOf(r), 0);
  const totalDeduction = (rows ?? []).reduce((s, r: any) => s + (r.deduction_penalty || 0) + (r.advance_payment || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">{t("Bảng lương —")} {month}</h1>
        <div className="flex gap-3 items-center flex-wrap">
          <form className="flex gap-2 items-center">
            <input type="month" name="m" defaultValue={month} className="p-2 border border-gray-200 rounded-lg text-sm" />
            <button className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm">{t("Xem")}</button>
          </form>
          <ExportButton rows={rows ?? []} month={month} />
          <a href={`/bang-luong/run?m=${month}`} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-semibold inline-flex items-center gap-1">
            {t("Tính lương tự động")}
          </a>
          <a href="/admin/bonus-rules" className="px-3 py-2 border border-gray-200 rounded-lg text-sm">{t("Bậc thưởng")}</a>
        </div>
      </div>

      {(rows ?? []).length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-3 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-sm text-gray-600">
            {pendingCount > 0
              ? <><b>{pendingCount}</b> {t("dòng đang")} <b>{t("chờ duyệt")}</b> {t("— nhân viên CHƯA xem được phiếu lương. Kiểm tra số liệu rồi bấm Duyệt.")}</>
              : <>{t("✓ Bảng lương tháng này đã duyệt — nhân viên xem được phiếu lương.")}</>}
          </span>
          {isAdmin && <ApproveButton month={month} pendingCount={pendingCount} approvedCount={approvedCount} />}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-xs text-gray-500 uppercase">{t("Tổng thực lĩnh")}</div>
          <div className="text-2xl font-bold mt-1">{fmtVND(total)}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-xs text-gray-500 uppercase">{t("Tổng thưởng KPI")}</div>
          <div className="text-2xl font-bold mt-1 text-brand-700">{fmtVND(totalBonus)}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-xs text-gray-500 uppercase">{t("Tổng phụ cấp")}</div>
          <div className="text-2xl font-bold mt-1 text-green-600">{fmtVND(totalAllowance)}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-xs text-gray-500 uppercase">{t("Tổng khấu trừ")}</div>
          <div className="text-2xl font-bold mt-1 text-red-600">{fmtVND(totalDeduction)}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">{t("tạm ứng + khấu trừ khác")}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-xs text-gray-500 uppercase">{t("Tổng chi phí DN")}</div>
          <div className="text-2xl font-bold mt-1 text-orange-600">{fmtVND(totalCost)}</div>
        </div>
      </div>

      <p className="text-xs text-gray-400">{t("↔ Bảng cuộn ngang — bố cục theo mẫu kế toán (hạch toán chi phí). Phụ cấp ĐT/Chuyên cần/Ăn trưa/Xăng xe không chịu thuế & BH.")}</p>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-xs min-w-[1900px]">
          <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase">
            <tr>
              <th className="text-left p-2 sticky left-0 bg-gray-50 z-10">{t("Họ tên / Vị trí")}</th>
              <th className="text-right p-2">{t("Lương CB")}</th>
              <th className="text-right p-2">{t("Gross")}</th>
              <th className="text-center p-2">{t("NC (TT/Ch)")}</th>
              <th className="text-right p-2">{t("Lương theo NC")}</th>
              <th className="text-right p-2 bg-green-50">{t("PC Điện thoại")}</th>
              <th className="text-right p-2 bg-green-50">{t("PC Chuyên cần")}</th>
              <th className="text-right p-2 bg-green-50">{t("PC Ăn trưa")}</th>
              <th className="text-right p-2 bg-green-50">{t("PC Xăng xe")}</th>
              <th className="text-right p-2 bg-brand-50">{t("Thưởng/KPI")}</th>
              <th className="text-right p-2">{t("Tổng thu nhập")}</th>
              <th className="text-right p-2">{t("BH NLĐ 10.5%")}</th>
              <th className="text-right p-2">{t("Giảm trừ BT")}</th>
              <th className="text-right p-2">{t("TNTT")}</th>
              <th className="text-right p-2">{t("Thuế TNCN")}</th>
              <th className="text-right p-2">{t("Tạm ứng")}</th>
              <th className="text-right p-2 bg-red-50">{t("Khấu trừ khác")}</th>
              <th className="text-right p-2 bg-emerald-50 font-bold">{t("THỰC LĨNH")}</th>
              <th className="text-left p-2">{t("Tình trạng TK")}</th>
              <th className="text-left p-2">{t("Thanh toán")}</th>
              <th className="text-right p-2 bg-orange-50">{t("BH DN 21.5%")}</th>
              <th className="text-right p-2 bg-orange-50 font-bold">{t("Tổng CP DN")}</th>
              <th className="text-right p-2">{t("% Thuế/Gross")}</th>
              <th className="text-center p-2 sticky right-0 bg-gray-50 z-10">{t("Sửa")}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {(rows ?? []).map((r: any) => {
              const taxPct = r.gross_salary ? ((r.personal_income_tax || 0) / r.gross_salary * 100) : 0;
              const statusLabel: Record<string, string> = { draft: t("Chờ duyệt"), preview: t("Chờ duyệt"), approved: t("Đã duyệt"), paid: t("Đã trả") };
              return (
              <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="p-2 sticky left-0 bg-white z-10">
                  <div className="font-medium whitespace-nowrap">{r.users?.full_name}</div>
                  <div className="text-[10px] text-gray-500 whitespace-nowrap">{r.users?.position}</div>
                  <div className="text-[10px] whitespace-nowrap">
                    {isSalePos(r.users?.position) && <span className="text-blue-600">{t("DT net")} {fmtVND(r.sales_revenue_net || 0)}</span>}
                    {r.livestream_bonus > 0 && <span className="text-pink-600 ml-1">{t("Live")} +{fmtVND(r.livestream_bonus)}</span>}
                  </div>
                </td>
                <td className="p-2 text-right text-gray-600">{fmtVND(r.base_salary)}</td>
                <td className="p-2 text-right">{fmtVND(r.gross_salary)}</td>
                <td className="p-2 text-center">{r.working_days_actual}/{r.working_days_standard}</td>
                <td className="p-2 text-right">{fmtVND(r.salary_by_workdays)}</td>
                <td className="p-2 text-right text-green-700 bg-green-50/40">{r.allowance_phone ? fmtVND(r.allowance_phone) : "—"}</td>
                <td className="p-2 text-right text-green-700 bg-green-50/40">{r.allowance_attendance ? fmtVND(r.allowance_attendance) : "—"}</td>
                <td className="p-2 text-right text-green-700 bg-green-50/40">{r.allowance_lunch ? fmtVND(r.allowance_lunch) : "—"}</td>
                <td className="p-2 text-right text-green-700 bg-green-50/40">{r.allowance_fuel ? fmtVND(r.allowance_fuel) : "—"}</td>
                <td className="p-2 text-right text-brand-700 bg-brand-50/40">{fmtVND(r.bonus_amount)}</td>
                <td className="p-2 text-right font-medium">{fmtVND(r.total_income)}</td>
                <td className="p-2 text-right text-red-600">-{fmtVND(r.employee_insurance)}</td>
                <td className="p-2 text-right text-gray-500">{fmtVND(r.personal_deduction)}</td>
                <td className="p-2 text-right">{fmtVND(r.taxable_income)}</td>
                <td className="p-2 text-right text-red-600">-{fmtVND(r.personal_income_tax)}</td>
                <td className="p-2 text-right text-orange-600">{r.advance_payment ? "-" + fmtVND(r.advance_payment) : "—"}</td>
                <td className="p-2 text-right text-red-600 bg-red-50/40">{r.deduction_penalty ? "-" + fmtVND(r.deduction_penalty) : "—"}</td>
                <td className="p-2 text-right font-bold bg-emerald-50/50">{fmtVND(r.net_salary)}</td>
                <td className="p-2 whitespace-nowrap">{isAdmin ? <RowApprove payrollId={r.id} status={r.status} /> : <span className="text-[11px] text-gray-400">{r.status}</span>}</td>
                <td className="p-2 whitespace-nowrap">{isAdmin ? <PaidToggle payrollId={r.id} status={r.status} /> : null}</td>
                <td className="p-2 text-right text-gray-500 bg-orange-50/40">{fmtVND(r.employer_insurance)}</td>
                <td className="p-2 text-right font-semibold bg-orange-50/40">{fmtVND(r.total_company_cost)}</td>
                <td className="p-2 text-right text-gray-500">{taxPct.toFixed(1)}%</td>
                <td className="p-2 text-center sticky right-0 bg-white z-10">{isAdmin ? <PayrollEditButton row={r} /> : null}</td>
              </tr>
            );})}
            {(!rows || rows.length === 0) && (
              <tr><td colSpan={24} className="p-8 text-center text-gray-400">
                {t("Chưa có bảng lương — bấm \"Chốt lương tháng này\" để tự tính")}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
