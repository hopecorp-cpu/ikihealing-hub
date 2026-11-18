import { appLink } from "@/lib/app-url";

export const SHOPEE_HOST = {
  live: "https://partner.shopeemobile.com",
  test: "https://partner.test-stable.shopeemobile.com",
} as const;

export const SHOPEE_REFRESH_SONG_NGAY = 30;

const env = (k: string) => (process.env[k] || "").trim();

export type ShopeeConfig = { bat: boolean; partnerId: number; partnerKey: string; host: string; moiTruong: "live" | "test"; redirect: string };

export function shopeeConfig(): ShopeeConfig {
  const moiTruong = env("SHOPEE_MOI_TRUONG").toLowerCase() === "live" ? "live" : "test";
  return {
    bat: env("SHOPEE_API_BAT").toLowerCase() === "true",
    partnerId: Number(env("SHOPEE_PARTNER_ID")) || 0,
    partnerKey: env("SHOPEE_PARTNER_KEY"),
    host: SHOPEE_HOST[moiTruong],
    moiTruong,
    redirect: appLink("/api/shopee/callback"),
  };
}

export function shopeeChuaSan(c = shopeeConfig()): string | null {
  if (!c.bat) return "Shopee API đang TẮT (SHOPEE_API_BAT chưa đặt true)";
  if (!c.partnerId || !c.partnerKey) return "chưa cấu hình SHOPEE_PARTNER_ID / SHOPEE_PARTNER_KEY";
  return null;
}
