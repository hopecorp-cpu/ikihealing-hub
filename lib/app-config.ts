import { getServiceClient } from "./supabase-server";

export async function getConfigValue(key: string): Promise<string | null> {
  const sb = getServiceClient();
  const { data } = await sb.from("config").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}

export async function getConfigNumber(key: string, fallback: number): Promise<number> {
  const v = await getConfigValue(key);
  if (v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function loadMonthlyTargetOverrides(): Promise<Record<string, number>> {
  try {
    const j = JSON.parse((await getConfigValue("monthly_target_overrides")) || "{}");
    const out: Record<string, number> = {};
    for (const [m, v] of Object.entries(j)) { const n = Number(v); if (/^\d{4}-\d{2}$/.test(m) && Number.isFinite(n) && n > 0) out[m] = n; }
    return out;
  } catch { return {}; }
}

export async function setConfigValue(key: string, value: string, description?: string): Promise<void> {
  const sb = getServiceClient();
  const row: any = { key, value };
  if (description) row.description = description;
  const { error } = await sb.from("config").upsert(row, { onConflict: "key" });
  if (error) throw new Error(`Ghi config "${key}" thất bại: ${error.message}`);
}
