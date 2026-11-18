import { getServiceClient } from "@/lib/supabase-server";

export type MissingWaybill = {
  waybill: string;
  date: string;
  name: string;
  phone: string;
  cod: number;
  statusGroup: string;
  statusName: string;
};

export type ReconcileResult = {
  month: string;
  misaOrders: number;
  misaRevenue: number;
  jtWaybills: number;
  matched: number;

  deliveredMissing: MissingWaybill[];
  deliveredMissingCod: number;

  overdueMissing: MissingWaybill[];
  overdueCod: number;

  prepaidMissing: number;

  prepaidEstimate: number;

  estimatedRealRevenue: number;

  inTransit: number;
  inTransitCod: number;
};

const nPhone = (p: unknown) => {
  let s = String(p || "").replace(/\D/g, "");
  if (s.startsWith("84")) s = "0" + s.slice(2);
  if (s && !s.startsWith("0")) s = "0" + s;
  return s;
};
const dnum = (d: string) => Math.floor(new Date(d + "T00:00:00Z").getTime() / 86400000);
const pad = (n: number) => String(n).padStart(2, "0");
const shift = (base: string, days: number) => {
  const t = new Date(base + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + days);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
};

async function pageAll<T>(run: (from: number, to: number) => any): Promise<T[]> {
  let out: T[] = [], from = 0;
  for (let i = 0; i < 25; i++) {
    const { data, error } = await run(from, from + 999);
    if (error) throw new Error(error.message);
    const rows = (data || []) as T[];
    out = out.concat(rows);
    if (rows.length < 1000) break;
    from += 1000;
  }
  return out;
}

/**
 * @param graceDays Đơn vừa giao trong ngần này ngày thì CHƯA coi là bất thường — kế toán cần thời gian
 *   chốt đơn hoàn thành trong MISA. Không có ân hạn thì mỗi sáng đều kêu, thành nhiễu rồi bị bỏ qua.
 */
export async function reconcileJtMisa(month: string, graceDays = 3): Promise<ReconcileResult> {
  const sb = getServiceClient();
  const [Y, M] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(Y, M, 0)).getUTCDate();
  const d1 = `${month}-01`, d2 = `${month}-${pad(lastDay)}`;
  const wide1 = shift(d1, -20), wide2 = shift(d2, 20);

  const li = await pageAll<any>((f, t) =>
    sb.from("mshopkeeper_line_items")
      .select("order_code,order_date,customer_phone,net_amount")
      .gte("order_date", wide1).lte("order_date", wide2).range(f, t));

  const orders: Record<string, { code: string; date: string; phone: string; net: number; used: boolean }> = {};
  for (const x of li) {
    const o = orders[x.order_code] || (orders[x.order_code] = { code: x.order_code, date: x.order_date, phone: nPhone(x.customer_phone), net: 0, used: false });
    o.net += Number(x.net_amount || 0);
  }
  const orderList = Object.values(orders);
  const inMonth = orderList.filter(o => String(o.date).startsWith(month));
  const misaRevenue = inMonth.reduce((s, o) => s + o.net, 0);
  const aov = inMonth.length ? misaRevenue / inMonth.length : 0;

  const byPhone: Record<string, typeof orderList> = {};
  for (const o of orderList) if (o.phone) (byPhone[o.phone] = byPhone[o.phone] || []).push(o);

  const wbAll = await pageAll<any>((f, t) =>
    sb.from("jt_waybills")
      .select("waybill_no,receiver_phone,receiver_name,cod_value,status_group,status_name,order_create_time,is_void")
      .gte("order_create_time", d1).lte("order_create_time", d2 + "T23:59:59").range(f, t));
  const wb = wbAll.filter(x => !x.is_void);

  const missing: any[] = [];
  let matched = 0;
  for (const w of wb.sort((a, b) => String(a.order_create_time).localeCompare(String(b.order_create_time)))) {
    const ph = nPhone(w.receiver_phone);
    const wd = dnum(String(w.order_create_time).slice(0, 10));
    const cands = (byPhone[ph] || []).filter(o => !o.used && dnum(o.date) >= wd - 3 && dnum(o.date) <= wd + 12);
    if (cands.length) {
      cands.sort((a, b) => Math.abs(dnum(a.date) - wd) - Math.abs(dnum(b.date) - wd));
      cands[0].used = true;
      matched++;
    } else missing.push(w);
  }

  const toRow = (w: any): MissingWaybill => ({
    waybill: w.waybill_no,
    date: String(w.order_create_time).slice(0, 10),
    name: String(w.receiver_name || "").trim(),
    phone: nPhone(w.receiver_phone),
    cod: Number(w.cod_value || 0),
    statusGroup: w.status_group || "",
    statusName: w.status_name || "",
  });

  const delivered = missing.filter(w => w.status_group === "delivered").map(toRow);
  const transit = missing.filter(w => w.status_group === "transit").map(toRow);
  const deliveredMissingCod = delivered.reduce((s, w) => s + w.cod, 0);
  const prepaidMissing = delivered.filter(w => !w.cod).length;
  const prepaidEstimate = Math.round(prepaidMissing * aov);

  const today = Math.floor(Date.now() / 86400000);
  const overdue = delivered.filter(w => today - dnum(w.date) > graceDays);

  return {
    month,
    misaOrders: inMonth.length,
    misaRevenue: Math.round(misaRevenue),
    jtWaybills: wb.length,
    matched,
    deliveredMissing: delivered.sort((a, b) => b.cod - a.cod),
    deliveredMissingCod,
    overdueMissing: overdue.sort((a, b) => b.cod - a.cod),
    overdueCod: overdue.reduce((s, w) => s + w.cod, 0),
    prepaidMissing,
    prepaidEstimate,
    estimatedRealRevenue: Math.round(misaRevenue + deliveredMissingCod + prepaidEstimate),
    inTransit: transit.length,
    inTransitCod: transit.reduce((s, w) => s + w.cod, 0),
  };
}

