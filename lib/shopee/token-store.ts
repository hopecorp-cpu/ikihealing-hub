import { getServiceClient } from "@/lib/supabase-server";
import { shopeeConfig } from "./config";
import { lamMoiTokenShopee, type ShopeeToken } from "./auth";

export type ShopeeTokenRow = {
  shop_id: number;
  shop_name: string | null;
  access_token: string;
  access_token_expires_at: string;
  refresh_token: string;
  refresh_token_expires_at: string;
  last_refresh_error: string | null;
  updated_at: string;
};

export async function ghiTokenShopee(t: ShopeeToken, shopName?: string | null): Promise<ShopeeTokenRow> {
  const row: Record<string, unknown> = {
    shop_id: t.shopId,
    access_token: t.accessToken,
    access_token_expires_at: t.accessHetHan,
    refresh_token: t.refreshToken,
    refresh_token_expires_at: t.refreshHetHan,
    last_refresh_error: null,
    updated_at: new Date().toISOString(),
  };
  if (shopName) row.shop_name = shopName;
  const { data, error } = await getServiceClient().from("shopee_tokens").upsert(row, { onConflict: "shop_id" }).select("*").single();
  if (error) throw new Error(`Ghi shopee_tokens thất bại: ${error.message}`);
  return data as ShopeeTokenRow;
}

export async function docTokenShopee(): Promise<ShopeeTokenRow[]> {
  const { data, error } = await getServiceClient().from("shopee_tokens").select("*").order("updated_at", { ascending: false });
  if (error) throw new Error(`Đọc shopee_tokens thất bại: ${error.message}`);
  return (data as ShopeeTokenRow[]) || [];
}

export async function lamMoiVaLuu(row: ShopeeTokenRow): Promise<ShopeeTokenRow> {
  try {
    const t = await lamMoiTokenShopee(shopeeConfig(), row.refresh_token, Number(row.shop_id));
    return await ghiTokenShopee(t);
  } catch (e: any) {
    await getServiceClient().from("shopee_tokens")
      .update({ last_refresh_error: String(e?.message || e).slice(0, 500), updated_at: new Date().toISOString() })
      .eq("shop_id", row.shop_id);
    throw e;
  }
}
