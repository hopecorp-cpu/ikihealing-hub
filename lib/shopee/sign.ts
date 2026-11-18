import { createHmac } from "node:crypto";

export function kyShopee(partnerKey: string, partnerId: number | string, path: string, timestamp: number, accessToken = "", shopId: number | string = ""): string {
  const goc = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
  return createHmac("sha256", partnerKey).update(goc, "utf8").digest("hex");
}

export const timestampShopee = (now = Date.now()) => Math.floor(now / 1000);

export function urlShopeeDaKy(o: {
  host: string; path: string; partnerId: number | string; partnerKey: string; timestamp: number;
  accessToken?: string; shopId?: number | string; query?: Record<string, string | number | undefined>;
}): string {
  const sign = kyShopee(o.partnerKey, o.partnerId, o.path, o.timestamp, o.accessToken || "", o.accessToken ? (o.shopId ?? "") : "");
  const qs = new URLSearchParams({ partner_id: String(o.partnerId), timestamp: String(o.timestamp), sign });
  if (o.accessToken) { qs.set("access_token", o.accessToken); qs.set("shop_id", String(o.shopId ?? "")); }
  for (const [k, v] of Object.entries(o.query || {})) if (v !== undefined && v !== "") qs.set(k, String(v));
  return `${o.host.replace(/\/+$/, "")}${o.path}?${qs.toString()}`;
}

export function linkUyQuyenShopee(o: { host: string; partnerId: number | string; partnerKey: string; redirect: string; timestamp: number }): string {
  return urlShopeeDaKy({ ...o, path: "/api/v2/shop/auth_partner", query: { redirect: o.redirect } });
}
