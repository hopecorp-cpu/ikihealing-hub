import { getServiceClient } from "@/lib/supabase-server";
import { getConfigNumber, getConfigValue } from "@/lib/app-config";
import { monthRange } from "@/lib/date-range";
import { layDoanhThu, layDoanhThuNhieuThang } from "@/lib/doanh-thu";

const LICH_SU_TU = "2026-03-01";

const truNgay = (iso: string) => new Date(new Date(iso).getTime() - 864e5).toISOString().slice(0, 10);

export async function readBankCash() {
  const read = async (key: string) => { try { return JSON.parse((await getConfigValue(key)) || "null"); } catch { return null; } };
  const [mb, tcb] = await Promise.all([read("mb_latest"), read("tcb_latest")]);
  const mbCash = mb?.balance?.closing ?? null;
  const tcbCash = tcb?.balance?.closing ?? null;
  if (mbCash == null && tcbCash == null) return { total: null, mb: null, tcb: null, at: null };
  return { total: (mbCash ?? 0) + (tcbCash ?? 0), mb: mbCash, tcb: tcbCash, at: mb?.window?.to ?? null };
}

export type AssetScore = Awaited<ReturnType<typeof computeAssets>>;

const CHURN_DAYS = 90;
const COST_LOOKBACK = "2026-03-01";

async function pagedLineItems(sb: any, cols: string, filters?: (q: any) => any) {
  let rows: any[] = [], off = 0;
  while (true) {
    let q = sb.from("mshopkeeper_line_items").select(cols).range(off, off + 999);
    if (filters) q = filters(q);
    const { data } = await q;
    if (!data || !data.length) break;
    rows = rows.concat(data); if (data.length < 1000) break; off += 1000;
  }
  return rows;
}

