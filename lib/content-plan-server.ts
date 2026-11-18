import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { CONTENT_PLAN_KEY, DEFAULT_PLAN, FUNNELS, type ContentPlan } from "@/lib/content-plan";

export async function getContentPlan(): Promise<ContentPlan> {
  try {
    const raw = await getConfigValue(CONTENT_PLAN_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p?.pillars?.length) return { funnelRatio: { ...DEFAULT_PLAN.funnelRatio, ...(p.funnelRatio || {}) }, pillars: p.pillars, updatedAt: p.updatedAt, updatedBy: p.updatedBy };
    }
  } catch { }
  return DEFAULT_PLAN;
}

export async function saveContentPlan(p: ContentPlan, by?: string): Promise<void> {
  const clean: ContentPlan = {
    funnelRatio: {
      TOFU: Math.max(0, Math.round(Number(p.funnelRatio?.TOFU) || 0)),
      MOFU: Math.max(0, Math.round(Number(p.funnelRatio?.MOFU) || 0)),
      BOFU: Math.max(0, Math.round(Number(p.funnelRatio?.BOFU) || 0)),
    },
    pillars: (p.pillars || []).map((x) => ({ name: String(x.name || "").slice(0, 80).trim(), funnel: FUNNELS.includes(x.funnel) ? x.funnel : "TOFU" })).filter((x) => x.name),
    updatedAt: new Date().toISOString(), updatedBy: by,
  };
  await setConfigValue(CONTENT_PLAN_KEY, JSON.stringify(clean));
}
