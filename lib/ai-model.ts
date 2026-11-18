import { getConfigValue } from "./app-config";

export type VaiModel = "chienLuoc" | "thuong" | "hangLoat";

export const MODEL_MAC_DINH: Readonly<Record<VaiModel, string>> = Object.freeze({
  chienLuoc: "claude-opus-5-5",
  thuong: "claude-sonnet-5-5",
  hangLoat: "claude-haiku-5-5",
});

export const CONFIG_KEY_MODEL_VAI = "ai_model_vai";
const CACHE_MS = 60_000;

let cache: { het: number; giaTri: Partial<Record<VaiModel, string>> } | null = null;

export function modelMacDinh(vai: VaiModel): string {
  return MODEL_MAC_DINH[vai];
}

async function docGhiDe(): Promise<Partial<Record<VaiModel, string>>> {
  if (cache && cache.het > Date.now()) return cache.giaTri;
  let giaTri: Partial<Record<VaiModel, string>> = {};
  try {
    const raw = await getConfigValue(CONFIG_KEY_MODEL_VAI);
    const j = raw ? JSON.parse(raw) : {};
    if (j && typeof j === "object") {
      for (const vai of Object.keys(MODEL_MAC_DINH) as VaiModel[]) {
        const v = typeof j[vai] === "string" ? j[vai].trim() : "";
        if (/^claude-[a-z0-9.-]+$/i.test(v)) giaTri[vai] = v;
      }
    }
  } catch {
    giaTri = {};
  }
  cache = { het: Date.now() + CACHE_MS, giaTri };
  return giaTri;
}

export async function layModel(vai: VaiModel): Promise<string> {
  const ghiDe = await docGhiDe();
  return ghiDe[vai] || MODEL_MAC_DINH[vai];
}

export async function giaiModel(model: string): Promise<string> {
  const vai = (Object.keys(MODEL_MAC_DINH) as VaiModel[]).find((v) => MODEL_MAC_DINH[v] === model);
  return vai ? layModel(vai) : model;
}
