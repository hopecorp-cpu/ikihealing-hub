import type { TtsOrder } from "./api";

export type CheDoTiktok = "trinh_duyet" | "api";
export const CHE_DO_TIKTOK_MAC_DINH: CheDoTiktok = "trinh_duyet";

export function chuanHoaCheDoTiktok(raw: string | null | undefined): CheDoTiktok | null {
  const v = String(raw ?? "").trim().toLowerCase().replace(/-/g, "_");
  if (v === "api") return "api";
  if (v === "trinh_duyet" || v === "browser") return "trinh_duyet";
  return null;
}

export function chonCheDoTiktok(env: string | null | undefined, soDongToken: number): { cheDo: CheDoTiktok; lyDo: string } {
  const muon = chuanHoaCheDoTiktok(env) ?? CHE_DO_TIKTOK_MAC_DINH;
  if (muon !== "api") return { cheDo: "trinh_duyet", lyDo: "TIKTOK_CHE_DO không phải api (mặc định trình duyệt)" };
  if (!(soDongToken > 0)) return { cheDo: "trinh_duyet", lyDo: "TIKTOK_CHE_DO=api nhưng tts_tokens chưa có dòng — chưa uỷ quyền, giữ trình duyệt" };
  return { cheDo: "api", lyDo: "TIKTOK_CHE_DO=api và đã có token" };
}

const KHONG_TINH = new Set(["UNPAID", "CANCEL"]);

const so = (s: unknown) => { const n = Number(s); return Number.isFinite(n) ? n : 0; };

export function tongQuanTuDon(orders: TtsOrder[]) {
  const tinh = orders.filter((o) => !KHONG_TINH.has(String(o.status || "").toUpperCase()));
  const khach = new Set<string>();
  let gmv = 0, donSku = 0;
  const sp = new Map<string, { id: string; ten: string; daBan: number; doanhSo: number }>();
  for (const o of tinh) {
    gmv += so(o.payment?.total_amount);
    if (o.user_id) khach.add(String(o.user_id));
    const skuTrongDon = new Set<string>();
    for (const li of o.line_items || []) {
      skuTrongDon.add(String(li.sku_id || li.seller_sku || li.id || ""));
      const id = String(li.product_id || li.seller_sku || li.product_name || "?");
      const cu = sp.get(id) || { id, ten: li.product_name || "", daBan: 0, doanhSo: 0 };
      const sl = li.quantity && li.quantity > 0 ? li.quantity : 1;
      cu.daBan += sl;
      cu.doanhSo += so(li.sale_price) * sl;
      sp.set(id, cu);
    }
    donSku += skuTrongDon.size;
  }
  return {
    tongQuan: { gmv7ngay: gmv, khach7ngay: khach.size, donSku7ngay: donSku, truyCap7ngay: null as number | null },
    sanPham: [...sp.values()].map((s) => ({ ...s, luotXem: null, ton: null, gia: null, khuyenMai: null, moiDang: false })),
    soDon: tinh.length,
    soDonBoQua: orders.length - tinh.length,
  };
}
