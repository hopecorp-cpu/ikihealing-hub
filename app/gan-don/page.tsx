import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { vnDateStr } from "@/lib/payroll";
import { loadOrderOverrides, effectiveSaleName } from "@/lib/order-attribution";
import GanDonClient from "./GanDonClient";
import { layDoanhThu } from "@/lib/doanh-thu";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Gán đơn cho sale | ACME Ops Hub") };
}

export default async function GanDonPage({ searchParams }: { searchParams: { m?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove((user as any).role)) redirect("/?denied=gandon");

  const sb = getServiceClient();
  const month = (searchParams.m || "").match(/^\d{4}-\d{2}$/) ? searchParams.m! : vnDateStr().slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const from = `${month}-01`;
  const to = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;

  const ov = await loadOrderOverrides(sb);

  const { data: users } = await sb.from("users").select("full_name, departments!users_department_id_fkey(name)").eq("active", true);
  const saleNames = (users || []).filter((u: any) => u.departments?.name === "Kinh Doanh & Sale").map((u: any) => u.full_name).filter(Boolean);

  const cuoiThang = new Date(new Date(to).getTime() - 864e5).toISOString().slice(0, 10);
  const li = (await layDoanhThu(sb, from, cuoiThang)).rows;
  const map: Record<string, any> = {};
  for (const r of li) {
    const o = (map[r.order_code] ??= { code: r.order_code, date: r.order_date, saleRaw: r.sale_name || "", customer: r.customer_name || "", phone: r.customer_phone || "", net: 0, items: [] });
    o.net += r.net_amount || 0;
    if (r.customer_name) o.customer = r.customer_name;
    if (r.customer_phone) o.phone = r.customer_phone;
    if (r.product_name) o.items.push(`${r.product_name}×${r.quantity || 1}`);
    if (r.order_date > o.date) o.date = r.order_date;
  }
  const orders = Object.values(map).map((o: any) => ({
    code: o.code, date: o.date, saleRaw: o.saleRaw, customer: o.customer, phone: o.phone,
    gross: Math.round(o.net * 1.08),
    prod: o.items.slice(0, 3).join(", "),
    assigned: ov.reassign[o.code] || "",
    effective: effectiveSaleName(o.code, o.saleRaw, ov),
    excluded: ov.excluded.has(o.code),
  })).sort((a: any, b: any) => (b.date || "").localeCompare(a.date || ""));

  return <GanDonClient orders={orders} saleNames={saleNames} month={month} />;
}
