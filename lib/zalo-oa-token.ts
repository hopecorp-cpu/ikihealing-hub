import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { encryptSecret, decryptSecret, hasMasterKey } from "@/lib/secret-crypto";

const KHOA = "zalo_oa_token";

const DAU = "enc:v1:";

export type OaToken = { access_token?: string; refresh_token?: string; expires_at?: number;[k: string]: any };

export async function docTokenOa(): Promise<OaToken> {
  const raw = (await getConfigValue(KHOA)) || "";
  if (!raw) return {};
  if (raw.startsWith(DAU)) {
    if (!hasMasterKey()) {
      console.error("[zalo-oa-token] Token đang mã hoá nhưng THIẾU SECRET_VAULT_KEY — không giải mã được.");
      return {};
    }
    try { return JSON.parse(decryptSecret(raw.slice(DAU.length))); }
    catch (e: any) { console.error("[zalo-oa-token] Giải mã hỏng:", e?.message); return {}; }
  }
  try { return JSON.parse(raw); } catch { return {}; }
}

export async function ghiTokenOa(tok: OaToken, ghiChu = "Token OA Zalo"): Promise<void> {
  const json = JSON.stringify(tok);
  if (!hasMasterKey()) {
    console.error("[zalo-oa-token] THIẾU SECRET_VAULT_KEY — token OA đang ghi dạng THÔ vào config.");
    await setConfigValue(KHOA, json, ghiChu + " (chưa mã hoá — thiếu SECRET_VAULT_KEY)");
    return;
  }
  await setConfigValue(KHOA, DAU + encryptSecret(json), ghiChu + " (đã mã hoá AES-256-GCM)");
}

export async function nangCapMaHoa(): Promise<{ daNang: boolean; lyDo: string }> {
  const raw = (await getConfigValue(KHOA)) || "";
  if (!raw) return { daNang: false, lyDo: "chưa có token" };
  if (raw.startsWith(DAU)) return { daNang: false, lyDo: "đã mã hoá từ trước" };
  if (!hasMasterKey()) return { daNang: false, lyDo: "thiếu SECRET_VAULT_KEY" };
  let tok: OaToken;
  try { tok = JSON.parse(raw); } catch { return { daNang: false, lyDo: "token cũ không phải JSON hợp lệ" }; }
  await ghiTokenOa(tok, "Token OA Zalo");
  return { daNang: true, lyDo: "đã chuyển bản thô sang mã hoá" };
}
