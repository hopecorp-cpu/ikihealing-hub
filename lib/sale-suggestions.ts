import { getServiceClient } from "./supabase-server";
import { vnDateStr } from "./payroll";

const CATS: { key: string; re: RegExp[] }[] = [
  { key: "Đạm Mẫu", re: [/đạm mẫu|dam mau/i, /\bprotein\b/i] },
  { key: "Trà Mẫu A", re: [/trà mẫu a|tra mau a/i] },
  { key: "NOVA Detox/Cà phê", re: [/cà.?phê|ca.?phe|cafe/i, /\bnova\b/i] },
];
function productsOf(notes?: string | null): string[] {
  if (!notes) return [];
  const found = new Set<string>();
  for (const c of CATS) for (const r of c.re) if (r.test(notes)) { found.add(c.key); break; }
  return [...found];
}

export type SaleCustomer = {
  id: string;
  name: string;
  phone: string;
  spend: number;
  orders: number;
  lastOrder: string;
  daysSince: number;
  products: string[];
  nextBest: string[];
  combo: string;
  discount: string;
  reason: string;
  assignedTo: string | null;
  assignedToName: string | null;
  lastOrderValue: number;
  careDone: boolean;
  careNote: string | null;
};

export type SaleUserLite = { id: string; name: string; assignedCount: number; isSale: boolean };

export const VIP_GIFT_TIERS = [
  { min: 5_000_000, label: "Quà lớn (mẫu)" },
  { min: 2_000_000, label: "Quà vừa (mẫu)" },
  { min: 1_000_000, label: "Quà nhỏ (mẫu)" },
];
export function giftForOrderValue(v: number): string {
  for (const t of VIP_GIFT_TIERS) if (v >= t.min) return t.label;
  return "Gợi ý nâng đơn ≥1tr để nhận quà";
}

function vipOffer(spend: number, count: number, lastVal: number): string {
  const avg = count ? spend / count : (lastVal || 0);
  return `KHÔNG giảm giá · ${giftForOrderValue(Math.max(avg, 1_000_000))}`;
}

export function isSalePosition(position?: string | null): boolean {
  return /sale|t[uư]\s*v[aấ]n|tr[uự]c\s*page/i.test(position || "");
}

export type SaleSuggestions = {
  winback: SaleCustomer[];
  vip: SaleCustomer[];
  potential: SaleCustomer[];
  loyal: SaleCustomer[];
  counts: { winback: number; vip: number; potential: number; loyal: number; total: number };
  topCombos: { pair: string; customers: number }[];
  saleUsers: SaleUserLite[];
};

const LIST_CAP = 2000;

export const ASSIGN_CONFIG_KEY = "sale_assignments";

export const ASSIGN_SEEN_KEY = "sale_assignments_seen";

export const CARE_CONFIG_KEY = "sale_care_log";

export type CareEntry = { done: boolean; note: string; at: string };
async function getCareLog(): Promise<Record<string, CareEntry>> {
  const raw = await readJson(CARE_CONFIG_KEY);
  return raw && typeof raw === "object" ? raw : {};
}

type AssignEntry = { s: string; at: string | null };

async function readJson(key: string): Promise<any> {
  const sb = getServiceClient();
  const { data } = await sb.from("config").select("value").eq("key", key).maybeSingle();
  if (!data?.value) return {};
  try { return JSON.parse(data.value) || {}; } catch { return {}; }
}

async function getAssignmentDetail(): Promise<Record<string, AssignEntry>> {
  const raw = await readJson(ASSIGN_CONFIG_KEY);
  const out: Record<string, AssignEntry> = {};
  for (const [cid, v] of Object.entries(raw)) {
    if (typeof v === "string") out[cid] = { s: v, at: null };
    else if (v && typeof v === "object" && (v as any).s) out[cid] = { s: (v as any).s, at: (v as any).at ?? null };
  }
  return out;
}

async function getAssignmentMap(): Promise<Record<string, string>> {
  const detail = await getAssignmentDetail();
  const out: Record<string, string> = {};
  for (const [cid, e] of Object.entries(detail)) out[cid] = e.s;
  return out;
}

export async function getMyNewAssignedCount(userId: string): Promise<number> {
  try {
    const [detail, seen] = await Promise.all([getAssignmentDetail(), readJson(ASSIGN_SEEN_KEY)]);
    const lastSeen: string = seen[userId] || "";
    let n = 0;
    for (const e of Object.values(detail)) {
      if (e.s === userId && e.at && e.at > lastSeen) n++;
    }
    return n;
  } catch { return 0; }
}

export async function markAssignmentsSeen(userId: string, nowIso: string): Promise<void> {
  try {
    const sb = getServiceClient();
    const seen = await readJson(ASSIGN_SEEN_KEY);
    seen[userId] = nowIso;
    await sb.from("config").upsert({ key: ASSIGN_SEEN_KEY, value: JSON.stringify(seen), description: "Mốc đã xem KH được giao" }, { onConflict: "key" });
  } catch {}
}

