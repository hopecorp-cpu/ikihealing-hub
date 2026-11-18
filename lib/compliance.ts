import { getConfigValue, setConfigValue } from "@/lib/app-config";
import template from "@/data/compliance-checklist.json";

export type CStatus = "available" | "need_update" | "need_review" | "missing" | "na" | "";
export type CItem = { key: string; title: string; titleEn?: string; importance: "required" | "important" | "nice"; lawRef?: string; desc?: string };
export type CPillar = { key: string; icon: string; title: string; items: CItem[] };
export type CFilled = { status?: CStatus; link?: string; note?: string; assignee?: string; reviewedAt?: string; reviewedBy?: string };
export type Compliance = { items: Record<string, CFilled>; updatedAt?: string };

export const CHECKLIST = template as unknown as { statuses: { key: string; label: string; color: string }[]; pillars: CPillar[] };
const CONFIG_KEY = "compliance_checklist";

export const allItems = (): CItem[] => CHECKLIST.pillars.flatMap(p => p.items);

export async function getCompliance(): Promise<Compliance> {
  try {
    const raw = await getConfigValue(CONFIG_KEY);
    if (!raw) return { items: {} };
    const d = JSON.parse(raw);
    return { items: d.items || {}, updatedAt: d.updatedAt };
  } catch { return { items: {} }; }
}

export async function saveCompliance(patch: Partial<Compliance>): Promise<Compliance> {
  const cur = await getCompliance();
  const next: Compliance = { ...cur, ...patch, items: { ...cur.items, ...(patch.items || {}) }, updatedAt: new Date().toISOString() };
  await setConfigValue(CONFIG_KEY, JSON.stringify(next), "Checklist tuân thủ pháp lý doanh nghiệp");
  return next;
}

export type CStatusSummary = { total: number; applicable: number; available: number; pct: number; byStatus: Record<string, number>; missingRequired: { title: string; pillar: string }[] };

export function computeStatus(c: Compliance): CStatusSummary {
  const byStatus: Record<string, number> = { available: 0, need_update: 0, need_review: 0, missing: 0, na: 0, "": 0 };
  const missingRequired: { title: string; pillar: string }[] = [];
  let total = 0, applicable = 0;
  for (const p of CHECKLIST.pillars) {
    for (const it of p.items) {
      total++;
      const st = (c.items[it.key]?.status || "") as CStatus;
      byStatus[st] = (byStatus[st] || 0) + 1;
      if (st !== "na") applicable++;
      if (it.importance === "required" && st !== "available" && st !== "na") missingRequired.push({ title: it.title, pillar: p.title });
    }
  }
  const available = byStatus.available || 0;
  return { total, applicable, available, pct: applicable ? Math.round(available / applicable * 100) : 0, byStatus, missingRequired };
}
