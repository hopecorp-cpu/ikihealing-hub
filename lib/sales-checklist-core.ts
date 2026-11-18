import def from "@/data/daily-sales-checklist.json";

export type ChItem = { key: string; label: string; kind: "check" | "number" | "auto"; target: number; tier?: number; period?: "day" | "week"; auto?: string; roles?: string[]; money?: boolean; proof?: boolean; help?: string };
export type ChSection = { key: string; title: string; items: ChItem[] };
export type ChecklistDef = { deadline: string; tierWeight: Record<string, number>; tierLabel: Record<string, number | string>; links: { group: string; zalo: string }; inviteMessage: string; sections: ChSection[] };
export const CHECKLIST = def as ChecklistDef;

export type AutoVals = { calls: number; care: number; orders: number; revenue: number; revenueGross?: number; report: number; gift: number; orderList?: { code: string; customer: string; phone: string; net: number; gross?: number; items: { name: string; qty: number }[] }[] };
export type Role = "page" | "sales";

export const tierWeight = (tier?: number) => CHECKLIST.tierWeight[String(tier || 3)] ?? 1;

export function roleOf(position?: string | null): Role {
  return /tr[uự]c\s*page/i.test(position || "") ? "page" : "sales";
}
const inRole = (it: ChItem, role: Role) => !it.roles || it.roles.includes(role);

export function sectionsForRole(role: Role): ChSection[] {
  return CHECKLIST.sections.map(s => ({ ...s, items: s.items.filter(it => inRole(it, role)) })).filter(s => s.items.length > 0);
}
export function itemsForRole(role: Role): ChItem[] {
  return CHECKLIST.sections.flatMap(s => s.items).filter(it => inRole(it, role));
}

export function valueOf(it: ChItem, values: Record<string, number>, auto: AutoVals, weekBase: Record<string, number>): number {
  if (it.kind === "auto" && it.auto) return (auto as any)[it.auto] || 0;
  if (it.period === "week") return (weekBase[it.key] || 0) + (values[it.key] || 0);
  return values[it.key] || 0;
}

export const targetOf = (it: ChItem, overrides?: Record<string, number>) =>
  overrides && overrides[it.key] != null ? overrides[it.key] : (it.target || 1);
export const isMet = (it: ChItem, values: Record<string, number>, auto: AutoVals, weekBase: Record<string, number>, overrides?: Record<string, number>, links?: Record<string, string>) => {
  if (valueOf(it, values, auto, weekBase) < targetOf(it, overrides)) return false;
  if (it.proof && !(links && (links[it.key] || "").trim())) return false;
  return true;
};

export function evalProgress(values: Record<string, number>, auto: AutoVals, weekBase: Record<string, number>, role: Role, overrides?: Record<string, number>, links?: Record<string, string>) {
  const items = itemsForRole(role);
  let w = 0, wm = 0, done = 0;
  for (const it of items) { const ww = tierWeight(it.tier); w += ww; if (isMet(it, values, auto, weekBase, overrides, links)) { wm += ww; done++; } }
  return { done, total: items.length, pct: w ? Math.round(wm / w * 100) : 0 };
}

export function weekStartISO(today: string): string {
  const d = new Date(today + "T00:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}
export const dayDocKey = (date: string, userId: string) => `salecheck_${date}__${userId}`;
