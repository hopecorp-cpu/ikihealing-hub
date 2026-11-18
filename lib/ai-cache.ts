import { getConfigValue } from "@/lib/app-config";

export const MOC_CACHE = "<<<MOC_CACHE>>>";

const MAX_MOC = 3;
const NHO_CONG_TAC_MS = 60_000;
let congTac: { bat: boolean; luc: number } | null = null;

async function dangBat(): Promise<boolean> {
  if (congTac && Date.now() - congTac.luc < NHO_CONG_TAC_MS) return congTac.bat;
  let bat = true;
  try { bat = ((await getConfigValue("ai_prompt_cache")) || "").trim().toLowerCase() !== "off"; } catch {  }
  congTac = { bat, luc: Date.now() };
  return bat;
}

type KhoiHeThong = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };

const RE_MOC = /\n*<<<MOC_CACHE>>>\n*/;

export function boMoc(system: string): string {
  return system.split(RE_MOC).filter((d) => d.length > 0).join("\n\n");
}

export async function heThongCoCache(system: string): Promise<string | KhoiHeThong[]> {
  if (!system.includes(MOC_CACHE)) return system;
  if (!(await dangBat())) return boMoc(system);
  const doan = system.split(RE_MOC);
  const khoi: KhoiHeThong[] = [];
  doan.forEach((d, i) => {
    if (!d) return;
    const khoi_ = { type: "text" as const, text: d } as KhoiHeThong;
    if (i < doan.length - 1) khoi_.cache_control = { type: "ephemeral" };
    khoi.push(khoi_);
  });
  if (!khoi.length) return boMoc(system);

  for (let i = 0; i < khoi.length - 1; i++) khoi[i].text += "\n\n";

  let dem = 0;
  for (const k of khoi) if (k.cache_control && ++dem > MAX_MOC) delete k.cache_control;
  return khoi;
}

export function tokenCache(usage: any): { cacheDoc: number; cacheGhi: number } {
  return {
    cacheDoc: Number(usage?.cache_read_input_tokens) || 0,
    cacheGhi: Number(usage?.cache_creation_input_tokens) || 0,
  };
}
