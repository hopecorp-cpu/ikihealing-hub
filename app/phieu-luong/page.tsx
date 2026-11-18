import { redirect } from "next/navigation";

import { getCurrentUser, getServerClient, getServiceClient } from "@/lib/supabase-server";
import { tuChoiBod } from "@/lib/auth-server";
import { fmtVND, explainSaleCommission, saleKpiTarget } from "@/lib/payroll";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function PhieuLuongPage({ searchParams }: { searchParams: { m?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  tuChoiBod(user);
  const { t } = getT();
  const month = searchParams.m ?? new Date().toISOString().slice(0, 7);

  const sb = getServiceClient();

  const VISIBLE = ["approved", "paid"];
  const [{ data: ps }, { data: history }, { data: attr }] = await Promise.all([
    sb.from("payroll").select("*").eq("user_id", user.id).eq("month", month).in("status", VISIBLE).maybeSingle(),
    sb.from("payroll").select("month,net_salary,bonus_amount,status").eq("user_id", user.id).in("status", VISIBLE).order("month", { ascending: false }).limit(12),
    sb.from("revenue_attribution").select("*").eq("user_id", user.id).eq("month", month),
  ]);

  const misa = (attr ?? []).find((a: any) => a.source_platform === "misa");
  const courseRev = (attr ?? []).filter((a: any) => a.source_platform === "course").reduce((s: number, a: any) => s + Number(a.revenue_amount || 0), 0);
  const totalNet = (attr ?? []).reduce((s: number, a: any) => s + Number(a.revenue_amount || 0), 0);

  const isSale = /(sale|leader|tư vấn)/i.test((user as any).position || "");
  const tier = totalNet > 0 && isSale ? explainSaleCommission(totalNet, saleKpiTarget((user as any).position)) : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">{t("Phiếu lương")}</h1>
        <form className="flex items-center gap-2">
          <label className="text-sm">{t("Tháng:")}</label>
          <input type="month" name="m" defaultValue={month} className="p-2 border border-gray-200 rounded-lg text-sm" />
          <button className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm">{t("Xem")}</button>
        </form>
      </div>

      {!ps ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          {t("Chưa có phiếu lương cho tháng")} {month}.<br />
          <span className="text-xs">{t("HR/Admin sẽ chốt vào cuối tháng.")}</span>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {ps.hours_worked > 0
              ? <Card label={t("Giờ làm")} value={`${ps.hours_worked} ${t("giờ")}`} />
              : <Card label={t("Lương Gross")} value={fmtVND(ps.gross_salary)} />}
            <Card label={t("NC thực tế")} value={ps.hours_worked > 0 ? "—" : `${ps.working_days_actual}/${ps.working_days_standard}`} />
            <Card label={t("Thưởng / HH")} value={fmtVND((ps.bonus_amount || 0) + (ps.livestream_bonus || 0))} />
            <Card label={t("Thực lĩnh")} value={fmtVND(ps.net_salary)} hi />
          </div>

          <div className="text-xs font-bold text-gray-400 uppercase mb-1">{t("① Thu nhập của bạn")}</div>
          <table className="w-full text-sm mb-4">
            <tbody>
              {ps.hours_worked > 0
                ? <Row k={`${t("Lương theo giờ")} (${ps.hours_worked}h × ${fmtVND(ps.hourly_rate || 0)})`} v={fmtVND(ps.salary_by_workdays)} />
                : <Row k={`${t("Lương theo ngày công")} (${ps.working_days_actual}/${ps.working_days_standard})`} v={fmtVND(ps.salary_by_workdays)} />}
              {ps.bonus_amount > 0 && <Row k={t("Thưởng / Hoa hồng KPI")} v={`+${fmtVND(ps.bonus_amount)}`} />}
              {ps.livestream_bonus > 0 && <Row k={t("Thưởng livestream")} v={`+${fmtVND(ps.livestream_bonus)}`} />}
              {ps.sales_revenue_net > 0 && <Row k={t("Doanh số bạn mang về (net)")} v={fmtVND(ps.sales_revenue_net)} muted />}
              <Row k={t("TỔNG THU NHẬP")} v={fmtVND(ps.total_income)} bold />
            </tbody>
          </table>

          <div className="text-xs font-bold text-gray-400 uppercase mb-1">{t("② Khấu trừ")}</div>
          <table className="w-full text-sm mb-4">
            <tbody>
              <Row k={t("BH NLĐ đóng (10.5% × LCB)")} v={ps.employee_insurance ? `-${fmtVND(ps.employee_insurance)}` : "—"} />
              <Row k={t("Giảm trừ bản thân (NQ 110/2025)")} v={`-${fmtVND(ps.personal_deduction)}`} muted />
              {ps.dependent_count > 0 && <Row k={`${t("Người phụ thuộc")} (${ps.dependent_count})`} v={`-${fmtVND(ps.dependent_deduction)}`} muted />}
              <Row k={t("Thu nhập tính thuế")} v={fmtVND(ps.taxable_income)} muted />
              <Row k={t("Thuế TNCN (5 bậc 2026)")} v={ps.personal_income_tax ? `-${fmtVND(ps.personal_income_tax)}` : "—"} />
              {ps.advance_payment > 0 && <Row k={t("Tạm ứng")} v={`-${fmtVND(ps.advance_payment)}`} />}
              <Row k={t("THỰC LĨNH (bạn nhận)")} v={fmtVND(ps.net_salary)} bold hi />
            </tbody>
          </table>

          <div className="p-4 rounded-xl bg-orange-50 border border-orange-200">
            <div className="text-xs font-bold text-orange-700 uppercase mb-2">{t("③ Chi phí công ty THỰC CHI cho bạn")}</div>
            <table className="w-full text-sm">
              <tbody>
                <Row k={t("Tổng thu nhập của bạn")} v={fmtVND(ps.total_income)} />
                <Row k={t("BH công ty đóng thêm (21.5% × LCB)")} v={ps.employer_insurance ? `+${fmtVND(ps.employer_insurance)}` : "—"} />
                <tr className="border-t-2 border-orange-200">
                  <td className="p-3 font-bold text-orange-800">{t("TỔNG CHI PHÍ CÔNG TY")}</td>
                  <td className="p-3 text-right tabular-nums font-bold text-orange-800 text-base">{fmtVND(ps.total_company_cost)}</td>
                </tr>
              </tbody>
            </table>
            <p className="text-[11px] text-orange-600 mt-1">{t("Tổng chi phí thực tế công ty bỏ ra cho bạn (lương + thưởng + phần BHXH-BHYT công ty đóng thêm ngoài lương).")}</p>
          </div>

          {tier && (
            <div className="mt-5 p-4 rounded-xl bg-brand-50 border border-brand-200">
              <div className="text-sm font-semibold text-brand-800 mb-2">{t("Doanh số & hoa hồng của bạn")}</div>

              {misa && (misa.gross_amount > 0) && (
                <table className="w-full text-sm mb-3">
                  <tbody>
                    <Row k={t("Tiền hàng (đơn bán)")} v={fmtVND(misa.gross_amount)} />
                    <Row k={t("− Phí giao hàng trả đối tác")} v={`-${fmtVND(misa.shipping_fee || 0)}`} muted />
                    <Row k={t("− Khuyến mại / giảm giá")} v={`-${fmtVND(misa.promotion || 0)}`} muted />
                    <Row k={t("− Thuế VAT")} v={`-${fmtVND(misa.tax_amount || 0)}`} muted />
                    <Row k={t("= Doanh số SẢN PHẨM (net)")} v={fmtVND(misa.revenue_amount)} bold />
                  </tbody>
                </table>
              )}

              <table className="w-full text-sm mb-3">
                <tbody>
                  {misa && <Row k={t("Doanh số sản phẩm (net)")} v={fmtVND(misa.revenue_amount)} />}
                  {courseRev > 0 && <Row k={t("Doanh số khoá học (net)")} v={fmtVND(courseRev)} />}
                  <Row k={t("TỔNG DOANH SỐ TÍNH THƯỞNG (net)")} v={fmtVND(totalNet)} bold hi />
                </tbody>
              </table>

              <div className="p-3 rounded-lg bg-white border border-brand-100">
                <div className="flex justify-between items-center flex-wrap gap-1">
                  <span className="text-sm">{t("Đạt")} <b className="text-brand-700">{tier.kpiPct}% KPI</b> ({t("mốc")} {Math.round(saleKpiTarget((user as any).position) / 1e6)}tr) → {t("bậc")} <b>{tier.pct}</b></span>
                  <span className="text-base font-bold text-brand-700">{fmtVND(ps.bonus_amount)}</span>
                </div>
                <div className="text-[12px] text-gray-500 mt-1">{t("Cách tính hoa hồng:")} {tier.formula}{ps.livestream_bonus > 0 ? ` · + livestream ${fmtVND(ps.livestream_bonus)}` : ""}</div>
              </div>
              <p className="text-[11px] text-gray-400 mt-2">{t("Hoa hồng tính trên")} <b>{t("doanh số NET")}</b> {t("(sau khi trừ phí giao hàng, khuyến mại, thuế VAT) — nên thấp hơn \"tiền hàng\" hiển thị ở đơn.")}</p>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100"><h2 className="font-semibold">{t("Lịch sử thực lĩnh")}</h2></div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr><th className="text-left p-3">{t("Tháng")}</th><th className="text-right p-3">{t("Thưởng")}</th><th className="text-right p-3">{t("Thực lĩnh")}</th><th className="text-left p-3">{t("Trạng thái")}</th></tr>
          </thead>
          <tbody>
            {(history ?? []).map(h => (
              <tr key={h.month} className="border-t border-gray-100">
                <td className="p-3 font-medium">{h.month}</td>
                <td className="p-3 text-right">{fmtVND(h.bonus_amount)}</td>
                <td className="p-3 text-right font-semibold text-brand-700">{fmtVND(h.net_salary)}</td>
                <td className="p-3">{h.status}</td>
              </tr>
            ))}
            {(!history || history.length === 0) && <tr><td colSpan={4} className="p-8 text-center text-gray-400">{t("Chưa có lịch sử")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, value, hi }: { label: string; value: string; hi?: boolean }) {
  return (
    <div className={`p-4 rounded-lg border ${hi ? "border-brand-200 bg-brand-50" : "border-gray-200 bg-gray-50"}`}>
      <div className="text-xs text-gray-500 uppercase">{label}</div>
      <div className={`text-lg font-bold mt-1 ${hi ? "text-brand-700" : ""}`}>{value}</div>
    </div>
  );
}
function Row({ k, v, bold, hi, muted }: { k: string; v: string; bold?: boolean; hi?: boolean; muted?: boolean }) {
  return (
    <tr className={`border-t border-gray-100 ${hi ? "bg-brand-50" : ""}`}>
      <td className={`p-3 ${muted ? "text-gray-500" : ""}`}>{k}</td>
      <td className={`p-3 text-right tabular-nums ${bold ? "font-bold" : ""} ${hi ? "text-brand-700" : ""} ${muted ? "text-gray-500" : ""}`}>{v}</td>
    </tr>
  );
}