const vnd = (n: number) => Math.round(n).toLocaleString("vi-VN") + "đ";

export function buildReconcileMessage(r: ReconcileResult): string {
  const gap = r.deliveredMissingCod + r.prepaidEstimate;
  const pct = r.misaRevenue ? (gap / r.misaRevenue) * 100 : 0;
  const L: string[] = [];
  L.push(`<b>HÀNG ĐÃ GIAO NHƯNG CHƯA VÀO SỔ</b> · tháng ${r.month}`);
  L.push("");
  L.push(`Sổ MISA đang ghi: <b>${r.misaOrders}</b> đơn · <b>${vnd(r.misaRevenue)}</b>`);
  L.push(`J&T báo đã giao mà sổ chưa có: <b>${r.deliveredMissing.length}</b> đơn · <b>${vnd(r.deliveredMissingCod)}</b>`);
  L.push(`  trong đó ĐỂ QUÁ LÂU (cần xử ngay): <b>${r.overdueMissing.length}</b> đơn · <b>${vnd(r.overdueCod)}</b>`);
  if (r.prepaidMissing) L.push(`  ${r.prepaidMissing} đơn khách đã chuyển khoản trước (COD ghi 0đ) — ước thêm ${vnd(r.prepaidEstimate)}`);
  L.push("");
  L.push(`Doanh thu thật ước tính: <b>${vnd(r.estimatedRealRevenue)}</b> (chênh ${vnd(gap)} = ${pct.toFixed(1)}% so với sổ)`);
  if (r.inTransit) L.push(`Đang trên đường (CHƯA tính vào doanh thu): ${r.inTransit} đơn · ${vnd(r.inTransitCod)}`);
  const show = r.overdueMissing.length ? r.overdueMissing : r.deliveredMissing;
  if (show.length) {
    L.push("");
    L.push("Đơn lớn nhất cần chốt:");
    for (const w of show.slice(0, 5))
      L.push(`  ${w.date} · ${w.name || "(không tên)"} · ${w.phone} · ${vnd(w.cod)}`);
  }
  L.push("");
  L.push("Việc cần làm: kế toán vào MISA chốt hoàn thành các đơn trên để doanh thu về đúng.");
  return L.join("\n");
}