export async function getSaleSuggestions(): Promise<SaleSuggestions> {
  const sb = getServiceClient();
  const today = vnDateStr();

  async function pull(table: string, cols: string) {
    let all: any[] = [], off = 0;
    while (true) { const { data } = await sb.from(table).select(cols).range(off, off + 999); if (!data || !data.length) break; all = all.concat(data); if (data.length < 1000) break; off += 1000; }
    return all;
  }
  const customers = await pull("customers", "id, full_name, phone");
  const orders = await pull("orders", "customer_id, gross_revenue, final_revenue, order_date, notes");
  const rev = (o: any) => o.gross_revenue || o.final_revenue || 0;

  const assignMap = await getAssignmentMap();
  const careLog = await getCareLog();
  const { data: usersRaw } = await sb.from("users").select("id, full_name, role, position, active").eq("active", true);
  const saleNameById = new Map((usersRaw || []).map((u: any) => [u.id, u.full_name]));

  const heldBySale: Record<string, number> = {};
  for (const sid of Object.values(assignMap)) heldBySale[sid] = (heldBySale[sid] || 0) + 1;
  const saleUsers: SaleUserLite[] = (usersRaw || [])
    .filter((u: any) => u.role !== "ceo")
    .map((u: any) => ({ id: u.id, name: u.full_name, assignedCount: heldBySale[u.id] || 0, isSale: isSalePosition(u.position) }))
    .sort((a: SaleUserLite, b: SaleUserLite) => a.name.localeCompare(b.name));

  type Agg = { spend: number; count: number; last: string; lastVal: number; products: Set<string> };
  const agg = new Map<string, Agg>();
  for (const o of orders) {
    if (!o.customer_id) continue;
    if (!agg.has(o.customer_id)) agg.set(o.customer_id, { spend: 0, count: 0, last: o.order_date, lastVal: rev(o), products: new Set() });
    const a = agg.get(o.customer_id)!;
    a.spend += rev(o); a.count++;
    if (o.order_date >= a.last) { a.last = o.order_date; a.lastVal = rev(o); }
    productsOf(o.notes).forEach(p => a.products.add(p));
  }

  const pair = new Map<string, number>();
  for (const [, a] of agg) {
    const ps = [...a.products];
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const k = [ps[i], ps[j]].sort().join("|");
      pair.set(k, (pair.get(k) || 0) + 1);
    }
  }
  const affinity = (owned: string[], cand: string): number => {
    let s = 0;
    for (const p of owned) { if (p === cand) continue; s += pair.get([p, cand].sort().join("|")) || 0; }
    return s;
  };
  const ALL_PRODUCTS = CATS.map(c => c.key);
  function nextBest(owned: string[]): string[] {
    const ownedSet = new Set(owned);
    const cands = ALL_PRODUCTS.filter(p => !ownedSet.has(p))
      .map(p => ({ p, score: owned.length ? affinity(owned, p) : 0 }))
      .sort((a, b) => b.score - a.score);

    const top = cands.filter(c => c.score > 0).slice(0, 2).map(c => c.p);
    if (top.length) return top;
    return owned.includes("Đạm Mẫu") ? ["NOVA Detox/Cà phê", "Trà Mẫu A"] : ["Đạm Mẫu", "NOVA Detox/Cà phê"];
  }

  const days = (from: string, to: string) => Math.round((new Date(to + "T00:00:00Z").getTime() - new Date(from + "T00:00:00Z").getTime()) / 86400000);
  const nameById = new Map(customers.map(c => [c.id, c]));

  function build(cid: string, a: Agg, reason: string, discount: string): SaleCustomer {
    const c = nameById.get(cid) || {};
    const products = [...a.products];
    const nb = nextBest(products);
    const combo = products.includes("Đạm Mẫu")
      ? `Đạm Mẫu + ${nb[0] || "Trà Mẫu A"}`
      : `${products[0] || "Đạm Mẫu"} + ${nb[0] || "NOVA Detox/Cà phê"}`;
    const assignedTo = assignMap[cid] || null;
    const care = careLog[cid];
    return {
      id: cid, name: c.full_name || "(KH)", phone: c.phone || "",
      spend: Math.round(a.spend), orders: a.count, lastOrder: a.last, daysSince: days(a.last, today),
      products, nextBest: nb, combo, discount, reason,
      assignedTo, assignedToName: assignedTo ? (saleNameById.get(assignedTo) || null) : null,
      lastOrderValue: Math.round(a.lastVal || 0),
      careDone: !!care?.done, careNote: care?.note || null,
    };
  }

  const winback: SaleCustomer[] = [], vip: SaleCustomer[] = [], potential: SaleCustomer[] = [], loyal: SaleCustomer[] = [];
  for (const [cid, a] of agg) {
    const d = days(a.last, today);
    const isVip = a.spend >= 5_000_000 || a.count >= 5;
    if (isVip) {
      vip.push(build(cid, a, `Khách VIP (${a.count} đơn) — upsell combo + tặng quà`, vipOffer(a.spend, a.count, a.lastVal)));
    }
    if (a.count >= 1 && d >= 60 && d <= 300) {
      winback.push(build(cid, a, `Đã ${d} ngày không mua — cần chăm lại`, "Ưu đãi quay lại (mẫu)"));
    }
    if (a.count === 1 && d <= 45) {
      potential.push(build(cid, a, `Mới mua đơn đầu (${d} ngày) — đẩy đơn 2`, "Ưu đãi đơn 2 (mẫu)"));
    }
    if (a.count >= 2 && a.count < 5 && d <= 90) {
      loyal.push(build(cid, a, `Loyal ${a.count} đơn — đẩy lên VIP`, "Combo bundle (mẫu)"));
    }
  }
  const bySpend = (x: SaleCustomer, y: SaleCustomer) => y.spend - x.spend;
  winback.sort(bySpend); vip.sort(bySpend); potential.sort((a, b) => a.daysSince - b.daysSince); loyal.sort(bySpend);

  const topCombos = [...pair.entries()].map(([k, n]) => ({ pair: k.replace("|", "  +  "), customers: n })).sort((a, b) => b.customers - a.customers).slice(0, 10);

  return {
    winback: winback.slice(0, LIST_CAP),
    vip: vip.slice(0, LIST_CAP),
    potential: potential.slice(0, LIST_CAP),
    loyal: loyal.slice(0, LIST_CAP),
    counts: { winback: winback.length, vip: vip.length, potential: potential.length, loyal: loyal.length, total: agg.size },
    topCombos,
    saleUsers,
  };
}

