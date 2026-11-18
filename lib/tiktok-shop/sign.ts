import { createHmac, timingSafeEqual } from "node:crypto";

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

export function chuoiQueryDaSap(query: QueryParams): string {
  return Object.keys(query)
    .filter((k) => k !== "sign" && k !== "access_token" && query[k] !== undefined && query[k] !== null)
    .sort()
    .map((k) => `${k}${String(query[k])}`)
    .join("");
}

/**
 * Tính chữ ký cho một request.
 * @param path     đường dẫn API, ví dụ "/order/202309/orders/search" (không domain, không query)
 * @param query    toàn bộ query sẽ gửi (app_key, timestamp, shop_cipher, ...) — KHÔNG kèm sign
 * @param body     chuỗi JSON thô sẽ gửi, hoặc "" / undefined khi không có body (GET, multipart)
 */
export function kyRequest(appSecret: string, path: string, query: QueryParams, body?: string): string {
  const base = path + chuoiQueryDaSap(query) + (body || "");
  const wrapped = appSecret + base + appSecret;
  return createHmac("sha256", appSecret).update(wrapped, "utf8").digest("hex");
}

export function chuKyWebhook(appKey: string, appSecret: string, rawBody: string): string {
  return createHmac("sha256", appSecret).update(appKey + rawBody, "utf8").digest("hex");
}

export function xacMinhWebhook(appKey: string, appSecret: string, rawBody: string, authorizationHeader: string | null | undefined): boolean {
  if (!authorizationHeader || !appKey || !appSecret) return false;
  const expected = chuKyWebhook(appKey, appSecret, rawBody);
  const got = authorizationHeader.trim().toLowerCase();
  if (got.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(got, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}

export function timestampTts(now = Date.now()): string {
  return String(Math.floor(now / 1000));
}

export function dungUrlDaKy(baseUrl: string, path: string, query: QueryParams, appSecret: string, body?: string): { url: string; sign: string } {
  const sign = kyRequest(appSecret, path, query, body);
  const qs = new URLSearchParams();
  for (const k of Object.keys(query)) {
    const v = query[k];
    if (v === undefined || v === null || k === "sign") continue;
    qs.set(k, String(v));
  }
  qs.set("sign", sign);
  return { url: `${baseUrl.replace(/\/+$/, "")}${path}?${qs.toString()}`, sign };
}
