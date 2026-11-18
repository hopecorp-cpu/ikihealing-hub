import { getServiceClient } from "@/lib/supabase-server";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { getBankBalances } from "@/lib/bank-balance";
import { CONFIG_KEY_ANNUAL_TARGET, DEFAULT_ANNUAL_TARGET_2026 } from "@/lib/bi-targets";
import { doanhThuTheoThang } from "@/lib/doanh-thu-that";
import { computePnl, vnToday } from "@/lib/covan/pnl";
import template from "@/data/investor-dataroom-template.json";

export type DrItem = { key: string; title: string; importance: "required" | "important" | "nice"; dealKiller?: boolean; desc: string; autoSource?: string; templateFile?: string };
export type DrGroup = { key: string; icon: string; title: string; titleVi: string; items: DrItem[] };
export const DATAROOM_TEMPLATE = template as unknown as { importanceWeight: Record<string, number>; groups: DrGroup[] };

export type DrFilledItem = { status?: "done" | ""; link?: string; fileUrl?: string; fileKey?: string; note?: string; filledAt?: string };
export type DrToken = { token: string; label: string; createdAt: string; active: boolean };
export type Dataroom = {
  items: Record<string, DrFilledItem>;
  company: string;
  team: { name: string; role: string; bio?: string }[];
  ask: string;
  traction: { label: string; value: string }[];
  qa: { q: string; a: string; qEn?: string; aEn?: string }[];
  tokens: DrToken[];
  updatedAt?: string;
};

const EMPTY: Dataroom = { items: {}, company: "", team: [], ask: "", traction: [], qa: [], tokens: [] };
const CONFIG_KEY = "investor_dataroom";

export async function getDataroom(): Promise<Dataroom> {
  try {
    const raw = await getConfigValue(CONFIG_KEY);
    if (!raw) return { ...EMPTY };
    const d = JSON.parse(raw);
    return { ...EMPTY, ...d, items: d.items || {}, team: d.team || [], traction: d.traction || [], qa: d.qa || [], tokens: d.tokens || [] };
  } catch { return { ...EMPTY }; }
}

export async function saveDataroom(patch: Partial<Dataroom>): Promise<Dataroom> {
  const cur = await getDataroom();
  const next: Dataroom = { ...cur, ...patch, updatedAt: new Date().toISOString() };
  await setConfigValue(CONFIG_KEY, JSON.stringify(next), "Investor Dataroom — nội dung ACME điền + token");
  return next;
}

export type InvestorSnapshot = {
  annualTarget: number;
  ytd: number;
  monthly: { label: string; rev: number; dangChay?: boolean; mucSan?: boolean }[];

  pnl: { label: string; revenue: number; grossPct: number }[];
  cash: number;
  avgNet: number;
  runwayMonths: number | null;
  netByMonth: { label: string; net: number }[];
  retention: any;
  scenarios: { name: string; value: number; pct: number }[];
  has: Record<string, boolean>;

  nguonSo?: { soDonToi: string | null; jtToi: string | null; nganHangToi: string | null; capNhat: string; caveats: string[] };
};

const M = (m: string) => "T" + parseInt(m.slice(5));

