import { SHOPEE_REFRESH_SONG_NGAY, type ShopeeConfig } from "./config";
import { timestampShopee, urlShopeeDaKy } from "./sign";

export type ShopeeToken = {
  shopId: number;
  accessToken: string;
  refreshToken: string;
  accessHetHan: string;
  refreshHetHan: string;
};

type Fetch = typeof fetch;

export function docPhanHoiToken(j: any, shopId: number, now = Date.now()): ShopeeToken {
  if (!j || (j.error && String(j.error) !== "")) {
    throw new Error(`Shopee từ chối: ${j?.error || "không đọc được body"} ${j?.message || ""} [request_id ${j?.request_id || "?"}]`.trim());
  }
  if (!j.access_token || !j.refresh_token) throw new Error(`Shopee trả thiếu access_token/refresh_token [request_id ${j?.request_id || "?"}]`);
  const giay = Number(j.expire_in) > 0 ? Number(j.expire_in) : 4 * 3600;
  return {
    shopId: Number(j.shop_id) || shopId,
    accessToken: String(j.access_token),
    refreshToken: String(j.refresh_token),
    accessHetHan: new Date(now + giay * 1000).toISOString(),
    refreshHetHan: new Date(now + SHOPEE_REFRESH_SONG_NGAY * 86400e3).toISOString(),
  };
}

async function goiAuth(c: ShopeeConfig, path: string, body: Record<string, unknown>, shopId: number, f: Fetch, now: number): Promise<ShopeeToken> {
  const url = urlShopeeDaKy({ host: c.host, path, partnerId: c.partnerId, partnerKey: c.partnerKey, timestamp: timestampShopee(now) });
  const res = await f(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, partner_id: c.partnerId }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const j: any = await res.json().catch(() => null);
  if (!res.ok && !j?.error) throw new Error(`Shopee ${path} HTTP ${res.status}`);
  return docPhanHoiToken(j, shopId, now);
}

export function doiCodeShopee(c: ShopeeConfig, code: string, shopId: number, f: Fetch = fetch, now = Date.now()) {
  return goiAuth(c, "/api/v2/auth/token/get", { code, shop_id: shopId }, shopId, f, now);
}

export function lamMoiTokenShopee(c: ShopeeConfig, refreshToken: string, shopId: number, f: Fetch = fetch, now = Date.now()) {
  return goiAuth(c, "/api/v2/auth/access_token/get", { refresh_token: refreshToken, shop_id: shopId }, shopId, f, now);
}

export function canLamMoi(accessHetHan: string, now = Date.now(), nguongPhut = 90): boolean {
  return new Date(accessHetHan).getTime() - now < nguongPhut * 60e3;
}
