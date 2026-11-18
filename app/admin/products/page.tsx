import { requireAdmin } from "@/lib/auth-server";
import { getServiceClient } from "@/lib/supabase-server";
import { fmtVND } from "@/lib/payroll";
import { Package, TrendingUp, AlertTriangle, DollarSign } from "lucide-react";
import { seedProductsFromExcel } from "./actions";
import { ProductsClient } from "./client";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  await requireAdmin();
  const { t } = getT();
  const sb = getServiceClient();
  const { data: products } = await sb.from("products").select("*").order("name");

  const all = products ?? [];
  const totalSKUs = all.length;
  const withCogs = all.filter((p: any) => (p.cost_price || 0) > 0).length;
  const avgMargin = all.length > 0
    ? all.filter((p: any) => p.unit_price > 0 && p.cost_price > 0)
        .reduce((s: number, p: any) => s + ((p.unit_price - p.cost_price) / p.unit_price), 0) / Math.max(1, all.filter((p: any) => p.unit_price > 0 && p.cost_price > 0).length) * 100
    : 0;
  const lossProducts = all.filter((p: any) => p.cost_price > p.unit_price && p.unit_price > 0).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Package className="w-6 h-6 text-brand-600" /> {t("Quản lý Sản phẩm + Giá vốn")}
        </h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label={t("TỔNG SKU")} value={String(totalSKUs)} color="#3B82F6" icon={Package} />
        <KPI label={t("CÓ GIÁ VỐN")} value={`${withCogs}/${totalSKUs}`} color="#10B981" icon={DollarSign} />
        <KPI label={t("MARGIN TB")} value={`${avgMargin.toFixed(1)}%`} color={avgMargin > 50 ? "#10B981" : "#F59E0B"} icon={TrendingUp} />
        <KPI label={t("SP LỖ")} value={String(lossProducts)} color={lossProducts > 0 ? "#EF4444" : "#10B981"} icon={AlertTriangle} sub={t("giá vốn > giá bán")} />
      </div>

      <ProductsClient products={all} />
    </div>
  );
}

function KPI({ label, value, color, icon: Icon, sub }: any) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
      <div className="flex justify-between items-center mb-2">
        <div className="text-xs uppercase font-semibold text-gray-500">{label}</div>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}