export async function getInvestorSnapshot(): Promise<InvestorSnapshot> {
  const sb = getServiceClient();
  const annualTarget = Number(await getConfigValue(CONFIG_KEY_ANNUAL_TARGET)) || DEFAULT_ANNUAL_TARGET_2026;

  const nam = vnToday().slice(0, 4);
  const thangNay = vnToday().slice(0, 7);
  const [dtThat, pnlThat] = await Promise.all([doanhThuTheoThang(), computePnl()]);

  const lop = new Map(dtThat.thang.map(r => [r.thang, r]));
  const monthly = pnlThat.pnl
    .filter(p => p.month.startsWith(nam) && p.revenue > 0)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(p => {
      const l = lop.get(p.month);
      const mucSan = !!l && (l.nguon === "jt" || l.nguonSoDon === "so-whatsapp");
      return { label: M(p.month), rev: Math.round(p.revenue), dangChay: p.month === thangNay, mucSan };
    });
  const ytd = monthly.reduce((s, r) => s + r.rev, 0);

  let retention: any = {};
  try { retention = JSON.parse((await getConfigValue("sum_retention")) || "{}"); } catch { }

  const pnlDuyet = (await getConfigValue("dataroom_pnl_duyet")) === "on";
  const coGiaVon = new Set(pnlThat.coverage.cogs || []);
  const pnl = !pnlDuyet ? [] : pnlThat.pnl
    .filter(p => p.month.startsWith(nam) && p.month < thangNay && p.revenue > 0 && coGiaVon.has(p.month) && p.gross != null)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(p => ({ label: M(p.month), revenue: Math.round(p.revenue), grossPct: +(((p.gross as number) / p.revenue) * 100).toFixed(1) }));
  const nguonSo = { ...dtThat.tuoiNguon, capNhat: new Date().toISOString(), caveats: [...dtThat.caveats, ...pnlThat.caveats] };

  const { total: cash } = await getBankBalances();
  let bt: any[] = [], o1 = 0;
  while (true) { const { data } = await sb.from("bank_transactions").select("txn_date,amount,type").range(o1, o1 + 999); if (!data || !data.length) break; bt = bt.concat(data); if (data.length < 1000) break; o1 += 1000; }
  const netByM: Record<string, number> = {};
  for (const t of bt) { const m = (t.txn_date || "").slice(0, 7); if (!m) continue; const a = Math.abs(t.amount || 0); netByM[m] = (netByM[m] || 0) + (t.type === "credit" ? a : -a); }
  const bankMonths = Object.keys(netByM).filter(m => netByM[m] !== 0).sort();
  const last3 = bankMonths.slice(-3);
  const avgNet = last3.length ? last3.reduce((s, m) => s + netByM[m], 0) / last3.length : 0;
  const runwayMonths = avgNet < 0 && cash > 0 ? +(cash / Math.abs(avgNet)).toFixed(1) : null;
  const netByMonth = bankMonths.map(m => ({ label: M(m), net: Math.round(netByM[m]) }));

  const daDong = monthly.filter(r => !r.dangChay);
  const avgMonth = daDong.length ? daDong.reduce((s, r) => s + r.rev, 0) / daDong.length : 0;

  const nenDaDong = daDong.reduce((s, r) => s + r.rev, 0);
  const curMonthIdx = new Date(Date.now() + 7 * 3600e3).getUTCMonth() + 1;
  const monthsLeft = Math.max(0, 12 - curMonthIdx + 1);
  const scenarios = [
    { name: "Bi quan (−10%)", value: nenDaDong + avgMonth * 0.9 * monthsLeft },
    { name: "Cơ sở", value: nenDaDong + avgMonth * monthsLeft },
    { name: "Tích cực (+50% Tết)", value: nenDaDong + avgMonth * 1.5 * monthsLeft },
  ].map(s => ({ ...s, value: Math.round(s.value), pct: annualTarget ? Math.round(s.value / annualTarget * 100) : 0 }));

  const has: Record<string, boolean> = {
    bi: monthly.length > 0,
    projections: scenarios.length > 0 && ytd > 0,
    pnl: pnl.length > 0,
    cashflow: netByMonth.length > 0,
    runway: cash > 0 || runwayMonths != null,
    unit: !!(retention?.aov || retention?.ltvCac || retention?.repeatRate),
    retention: !!(retention?.totalCust || retention?.repeatRate),
  };

  return { annualTarget, ytd, monthly, pnl, cash, avgNet, runwayMonths, netByMonth, retention, scenarios, has, nguonSo };
}

export type Readiness = { score: number; done: number; total: number; missingDealKillers: { title: string; group: string }[] };

export function isItemFilled(item: DrItem, dr: Dataroom, snap: InvestorSnapshot): boolean {
  if (item.autoSource) return !!snap.has[item.autoSource];
  const f = dr.items[item.key];
  return !!(f && (f.status === "done" || f.link || f.fileUrl || f.fileKey));
}

export function computeReadiness(dr: Dataroom, snap: InvestorSnapshot): Readiness {
  const w = DATAROOM_TEMPLATE.importanceWeight;
  let wScore = 0, wTotal = 0, done = 0, total = 0;
  const missingDealKillers: { title: string; group: string }[] = [];
  for (const g of DATAROOM_TEMPLATE.groups) {
    for (const it of g.items) {
      total++;
      const weight = w[it.importance] || 1;
      wTotal += weight;
      const filled = isItemFilled(it, dr, snap);
      if (filled) { done++; wScore += weight; }
      else if (it.dealKiller) missingDealKillers.push({ title: it.title, group: g.title });
    }
  }
  return { score: wTotal ? Math.round(wScore / wTotal * 100) : 0, done, total, missingDealKillers };
}