export async function computeAssets(month: string) {
  const sb = getServiceClient();
  const { start, nextStart } = monthRange(month);

  const py = +month.slice(0, 4), pm = +month.slice(5, 7);
  const prevMon = pm === 1 ? `${py - 1}-12` : `${py}-${String(pm - 1).padStart(2, "0")}`;
  const { start: prevStart, nextStart: prevNext } = monthRange(prevMon);
  const todayStr = new Date().toISOString().slice(0, 10);
  const churnCutoff = new Date(Date.now() - CHURN_DAYS * 864e5).toISOString().slice(0, 10);

  const costRows = await pagedLineItems(sb, "sku,cost_amount,quantity", q => q.gte("order_date", COST_LOOKBACK));
  const costBySku: Record<string, { c: number; q: number }> = {};
  for (const r of costRows) { if (!r.sku) continue; (costBySku[r.sku] ??= { c: 0, q: 0 }); costBySku[r.sku].c += r.cost_amount || 0; costBySku[r.sku].q += r.quantity || 0; }
  const avgCost = (sku: string) => { const v = costBySku[sku]; return v && v.q > 0 ? v.c / v.q : 0; };

  let stockItems: any[] = [];
  try { const { data } = await sb.from("config").select("value").eq("key", "misa_stock").maybeSingle(); stockItems = JSON.parse(data?.value || "{}")?.items || []; } catch { }
  let inventoryValue = 0, skuPriced = 0, skuNoCost = 0, unitsInStock = 0;
  const hasMisaValue = stockItems.some((it: any) => (Number(it.closeValue) || 0) > 0);
  for (const it of stockItems) {
    const qty = Math.max(0, Number(it.closing) || 0);
    if (!qty) continue;
    unitsInStock += qty;
    const misaVal = Number(it.closeValue) || 0;
    if (hasMisaValue) {
      if (misaVal > 0) { inventoryValue += misaVal; skuPriced++; } else skuNoCost++;
    } else {
      const c = avgCost(it.sku);
      if (c > 0) { inventoryValue += qty * c; skuPriced++; } else skuNoCost++;
    }
  }
  const inventorySource = hasMisaValue ? "misa" : "derived";

  const bank = await readBankCash();
  const manualCash = await getConfigNumber("cash_balance", 0);
  const cash = bank.total ?? manualCash;
  const cashSource = bank.total != null ? "bank" : (manualCash ? "manual" : "none");
  const workingCapital = cash + inventoryValue;

  const all = (await layDoanhThuNhieuThang(sb, LICH_SU_TU, todayStr)).rows;
  type P = { orders: Set<string>; first: string; last: string; rev: number };
  const byPhone: Record<string, P> = {};
  let ordersWithPhoneMon = 0, ordersTotalMon = 0, ordersWithPhonePrev = 0, ordersTotalPrev = 0;
  const monOrderCodes = new Set<string>(), prevOrderCodes = new Set<string>();
  const monOrderHasPhone = new Set<string>(), prevOrderHasPhone = new Set<string>();
  for (const r of all) {
    const d = (r.order_date || "").slice(0, 10);
    const inMon = d >= start && d < nextStart, inPrev = d >= prevStart && d < prevNext;
    if (inMon && r.order_code) { monOrderCodes.add(r.order_code); if (r.customer_phone) monOrderHasPhone.add(r.order_code); }
    if (inPrev && r.order_code) { prevOrderCodes.add(r.order_code); if (r.customer_phone) prevOrderHasPhone.add(r.order_code); }
    const ph = r.customer_phone; if (!ph) continue;
    const p = (byPhone[ph] ??= { orders: new Set(), first: d, last: d, rev: 0 });
    if (r.order_code) p.orders.add(r.order_code);
    p.rev += r.net_amount || 0;
    if (d && d < p.first) p.first = d;
    if (d && d > p.last) p.last = d;
  }
  const phones = Object.keys(byPhone);
  const totalCustomers = phones.length;
  const loyal = phones.filter(ph => byPhone[ph].orders.size >= 2);
  const repeatRate = totalCustomers ? Math.round(loyal.length / totalCustomers * 1000) / 10 : 0;
  const newThisMonth = phones.filter(ph => byPhone[ph].first >= start && byPhone[ph].first < nextStart).length;
  const newPrevMonth = phones.filter(ph => byPhone[ph].first >= prevStart && byPhone[ph].first < prevNext).length;
  const activeThisMonth = phones.filter(ph => byPhone[ph].last >= start && byPhone[ph].last < nextStart).length;
  const activePrevMonth = phones.filter(ph => byPhone[ph].last >= prevStart && byPhone[ph].last < prevNext).length;

  const churnList = phones
    .filter(ph => byPhone[ph].last < churnCutoff)
    .map(ph => ({ phone: ph, name: nameOf(all, ph), last: byPhone[ph].last, orders: byPhone[ph].orders.size, rev: byPhone[ph].rev }))
    .sort((a, b) => b.rev - a.rev);
  const churnRisk = churnList.length;
  const churnValuable = churnList.filter(c => c.orders >= 2).length;

  const dataCompleteness = monOrderCodes.size ? Math.round(monOrderHasPhone.size / monOrderCodes.size * 1000) / 10 : 0;
  const dataCompletenessPrev = prevOrderCodes.size ? Math.round(prevOrderHasPhone.size / prevOrderCodes.size * 1000) / 10 : 0;

  const chRows = (await layDoanhThu(sb, start, truNgay(nextStart))).rows;
  const channels = new Set(chRows.map((r) => (r.sale_channel || "").trim()).filter(Boolean));
  const kenhDoDuoc = chRows.some((r) => r.nguon === "misa");

  const pct = (cur: number, prev: number) => prev > 0 ? Math.round((cur - prev) / prev * 1000) / 10 : undefined;

  return {
    month, prevMon, today: todayStr, churnDays: CHURN_DAYS,
    tangible: {
      cash, cashSource, bank, inventoryValue, workingCapital,
      unitsInStock, skuPriced, skuNoCost, inventorySource,
      inventorySharePct: workingCapital > 0 ? Math.round(inventoryValue / workingCapital * 100) : 0,
    },
    customers: {
      totalCustomers, loyal: loyal.length, repeatRate,
      newThisMonth, newDelta: pct(newThisMonth, newPrevMonth),
      activeThisMonth, activeDelta: pct(activeThisMonth, activePrevMonth),
      dataCompleteness, dataCompletenessDelta: pct(dataCompleteness, dataCompletenessPrev),
      churnRisk, churnValuable,
      channels: channels.size,

      kenhDoDuoc,
    },
    churnTop: churnList.filter(c => c.orders >= 2).slice(0, 15),
    loyalTop: loyal.map(ph => ({ phone: ph, name: nameOf(all, ph), orders: byPhone[ph].orders.size, rev: byPhone[ph].rev }))
      .sort((a, b) => b.rev - a.rev).slice(0, 15),
  };
}

function nameOf(rows: any[], phone: string): string {
  const r = rows.find(x => x.customer_phone === phone && x.customer_name);
  return (r?.customer_name || "").toString().slice(0, 30) || phone;
}
