import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { buildSalesAnalytics } from "@/lib/sales-analytics";
import { fmtVND } from "@/lib/payroll";
import { PageHeader, Badge } from "@/components/ui/kit";
import { PieChart, MapPin, Package, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Phân tích bán hàng | ACME Ops Hub") };
}

const RANGES = [30, 90, 180];

export default async function Page({ searchParams }: { searchParams: { d?: string } }) {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove(user.role)) redirect("/");

  const days = RANGES.includes(Number(searchParams.d)) ? Number(searchParams.d) : 90;
  const a = await buildSalesAnalytics(days);
  const bar = (pct: number, tone = "bg-brand-500") => (
    <div className="h-1.5 rounded bg-gray-100 overflow-hidden">
      <div className={`h-full ${tone}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <PageHeader
        title={t("Phân tích bán hàng")}
        subtitle={`Đơn thật đã bán và đã gửi đi, từ ${a.from} đến ${a.to}`}
        icon={PieChart}
        actions={
          <div className="flex gap-1.5">
            {RANGES.map((d) => (
              <a key={d} href={`?d=${d}`}
                className={`px-2.5 py-1 rounded-lg text-[12px] font-semibold border ${d === days ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-600"}`}>
                {d} {t("ngày")}
              </a>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { k: t("Doanh thu (chưa VAT)"), v: fmtVND(a.totalRevenue) },
          { k: t("Số đơn"), v: a.totalOrders.toLocaleString("vi-VN") },
          { k: t("Giá trị đơn trung bình"), v: fmtVND(a.aov) },
          { k: t("Vận đơn đã gửi"), v: a.waybills.toLocaleString("vi-VN") },
        ].map((x) => (
          <div key={x.k} className="rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm">
            <div className="text-[11.5px] text-gray-500">{x.k}</div>
            <div className="text-[17px] font-bold text-gray-900 tabular-nums mt-0.5">{x.v}</div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
          <Package className="w-4 h-4 text-gray-400" />
          <h2 className="text-[14px] font-bold text-gray-800">{t("Sản phẩm nào đang gánh doanh thu")}</h2>
          <span className="text-[11.5px] text-gray-400">{a.products.length} {t("mã hàng")}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-gray-50/70 text-gray-500 text-[11px] uppercase">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">{t("Sản phẩm")}</th>
                <th className="text-right px-3 py-2 font-semibold">Doanh thu</th>
                <th className="text-left px-3 py-2 font-semibold w-40">{t("Tỷ trọng")}</th>
                <th className="text-right px-3 py-2 font-semibold">{t("Số lượng")}</th>
                <th className="text-right px-3 py-2 font-semibold">{t("Số đơn")}</th>
                <th className="text-right px-4 py-2 font-semibold">{t("Biên gộp")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {a.products.slice(0, 20).map((p, i) => (
                <tr key={p.sku + p.name} className={i === 0 ? "bg-amber-50/40" : ""}>
                  <td className="px-4 py-2">
                    <div className="font-semibold text-gray-800">{p.name}</div>
                    {p.sku && <div className="text-[10.5px] text-gray-400">{p.sku}</div>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtVND(p.revenue)}</td>
                  <td className="px-3 py-2">
                    <div className="text-[11px] text-gray-500 mb-0.5 tabular-nums">{p.share.toFixed(1)}%</div>
                    {bar(p.share)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-600">{p.qty.toLocaleString("vi-VN")}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-600">{p.orders}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                    {p.marginPct === null ? "—" : `${p.marginPct.toFixed(0)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <h2 className="text-[14px] font-bold text-gray-800 mb-2.5 inline-flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-gray-400" />{t("Doanh thu theo kênh bán")}
        </h2>
        <div className="space-y-2">
          {a.channels.map((c) => (
            <div key={c.name} className="flex items-center gap-3">
              <div className="w-36 text-[12.5px] text-gray-700 shrink-0">{c.name}</div>
              <div className="flex-1">{bar(c.share, "bg-emerald-500")}</div>
              <div className="w-40 text-right text-[12px] tabular-nums text-gray-600">
                {fmtVND(c.revenue)} · {c.share.toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2 flex-wrap">
          <MapPin className="w-4 h-4 text-gray-400" />
          <h2 className="text-[14px] font-bold text-gray-800">{t("Ở đâu mua nhiều, và mua gì")}</h2>
          <div className="flex gap-1.5 ml-auto text-[11px]">
            {a.mienSummary.map((m) => (
              <Badge key={m.mien} tone="gray">{t("Miền")} {m.mien} {m.share.toFixed(0)}%</Badge>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-gray-50/70 text-gray-500 text-[11px] uppercase">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">{t("Tỉnh / Thành")}</th>
                <th className="text-right px-3 py-2 font-semibold">{t("Số đơn")}</th>
                <th className="text-right px-3 py-2 font-semibold">{t("Tiền hàng gửi đi")}</th>
                <th className="text-left px-3 py-2 font-semibold w-32">{t("Tỷ trọng")}</th>
                <th className="text-left px-4 py-2 font-semibold">{t("Mua nhiều nhất ở tỉnh đó")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {a.provinces.slice(0, 25).map((p, i) => (
                <tr key={p.province} className={i === 0 ? "bg-amber-50/40" : ""}>
                  <td className="px-4 py-2 font-semibold text-gray-800">
                    {p.province}
                    <span className="text-[10.5px] text-gray-400 ml-1.5">{t("miền")} {p.mien}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.orders}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtVND(p.cod)}</td>
                  <td className="px-3 py-2">
                    <div className="text-[11px] text-gray-500 mb-0.5 tabular-nums">{p.share.toFixed(1)}%</div>
                    {bar(p.share, "bg-sky-500")}
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    {p.topProduct
                      ? <>{p.topProduct} <span className="text-gray-400">({p.topProductShare.toFixed(0)}%)</span></>
                      : <span className="text-gray-300">{t("chưa ghép được đơn")}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[11px] text-gray-400 leading-relaxed">
        {t("Cột sản phẩm và kênh lấy từ đơn đã ghi nhận doanh thu. Cột tỉnh thành lấy từ địa chỉ trên vận đơn đã gửi:\n        đọc được tỉnh của")} <b>{a.provinceRate.toFixed(0)}%</b> {t("vận đơn (địa chỉ khách gõ tay, phần còn lại không ghi tên tỉnh).\n        Cột &quot;mua nhiều nhất ở tỉnh đó&quot; nối vận đơn với đơn hàng bằng số điện thoại, ghép được")}{" "}
        <b>{a.matchRate.toFixed(0)}%</b> {t("— số còn lại là khách đặt qua kênh chưa lưu số trùng khớp, nên cột này đọc theo\n        xu hướng chứ đừng lấy làm con số tuyệt đối. Biên gộp chỉ hiện phần trăm, không hiện giá vốn.")}
      </p>
    </div>
  );
}
