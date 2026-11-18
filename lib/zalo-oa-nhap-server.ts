import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { docTokenOa } from "@/lib/zalo-oa-token";
import { chonCheDoOa, KHOA_CHE_DO_OA, KHOA_NHAP_OA, type CheDoOa, type NhapOa } from "@/lib/zalo-oa-che-do";

export async function docCheDoOa(): Promise<CheDoOa> {
  let cfg: string | null = null;
  try { cfg = await getConfigValue(KHOA_CHE_DO_OA); } catch { cfg = null; }
  return chonCheDoOa(cfg, process.env.ZALO_OA_AGENT_MODE);
}

export async function docKhoNhapOa(): Promise<Record<string, NhapOa>> {
  try {
    const r = await getConfigValue(KHOA_NHAP_OA);
    const j = r ? JSON.parse(r) : {};
    return j && typeof j === "object" && !Array.isArray(j) ? j : {};
  } catch { return {}; }
}

export async function ghiKhoNhapOa(kho: Record<string, NhapOa>): Promise<void> {
  await setConfigValue(KHOA_NHAP_OA, JSON.stringify(kho), "Tin Zalo OA chờ người duyệt (AI soạn nháp, không tự gửi)");
}

export async function layTokenOa(): Promise<string | undefined> {
  const env = (process.env.ZALO_OA_ACCESS_TOKEN || "").trim();
  if (env) return env;
  try { return (await docTokenOa()).access_token || undefined; } catch { return undefined; }
}
