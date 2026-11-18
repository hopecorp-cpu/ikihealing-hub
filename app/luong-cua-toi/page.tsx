import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { tuChoiBod } from "@/lib/auth-server";
import { getAllSaleMetrics } from "@/lib/sale-metrics";
import { saleKpiTarget, calcSaleCommissionNet, explainSaleCommission, vnDateStr } from "@/lib/payroll";
import { PageHeader, Badge } from "@/components/ui/kit";
import { Wallet, TrendingUp, Trophy } from "lucide-react";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Lương của tôi | IKIHEALING Hub") };
}

const tr = (n: number) => `${(Math.round(n / 1e5) / 10).toLocaleString("vi-VN")}tr`;
const dong = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}đ`;

export default async function Page() {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  tuChoiBod(user);

  const month = vnDateStr().slice(0, 7);
  const all = await getAllSaleMetrics(month).catch(() => []);
  const me = all.find((m) => m.userId === user.id);

  if (!me) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <PageHeader title={t("Lương của tôi")} subtitle={`Tháng ${month}`} icon={Wallet} />
        <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-[13px] text-gray-500">
          {t("Trang này dành cho đội kinh doanh — hệ thống chưa thấy chỉ tiêu doanh số của bạn trong tháng này.\n          Nếu bạn là sale mà chưa thấy số, báo quản lý kiểm tra phần gán đơn giúp.")}
        </div>
      </div>
    );
  }

  const target = saleKpiTarget(me.position);
  const dsNet = me.revenue;
  const ex = explainSaleCommission(dsNet, target);
  const kpiPct = ex.kpiPct;

  const marks = [0.5, 0.8, 1, 2].map((r) => ({ r, value: target * r }));
  const next = marks.find((m) => dsNet < m.value);
  const nextGain = next ? calcSaleCommissionNet(next.value, target) - ex.commission : 0;

  const day = Number(vnDateStr().slice(8, 10));
  const dim = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const pace = Math.round((dsNet / Math.max(1, day)) * dim);
  const paceCommission = calcSaleCommissionNet(pace, target);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <PageHeader
        title={t("Lương của tôi")}
        subtitle={`Tháng ${month} · cập nhật theo đơn đã về hệ thống`}
        icon={Wallet}
        actions={
          <div className="px-3 py-1.5 rounded-xl text-sm font-bold bg-emerald-50 text-emerald-700">
            {t("Hoa hồng tạm tính")} {dong(ex.commission)}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
          <div className="text-[11px] uppercase tracking-wide text-gray-400">{t("Doanh số tháng này")}</div>
          <div className="text-2xl font-bold text-gray-800 tabular-nums">{tr(dsNet)}</div>
          <div className="text-[12px] text-gray-500">/ mốc 100% là {tr(target)} {t("· đạt")} <b>{kpiPct}%</b></div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
          <div className="text-[11px] uppercase tracking-wide text-gray-400">{t("Bậc hiện tại")}</div>
          <div className="text-2xl font-bold text-emerald-700 tabular-nums">{ex.pct}</div>
          <div className="text-[12px] text-gray-500">{ex.formula}</div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
          <div className="text-[11px] uppercase tracking-wide text-gray-400 inline-flex items-center gap-1"><Trophy className="w-3 h-3" />{t("Xếp hạng đội")}</div>
          <div className="text-2xl font-bold text-gray-800 tabular-nums">{me.rank}/{me.teamSize}</div>
          <div className="text-[12px] text-gray-500">{me.orders} {t("đơn ·")} {me.custs} {t("khách")}</div>
        </div>
      </div>

      {next && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
          <div className="text-[13px] text-emerald-900">
            <b>{t("Còn")} {tr(Math.max(0, next.value - dsNet))} {t("nữa")}</b> {t("là chạm mốc")} {Math.round(next.r * 100)}% ({tr(next.value)}{t(") —\n            hoa hồng khi đó khoảng")} <b>{dong(calcSaleCommissionNet(next.value, target))}</b>
            {nextGain > 0 && <> {t(", tăng thêm")} <b>{dong(nextGain)}</b> {t("so với hiện tại.")}</>}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4 space-y-2">
        <div className="text-[12px] font-bold text-gray-700 inline-flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" />{t("Nhịp hiện tại")}</div>
        <div className="text-[13px] text-gray-600">
          {t("Giữ nhịp này cả tháng thì doanh số về khoảng")} <b>{tr(pace)}</b> ({Math.round((pace / target) * 100)}{t("% mốc),\n          hoa hồng khoảng")} <b>{dong(paceCommission)}</b>.
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {marks.map((m) => (
            <Badge key={m.r} tone={dsNet >= m.value ? "green" : "gray"} dot>
              {Math.round(m.r * 100)}% · {tr(m.value)}
            </Badge>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
        <div className="text-[12px] font-bold text-gray-700 mb-2">{t("Bảng bậc hoa hồng (mốc 100% của bạn:")} {tr(target)})</div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[420px]">
            <tbody>
              <tr className="border-b border-gray-50"><td className="py-1.5">{t("Dưới 50%")}</td><td className="py-1.5 text-right text-gray-500">{t("chưa có hoa hồng")}</td></tr>
              <tr className="border-b border-gray-50"><td className="py-1.5">{t("50% đến dưới 80%")}</td><td className="py-1.5 text-right">{t("1,5% toàn bộ doanh số")}</td></tr>
              <tr className="border-b border-gray-50"><td className="py-1.5">{t("80% đến dưới 100%")}</td><td className="py-1.5 text-right">{t("2,5% toàn bộ doanh số")}</td></tr>
              <tr className="border-b border-gray-50"><td className="py-1.5">{t("100% đến 200%")}</td><td className="py-1.5 text-right">{t("3% phần mốc + 5% phần vượt")}</td></tr>
              <tr><td className="py-1.5">{t("Trên 200%")}</td><td className="py-1.5 text-right">{t("cộng thêm 6% cho phần vượt 200%")}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-gray-400">
        {t("Số tạm tính từ đơn đã về hệ thống (MISA), chưa gồm thưởng nóng, thưởng nhóm và các khoản khác;\n        bảng lương chính thức do kế toán chốt cuối tháng. Đơn chưa gán đúng tên thì nhờ quản lý gán lại ở trang Gán đơn.")}
      </p>
    </div>
  );
}
