import { getServiceClient } from "@/lib/supabase-server";
import { getConfigValue, getConfigNumber, setConfigValue } from "@/lib/app-config";
import { computeRevenueLoop } from "@/lib/revenue-loop";
import { countPublishedSops } from "@/lib/sop";
import { vnDateStr } from "@/lib/payroll";
import template from "@/data/strategy-map-template.json";

export type Light = "green" | "yellow" | "red" | "gray";
export type ObjectiveTpl = { key: string; title: string; metric: string | null; unit: string; target: number; dir: "up" | "down" | "info"; link?: string };
export type PerspectiveTpl = { key: string; icon: string; title: string; desc: string; color: string; objectives: ObjectiveTpl[] };
export const STRATEGY_MAP = template as unknown as { intro: string; perspectives: PerspectiveTpl[] };

const CONFIG_KEY = "strategy_map";
type Override = { target?: number; initiative?: string; owner?: string; current?: number };
export type StrategyOverrides = { obj: Record<string, Override>; updatedAt?: string; updatedBy?: string };

export async function getStrategyOverrides(): Promise<StrategyOverrides> {
  try { const d = JSON.parse((await getConfigValue(CONFIG_KEY)) || "{}"); return { obj: d.obj || {}, updatedAt: d.updatedAt, updatedBy: d.updatedBy }; }
  catch { return { obj: {} }; }
}
export async function saveStrategyOverrides(obj: Record<string, Override>, by?: string): Promise<void> {
  await setConfigValue(CONFIG_KEY, JSON.stringify({ obj, updatedAt: new Date().toISOString(), updatedBy: by || "" }), "Bản đồ chiến lược (Balanced Scorecard)");
}

function lightOf(current: number | null, target: number, dir: "up" | "down" | "info"): Light {
  if (dir === "info" || current == null) return "gray";
  if (dir === "up") return current >= target ? "green" : current >= target * 0.85 ? "yellow" : "red";

  if (target === 0) return current <= 0 ? "green" : current <= 2 ? "yellow" : "red";
  return current <= target ? "green" : current <= target * 1.15 ? "yellow" : "red";
}

async function liveMetrics(month: string): Promise<Record<string, number | null>> {
  const sb = getServiceClient();
  const loop: any = await computeRevenueLoop(month).catch(() => null);

  const m: Record<string, number | null> = {};
  if (loop) {
    m.rev_pace = loop.pacePct ?? null;
    m.gross_margin = Math.round((loop.assumptions?.grossMargin || 0) * 100) || null;
    m.mkt_pct = loop.mktPct ?? null;
    m.chat_score = loop.chatAvg ?? null;
    m.close_rate = loop.callCloseReal ?? null;

    const fixed = await getConfigNumber("monthly_fixed_cost", 0);
    const gm = loop.assumptions?.grossMargin || 0;
    if (fixed > 0 && gm > 0) {
      const bepRev = fixed / gm;
      m.bep = bepRev > 0 ? Math.round((loop.monthActual / bepRev) * 100) : null;
    } else m.bep = null;
  }

  try { m.care_backlog = JSON.parse((await getConfigValue("care_summary")) || "{}").needCare ?? null; } catch { m.care_backlog = null; }

  try {
    const p = JSON.parse((await getConfigValue("misa_stock")) || "{}");
    m.stock_out = (p.items || []).filter((it: any) => it.closing === 0).length;
  } catch { m.stock_out = null; }

  try {
    const { data } = await sb.from("tasks").select("status").not("status", "is", null);
    const rows = (data || []).filter((r: any) => ["todo", "doing", "blocked", "done"].includes(r.status));
    const done = rows.filter((r: any) => r.status === "done").length;
    m.task_done = rows.length ? Math.round((done / rows.length) * 100) : null;
  } catch { m.task_done = null; }

  try { m.sop_count = await countPublishedSops(); } catch { m.sop_count = null; }

  return m;
}

export type ScoredObjective = ObjectiveTpl & { current: number | null; light: Light; initiative: string; owner: string; live: boolean };
export type ScoredPerspective = Omit<PerspectiveTpl, "objectives"> & { objectives: ScoredObjective[]; score: number };
export type StrategyMapData = {
  month: string; perspectives: ScoredPerspective[];
  overall: { green: number; yellow: number; red: number; total: number; scorePct: number };
  updatedAt?: string;
};

export async function computeStrategyMap(month?: string): Promise<StrategyMapData> {
  const mth = month || vnDateStr().slice(0, 7);
  const [metrics, ovr] = await Promise.all([liveMetrics(mth), getStrategyOverrides()]);

  let green = 0, yellow = 0, red = 0, total = 0;
  const perspectives: ScoredPerspective[] = STRATEGY_MAP.perspectives.map((p) => {
    const objectives: ScoredObjective[] = p.objectives.map((o) => {
      const ov = ovr.obj[o.key] || {};
      const live = o.metric != null && metrics[o.metric] !== undefined;
      const current = live ? metrics[o.metric!] ?? null : (ov.current ?? null);
      const target = ov.target ?? o.target;
      const light = lightOf(current, target, o.dir);
      if (o.dir !== "info") { total++; if (light === "green") green++; else if (light === "yellow") yellow++; else if (light === "red") red++; }
      return { ...o, target, current, light, initiative: ov.initiative || "", owner: ov.owner || "", live };
    });
    const scored = objectives.filter((o) => o.dir !== "info");
    const score = scored.length ? Math.round((scored.reduce((s, o) => s + (o.light === "green" ? 1 : o.light === "yellow" ? 0.5 : 0), 0) / scored.length) * 100) : 0;
    return { ...p, objectives, score };
  });

  const scorePct = total ? Math.round(((green + yellow * 0.5) / total) * 100) : 0;
  return { month: mth, perspectives, overall: { green, yellow, red, total, scorePct }, updatedAt: ovr.updatedAt };
}
