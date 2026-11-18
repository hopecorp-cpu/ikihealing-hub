import { getServiceClient } from "@/lib/supabase-server";
import { layDoanhThuNhieuThang } from "@/lib/doanh-thu";
import { detectProvince, mienCua } from "@/lib/vn-provinces";

export type ProductRow = {
  name: string; sku: string; revenue: number; qty: number; orders: number;
  share: number;
  marginPct: number | null;
};
export type ProvinceRow = {
  province: string; mien: "Bắc" | "Trung" | "Nam";
  orders: number; cod: number; share: number;
  topProduct: string | null;
  topProductShare: number;
};
export type SalesAnalytics = {
  from: string; to: string;
  totalRevenue: number; totalOrders: number; aov: number;
  products: ProductRow[];
  channels: Array<{ name: string; revenue: number; share: number }>;
  provinces: ProvinceRow[];
  mienSummary: Array<{ mien: string; orders: number; cod: number; share: number }>;
  matchRate: number;
  provinceRate: number;
  waybills: number;
};

export function chuanSdt(p: string | null | undefined): string {
  let s = String(p || "").replace(/\D/g, "");
  if (s.startsWith("84") && s.length >= 11) s = "0" + s.slice(2);
  if (s.length === 9 && !s.startsWith("0")) s = "0" + s;
  return s;
}

async function pageAll(build: (from: number, to: number) => any): Promise<any[]> {
  const out: any[] = [];
  for (let off = 0; off < 20000; off += 1000) {
    const { data } = await build(off, off + 999);
    if (!data || !data.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

export async function buildSalesAnalytics(days = 90): Promise<SalesAnalytics> {
  const to = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const from = new Date(Date.now() + 7 * 3600e3 - days * 86400e3).toISOString().slice(0, 10);

  const sb = getServiceClient();
  const [items, bills] = await Promise.all([

    layDoanhThuNhieuThang(sb, from, to).then((k) => k.rows.map((r) => ({ ...r, sku: null as string | null, cost_amount: 0 }))),
    pageAll((a, b) => sb.from("jt_waybills")
      .select("receiver_address,receiver_phone,cod_value,is_void,order_create_time")
      .gte("order_create_time", from).range(a, b)),
  ]);

  const pMap = new Map<string, { name: string; sku: string; revenue: number; qty: number; cost: number; orders: Set<string> }>();
  const chMap = new Map<string, number>();
  const orderCodes = new Set<string>();
  let totalRevenue = 0;
  for (const r of items) {
    const key = r.sku || r.product_name || "?";
    const cur = pMap.get(key) || { name: r.product_name || key, sku: r.sku || "", revenue: 0, qty: 0, cost: 0, orders: new Set<string>() };
    const net = Number(r.net_amount) || 0;
    cur.revenue += net; cur.qty += Number(r.quantity) || 0; cur.cost += Number(r.cost_amount) || 0;
    if (r.order_code) cur.orders.add(r.order_code);
    pMap.set(key, cur);
    totalRevenue += net;
    if (r.order_code) orderCodes.add(r.order_code);
    const ch = r.sale_channel || "Chưa gắn kênh";
    chMap.set(ch, (chMap.get(ch) || 0) + net);
  }
  const products: ProductRow[] = [...pMap.values()]
    .map((p) => ({
      name: p.name, sku: p.sku, revenue: p.revenue, qty: p.qty, orders: p.orders.size,
      share: totalRevenue ? (p.revenue / totalRevenue) * 100 : 0,
      marginPct: p.cost > 0 && p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : null,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const phoneProduct = new Map<string, Map<string, number>>();
  for (const r of items) {
    const ph = chuanSdt(r.customer_phone);
    if (!ph) continue;
    const m = phoneProduct.get(ph) || new Map<string, number>();
    m.set(r.product_name || r.sku || "?", (m.get(r.product_name || r.sku || "?") || 0) + (Number(r.net_amount) || 0));
    phoneProduct.set(ph, m);
  }

  const live = bills.filter((b) => !b.is_void);
  const provMap = new Map<string, { orders: number; cod: number; prod: Map<string, number> }>();
  let matched = 0, provOk = 0;
  for (const b of live) {
    const prov = detectProvince(b.receiver_address || "");
    if (!prov) continue;
    provOk++;
    const cur = provMap.get(prov) || { orders: 0, cod: 0, prod: new Map<string, number>() };
    cur.orders++; cur.cod += Number(b.cod_value) || 0;
    const pm = phoneProduct.get(chuanSdt(b.receiver_phone));
    if (pm) {
      matched++;
      for (const [name, v] of pm) cur.prod.set(name, (cur.prod.get(name) || 0) + v);
    }
    provMap.set(prov, cur);
  }
  const totalCod = [...provMap.values()].reduce((s, v) => s + v.cod, 0);
  const provinces: ProvinceRow[] = [...provMap.entries()].map(([province, v]) => {
    const top = [...v.prod.entries()].sort((a, b) => b[1] - a[1])[0];
    const provProdTotal = [...v.prod.values()].reduce((s, x) => s + x, 0);
    return {
      province, mien: mienCua(province), orders: v.orders, cod: v.cod,
      share: totalCod ? (v.cod / totalCod) * 100 : 0,
      topProduct: top ? top[0] : null,
      topProductShare: top && provProdTotal ? (top[1] / provProdTotal) * 100 : 0,
    };
  }).sort((a, b) => b.cod - a.cod);

  const mienAgg = new Map<string, { orders: number; cod: number }>();
  for (const p of provinces) {
    const cur = mienAgg.get(p.mien) || { orders: 0, cod: 0 };
    cur.orders += p.orders; cur.cod += p.cod;
    mienAgg.set(p.mien, cur);
  }

  return {
    from, to, totalRevenue, totalOrders: orderCodes.size,
    aov: orderCodes.size ? totalRevenue / orderCodes.size : 0,
    products,
    channels: [...chMap.entries()].map(([name, revenue]) => ({ name, revenue, share: totalRevenue ? (revenue / totalRevenue) * 100 : 0 })).sort((a, b) => b.revenue - a.revenue),
    provinces,
    mienSummary: [...mienAgg.entries()].map(([mien, v]) => ({ mien, ...v, share: totalCod ? (v.cod / totalCod) * 100 : 0 })).sort((a, b) => b.cod - a.cod),
    matchRate: live.length ? (matched / live.length) * 100 : 0,
    provinceRate: live.length ? (provOk / live.length) * 100 : 0,
    waybills: live.length,
  };
}
