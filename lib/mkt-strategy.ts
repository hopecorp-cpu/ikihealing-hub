import { getConfigValue, setConfigValue } from "@/lib/app-config";
import template from "@/data/mkt-strategy-template.json";

export type MktSection = { key: string; icon: string; title: string; prompts: string[] };
export const MKT_STRATEGY = template as unknown as { intro: string; sections: MktSection[] };
const CONFIG_KEY = "mkt_strategy";

export type MktStrategyData = { content: Record<string, string>; updatedAt?: string; updatedBy?: string };

export async function getStrategy(): Promise<MktStrategyData> {
  try { const d = JSON.parse((await getConfigValue(CONFIG_KEY)) || "{}"); return { content: d.content || {}, updatedAt: d.updatedAt, updatedBy: d.updatedBy }; }
  catch { return { content: {} }; }
}
export async function saveStrategy(content: Record<string, string>, by?: string): Promise<void> {
  await setConfigValue(CONFIG_KEY, JSON.stringify({ content, updatedAt: new Date().toISOString(), updatedBy: by || "" }), "Chiến lược Marketing tổng thể");
}
