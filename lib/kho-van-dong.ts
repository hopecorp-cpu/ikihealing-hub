export type SpVanDong = {
  name: string;
  shipped: number;
  delivered: number;
  returned: number;
  transit: number;
  orders: number;
};

export type KhoVanDong = {
  products: SpVanDong[];
  tong: { shipped: number; delivered: number; returned: number; transit: number };
  soVanDon: number;
  soVanDonHoan: number;
  soVanDonLoi: number;
};

export const normTenSp = (s: string) => (s || "").replace(/[,;]+$/g, "").trim();

export function khoaKhopTen(s: string) {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export async function layKhoVanDong(sb: any, from: string, to: string): Promise<KhoVanDong> {
  let wb: any[] = [], off = 0;
  while (true) {
    const { data } = await sb.from("jt_waybills")
      .select("waybill_no,status_group,goods_items,goods_name,order_create_time")
      .gte("order_create_time", from + " 00:00:00").lte("order_create_time", to + " 23:59:59").range(off, off + 999);
    if (!data || !data.length) break; wb = wb.concat(data); if (data.length < 1000) break; off += 1000;
  }

  const prod: Record<string, SpVanDong> = {};
  for (const w of wb) {
    const items = Array.isArray(w.goods_items) && w.goods_items.length ? w.goods_items : (w.goods_name ? [{ name: w.goods_name, qty: 1 }] : []);
    for (const it of items) {
      const key = normTenSp(it.name);
      if (!key) continue;
      const p = (prod[key] ??= { name: key, shipped: 0, delivered: 0, returned: 0, transit: 0, orders: 0 });
      const q = Number(it.qty) || 0;
      p.shipped += q; p.orders += 1;
      if (w.status_group === "delivered") p.delivered += q;
      else if (w.status_group === "returned") p.returned += q;
      else if (w.status_group === "transit") p.transit += q;
    }
  }
  const products = Object.values(prod).sort((a, b) => b.shipped - a.shipped);
  return {
    products,
    tong: {
      shipped: products.reduce((s, p) => s + p.shipped, 0),
      delivered: products.reduce((s, p) => s + p.delivered, 0),
      returned: products.reduce((s, p) => s + p.returned, 0),
      transit: products.reduce((s, p) => s + p.transit, 0),
    },
    soVanDon: wb.length,
    soVanDonHoan: wb.filter(w => w.status_group === "returned").length,
    soVanDonLoi: wb.filter(w => w.status_group === "other").length,
  };
}
