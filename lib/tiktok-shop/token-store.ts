import { getServiceClient } from "@/lib/supabase-server";
import { TTS_AUTH_BASE, TTS_VERSION, ttsConfig } from "./config";
import { ttsCall } from "./client";

export type TtsTokenRow = {
  open_id: string;
  shop_id: string | null;
  shop_cipher: string | null;
  seller_name: string | null;
  region: string | null;
  access_token: string;
  access_token_expires_at: string;
  refresh_token: string;
  refresh_token_expires_at: string;
  scopes: string[] | null;
  last_refresh_error: string | null;
  updated_at: string;
};

type TokenApi = {
  access_token: string;
  access_token_expire_in: number;
  refresh_token: string;
  refresh_token_expire_in: number;
  open_id: string;
  seller_name?: string;
  seller_base_region?: string;
  granted_scopes?: string[];
};

const isoTuGiay = (s: number) => new Date(Number(s) * 1000).toISOString();

async function goiAuth(path: string, params: Record<string, string>): Promise<TokenApi> {
  const url = `${TTS_AUTH_BASE}${path}?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  const j: any = await res.json().catch(() => null);
  if (!res.ok || !j || j.code !== 0 || !j.data?.access_token) {
    throw new Error(`TikTok auth ${path} thất bại: HTTP ${res.status} code ${j?.code} ${j?.message || ""} [request_id ${j?.request_id || "?"}]`);
  }
  return j.data as TokenApi;
}

async function ghiToken(d: TokenApi, giu?: Partial<TtsTokenRow>): Promise<TtsTokenRow> {
  const sb = getServiceClient();
  const row = {
    open_id: d.open_id,
    seller_name: d.seller_name ?? giu?.seller_name ?? null,
    region: d.seller_base_region ?? giu?.region ?? null,
    access_token: d.access_token,
    access_token_expires_at: isoTuGiay(d.access_token_expire_in),
    refresh_token: d.refresh_token,
    refresh_token_expires_at: isoTuGiay(d.refresh_token_expire_in),
    scopes: d.granted_scopes ?? giu?.scopes ?? null,
    shop_id: giu?.shop_id ?? null,
    shop_cipher: giu?.shop_cipher ?? null,
    last_refresh_error: null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await sb.from("tts_tokens").upsert(row, { onConflict: "open_id" }).select("*").single();
  if (error) throw new Error(`Ghi tts_tokens thất bại: ${error.message}`);
  return data as TtsTokenRow;
}

export async function doiAuthCode(code: string): Promise<TtsTokenRow> {
  const c = ttsConfig();
  const d = await goiAuth("/api/v2/token/get", { app_key: c.appKey, app_secret: c.appSecret, auth_code: code, grant_type: "authorized_code" });
  return ghiToken(d);
}

export async function lamMoiToken(row: TtsTokenRow): Promise<TtsTokenRow> {
  const c = ttsConfig();
  try {
    const d = await goiAuth("/api/v2/token/refresh", { app_key: c.appKey, app_secret: c.appSecret, refresh_token: row.refresh_token, grant_type: "refresh_token" });
    return await ghiToken(d, row);
  } catch (e: any) {

    await getServiceClient().from("tts_tokens").update({ last_refresh_error: String(e?.message || e).slice(0, 500), updated_at: new Date().toISOString() }).eq("open_id", row.open_id);
    throw e;
  }
}

export async function docTokenRow(): Promise<TtsTokenRow | null> {
  const { data, error } = await getServiceClient().from("tts_tokens").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`Đọc tts_tokens thất bại: ${error.message}`);
  return (data as TtsTokenRow) || null;
}

export const gioConLai = (iso: string) => (new Date(iso).getTime() - Date.now()) / 3600e3;

export async function layTokenHopLe(opts?: { nguongGio?: number }): Promise<TtsTokenRow> {
  let row = await docTokenRow();
  if (!row) throw new Error("Chưa uỷ quyền TikTok Shop — mở link uỷ quyền (xem docs/tiktok-shop-api.md) để tạo dòng tts_tokens đầu tiên");
  if (gioConLai(row.access_token_expires_at) < (opts?.nguongGio ?? 24)) {
    if (gioConLai(row.refresh_token_expires_at) <= 0) throw new Error("Refresh token TikTok đã hết hạn — phải uỷ quyền lại bằng tay");
    row = await lamMoiToken(row);
  }
  return row;
}

export async function layShopCipher(row: TtsTokenRow, epLamMoi = false): Promise<{ shopId: string; cipher: string; name?: string; region?: string }> {
  if (row.shop_cipher && row.shop_id && !epLamMoi) return { shopId: row.shop_id, cipher: row.shop_cipher };
  const data = await ttsCall<{ shops?: Array<{ id: string; name?: string; region?: string; cipher: string; seller_type?: string }> }>({
    method: "GET", path: `/authorization/${TTS_VERSION.shops}/shops`, accessToken: row.access_token,
  });
  const shops = data?.shops || [];
  if (!shops.length) throw new Error("TikTok trả về 0 shop cho tài khoản này — kiểm lại quyền uỷ quyền");
  const shop = shops.find((s) => (s.region || "").toUpperCase() === "VN") || shops[0];
  await getServiceClient().from("tts_tokens").update({ shop_id: shop.id, shop_cipher: shop.cipher, updated_at: new Date().toISOString() }).eq("open_id", row.open_id);
  return { shopId: shop.id, cipher: shop.cipher, name: shop.name, region: shop.region };
}