export async function getMyAssignedCustomers(userId: string): Promise<SaleCustomer[]> {
  const sb = getServiceClient();
  const today = vnDateStr();
  const assignMap = await getAssignmentMap();
  const myIds = new Set(Object.entries(assignMap).filter(([, sid]) => sid === userId).map(([cid]) => cid));
  if (myIds.size === 0) return [];

  async function pull(table: string, cols: string) {
    let all: any[] = [], off = 0;
    while (true) { const { data } = await sb.from(table).select(cols).range(off, off + 999); if (!data || !data.length) break; all = all.concat(data); if (data.length < 1000) break; off += 1000; }
    return all;
  }
  const customers = await pull("customers", "id, full_name, phone");
  const orders = await pull("orders", "customer_id, gross_revenue, final_revenue, order_date, notes");
  const careLog = await getCareLog();
  const rev = (o: any) => o.gross_revenue || o.final_revenue || 0;
  const nameById = new Map(customers.map((c: any) => [c.id, c]));

  type Agg = { spend: number; count: number; last: string; lastVal: number; products: Set<string> };
  const agg = new Map<string, Agg>();
  for (const o of orders) {
    if (!o.customer_id || !myIds.has(o.customer_id)) continue;
    if (!agg.has(o.customer_id)) agg.set(o.customer_id, { spend: 0, count: 0, last: o.order_date, lastVal: rev(o), products: new Set() });
    const a = agg.get(o.customer_id)!;
    a.spend += rev(o); a.count++;
    if (o.order_date >= a.last) { a.last = o.order_date; a.lastVal = rev(o); }
    productsOf(o.notes).forEach((p: string) => a.products.add(p));
  }
  const days = (from: string, to: string) => Math.round((new Date(to + "T00:00:00Z").getTime() - new Date(from + "T00:00:00Z").getTime()) / 86400000);

  const out: SaleCustomer[] = [];
  for (const cid of myIds) {
    const c = nameById.get(cid);
    if (!c) continue;
    const a = agg.get(cid) || { spend: 0, count: 0, last: today, lastVal: 0, products: new Set<string>() };
    const products = [...a.products];
    const nb = products.includes("Đạm Mẫu") ? ["NOVA Detox/Cà phê", "Trà Mẫu A"] : ["Đạm Mẫu", "NOVA Detox/Cà phê"];
    const care = careLog[cid];
    out.push({
      id: cid, name: c.full_name || "(KH)", phone: c.phone || "",
      spend: Math.round(a.spend), orders: a.count, lastOrder: a.last, daysSince: a.count ? days(a.last, today) : 0,
      products, nextBest: nb,
      combo: products.includes("Đạm Mẫu") ? `Đạm Mẫu + ${nb[0]}` : `${products[0] || "Đạm Mẫu"} + ${nb[0]}`,
      discount: (a.spend >= 5_000_000 || a.count >= 5)
        ? vipOffer(a.spend, a.count, a.lastVal)
        : a.count >= 2 ? "Combo bundle (mẫu)" : a.count === 1 ? "Ưu đãi đơn 2 (mẫu)" : "Tư vấn đơn đầu",
      reason: "Được giao chăm sóc",
      assignedTo: userId, assignedToName: null,
      lastOrderValue: Math.round(a.lastVal || 0),
      careDone: !!care?.done, careNote: care?.note || null,
    });
  }
  return out.sort((x, y) => y.spend - x.spend);
}
