export type LineRow = {
  order_date: string | null;
  gross_amount: number | null;
  discount: number | null;
  net_amount: number | null;
  cost_amount: number | null;
  profit_amount: number | null;
  sale_channel: string | null;
  product_name: string | null;
};

export type KmAgg = {
  key: string;
  gross: number;
  discount: number;
  net: number;
  discountRate: number;
  marginPct: number;
  orders: number;
};

function pct(part: number, whole: number): number { return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0; }

function agg(rows: LineRow[], keyOf: (r: LineRow) => string): KmAgg[] {
  const m = new Map<string, { gross: number; discount: number; net: number; profit: number; cost: number; orders: number }>();
  for (const r of rows) {
    const k = keyOf(r) || "—";
    const cur = m.get(k) || { gross: 0, discount: 0, net: 0, profit: 0, cost: 0, orders: 0 };
    cur.gross += Number(r.gross_amount) || 0;
    cur.discount += Number(r.discount) || 0;
    cur.net += Number(r.net_amount) || 0;
    cur.profit += Number(r.profit_amount) || 0;
    cur.cost += Number(r.cost_amount) || 0;
    cur.orders += 1;
    m.set(k, cur);
  }
  return [...m.entries()].map(([key, v]) => ({
    key, gross: v.gross, discount: v.discount, net: v.net, orders: v.orders,
    discountRate: pct(v.discount, v.gross),

    marginPct: v.profit !== 0 ? pct(v.profit, v.net) : pct(v.net - v.cost, v.net),
  }));
}

export type KmReport = {
  byMonth: KmAgg[];
  byChannel: KmAgg[];
  byProduct: KmAgg[];
  overall: KmAgg;
  flags: { product: string; discountRate: number; marginPct: number; reason: string }[];
};

export function analyzeKm(rows: LineRow[], marginFloor = 30): KmReport {
  const byMonth = agg(rows, r => (r.order_date || "").slice(0, 7)).filter(a => a.key !== "—").sort((a, b) => a.key.localeCompare(b.key));
  const byChannel = agg(rows, r => r.sale_channel || "Khác").sort((a, b) => b.gross - a.gross);
  const byProductAll = agg(rows, r => r.product_name || "—");
  const byProduct = [...byProductAll].sort((a, b) => b.discount - a.discount).slice(0, 15);
  const overall = agg(rows, () => "Tổng")[0] || { key: "Tổng", gross: 0, discount: 0, net: 0, discountRate: 0, marginPct: 0, orders: 0 };

  const flags = byProductAll
    .filter(p => p.gross > 0 && (p.discountRate >= 15 || (p.marginPct !== 0 && p.marginPct < marginFloor)))
    .sort((a, b) => (a.marginPct < 0 ? -1 : 0) - (b.marginPct < 0 ? -1 : 0) || b.discount - a.discount)
    .slice(0, 8)
    .map(p => ({
      product: p.key, discountRate: p.discountRate, marginPct: p.marginPct,
      reason: p.marginPct < 0 ? "BÁN LỖ (biên âm)" : p.discountRate >= 25 ? "Giảm rất sâu (≥25%)" : p.marginPct !== 0 && p.marginPct < marginFloor ? `Biên còn ${p.marginPct}% (< ${marginFloor}%)` : "Giảm sâu ≥15%",
    }));

  return { byMonth, byChannel, byProduct, overall, flags };
}

export const fmtKmVND = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n || 0)) + "đ";
