import { getServiceClient } from "@/lib/supabase-server";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { GIOI_THIEU_V4, sanPhamV4 } from "@/lib/gia-v4";

export type CtvTier = { name: string; minMonthly: number; commissionPct: number };
export type DealerTier = { name: string; minUnits: number; discountPct: number };
export type ChannelPolicy = {
  ctv: CtvTier[];
  dealer: DealerTier[];
  principles: string[];
  desiredMarginFloor: number;
  updatedAt?: string;
  updatedBy?: string;
};

const KEY = "channel_policy";

export const DEFAULT_POLICY: ChannelPolicy = {
  ctv: [
    { name: "Giới thiệu — đơn đầu", minMonthly: 0, commissionPct: GIOI_THIEU_V4.donDauPct },
    { name: "Giới thiệu — mua lại", minMonthly: 0, commissionPct: GIOI_THIEU_V4.muaLaiPct },
  ],
  dealer: sanPhamV4("dam").daiLy.filter((b) => b.trangThai === "hieu_luc").map((b, i) => ({ name: b.ten + " (đạm)", minUnits: i + 1, discountPct: b.pct })),
  principles: [
    "MỘT giá bán lẻ niêm yết — mọi kênh (sàn, page, đại lý, CTV) bán ra bằng giá này.",
    "CTV = HOA HỒNG trên doanh số (bán đúng giá niêm yết, KHÔNG tự hạ giá lẻ).",
    "Đại lý = CHIẾT KHẤU NHẬP sỉ (mua đứt, bán đúng giá niêm yết, lãi = chênh lệch).",
    "Cam kết KHÔNG phá giá = điều kiện giữ quyền phân phối.",
    "Khuyến mãi = TẶNG QUÀ, KHÔNG chiết khấu % (luật thực phẩm bổ sung).",
  ],
  desiredMarginFloor: 30,
};

export async function getChannelPolicy(): Promise<ChannelPolicy> {
  try {
    const raw = await getConfigValue(KEY);
    if (raw) { const p = JSON.parse(raw); return { ...DEFAULT_POLICY, ...p }; }
  } catch { }
  return DEFAULT_POLICY;
}
export async function saveChannelPolicy(p: Partial<ChannelPolicy>, by?: string): Promise<void> {
  const cur = await getChannelPolicy();
  await setConfigValue(KEY, JSON.stringify({ ...cur, ...p, updatedAt: new Date().toISOString(), updatedBy: by || "" }), "Chính sách kênh");
}

export async function marginRefPct(): Promise<{ pct: number; product: string } | null> {
  try {
    const sb = getServiceClient();
    const { data } = await sb.from("products")
      .select("name,unit_price,cost_price")
      .ilike("name", "%vegan%").gt("unit_price", 0).gt("cost_price", 0)
      .order("unit_price", { ascending: false }).limit(1).maybeSingle();
    if (!data) return null;
    const p = Number(data.unit_price), c = Number(data.cost_price);
    if (!(p > 0) || !(c >= 0)) return null;
    return { pct: Math.round((p - c) / p * 100), product: "sản phẩm chủ lực" };
  } catch { return null; }
}
