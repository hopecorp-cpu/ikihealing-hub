import { getConfigValue } from "@/lib/app-config";

export const DEFAULT_SALE_BY_ACCOUNT: Record<string, string> = {
  "112878121298186278": "Sơn",
  "717627577509293998": "Đào",
  "624876886226592559": "Cúc",
};

export async function getSaleByAccount(): Promise<Record<string, string>> {
  try {
    const raw = await getConfigValue("sale_by_account");
    if (raw) { const o = JSON.parse(raw); if (o && typeof o === "object") return { ...DEFAULT_SALE_BY_ACCOUNT, ...o }; }
  } catch { }
  return { ...DEFAULT_SALE_BY_ACCOUNT };
}
