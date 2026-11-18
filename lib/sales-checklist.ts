import { norm } from "@/lib/sale-metrics";
import { layDoanhThu, gopTenSale } from "@/lib/doanh-thu";
import { loadOrderOverrides, effectiveSaleName } from "@/lib/order-attribution";
import { CHECKLIST, weekStartISO, type AutoVals } from "@/lib/sales-checklist-core";

export * from "@/lib/sales-checklist-core";

export async function computeAuto(sb: any, fullName: string, today: string, userId?: string): Promise<AutoVals> {
  const me = norm(fullName || "");
  let calls = 0;
  try {
    const { data } = await sb.from("config").select("value").eq("key", "call_log").maybeSingle();
    const log = JSON.parse(data?.value || "{}");
    for (const [name, v] of Object.entries(log[today] || {})) if (norm(name) === me) calls += (typeof v === "object" ? (v as any).n || 0 : Number(v) || 0);
  } catch { }
  let care = 0;
  try {
    const { data } = await sb.from("customer_care_log").select("sale_name").eq("last_contact", today);
    for (const r of data || []) if (norm(r.sale_name || "") === me) care++;
  } catch { }

  const ov = await loadOrderOverrides(sb);
  let orders = 0, revenue = 0;
  const orderMap: Record<string, { code: string; customer: string; phone: string; net: number; items: { name: string; qty: number }[] }> = {};
  try {
    const { rows: data } = await layDoanhThu(sb, today, today);

    const { data: us } = await sb.from("users").select("full_name").eq("active", true);
    const gop = gopTenSale((us || []).map((u: any) => ({ ten: u.full_name || "" })));
    for (const r of data || []) if (norm(effectiveSaleName(r.order_code, gop(r.sale_name || ""), ov)) === me && !ov.excluded.has(r.order_code)) {
      const o = (orderMap[r.order_code] ??= { code: r.order_code, customer: r.customer_name || "", phone: r.customer_phone || "", net: 0, items: [] });
      o.net += r.net_amount || 0; if (r.customer_name) o.customer = r.customer_name; if (r.customer_phone) o.phone = r.customer_phone;
      if (r.product_name) o.items.push({ name: r.product_name, qty: Number(r.quantity) || 1 });
      revenue += r.net_amount || 0;
    }
    orders = Object.keys(orderMap).length;
  } catch { }

  const VAT = 1.08;
  const orderList = Object.values(orderMap).map(o => ({ ...o, net: Math.round(o.net), gross: Math.round(o.net * VAT) }));
  const revenueGross = Math.round(revenue * VAT);

  let report = 0;
  if (userId) {
    try {
      const { count } = await sb.from("daily_reports").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("report_date", today).eq("status", "submitted");
      report = (count || 0) > 0 ? 1 : 0;
    } catch { }
  }

  let gift = 0;
  try {
    const { data } = await sb.from("config").select("value").eq("key", "gift_log").maybeSingle();
    const log = JSON.parse(data?.value || "{}");
    for (const [name, v] of Object.entries(log[today] || {})) if (norm(name) === me) gift += (typeof v === "object" ? (v as any).n || 0 : Number(v) || 0);
  } catch { }
  return { calls, care, orders, revenue, revenueGross, report, gift, orderList };
}

export async function loadWeekBase(sb: any, userId: string, today: string): Promise<Record<string, number>> {
  const weeklyKeys = CHECKLIST.sections.flatMap(s => s.items).filter(it => it.period === "week").map(it => it.key);
  const base: Record<string, number> = {};
  if (!weeklyKeys.length) return base;
  const start = weekStartISO(today);
  const { data } = await sb.from("config").select("key, value").ilike("key", `salecheck_%__${userId}`);
  for (const row of data || []) {
    const m = (row.key as string).match(/^salecheck_(\d{4}-\d{2}-\d{2})__/);
    const date = m?.[1];
    if (!date || date < start || date >= today) continue;
    let doc: any = {}; try { doc = JSON.parse(row.value); } catch { continue; }
    for (const k of weeklyKeys) base[k] = (base[k] || 0) + (Number(doc.values?.[k]) || 0);
  }
  return base;
}
