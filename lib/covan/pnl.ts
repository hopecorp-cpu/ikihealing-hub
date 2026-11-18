import { getServiceClient } from "@/lib/supabase-server";
import { doanhThuChot } from "@/lib/doanh-thu-that";

export type MonthPnl = {
  month: string;
  revenue: number;
  cogs: number;
  gross: number | null;
  payroll: number;
  ship: number;
  interest: number;
  ads: number;
  opex: number;
  net_operating: number;
};

export type PnlSummary = {
  pnl: MonthPnl[];
  coverage: Record<string, string[]>;
  gross_margin: {
    months: string[];
    revenue: number;
    cogs: number;
    gross_margin: number;
    gross_margin_pct: number | null;
  };
  total_income: number;
  total_expense: number;
  caveats: string[];
};

export const MISA_FIRST_MONTH = "2026-03";

export const OPEX_CATEGORIES = [
  "expense_logistics",
  "expense_payment_gateway",
  "expense_office",
  "expense_tax",
  "expense_marketing",
];

export const CAVEATS = [
  "Doanh thu T1-T2 lấy từ orders vì chưa có sổ đơn nhóm lẫn vận đơn J&T cho hai tháng đó.",
  "GIÁ VỐN vẫn đọc từ MISA (chưa có nguồn khác), trong khi DOANH THU đã chuyển sang sổ đơn " +
    "nhóm + J&T. Hai số KHÁC NGUỒN nên biên gộp và net_operating chỉ để tham khảo, chưa " +
    "được dùng làm căn cứ chốt lời/lỗ.",
  "PHÍ SHIP ghi đến T4 rồi ngừng (T5+ = 0 trong orders) — chi phí thật cao hơn.",
  "QUẢNG CÁO mới ghi 1 tháng (T7 ~4tr) + bank có vết chuyển ~13tr chạy ads T4-T5 " +
    "chưa vào sổ — ads đang ghi THIẾU nghiêm trọng.",
  "expenses 'expense_other' ~1,16 tỷ CHƯA phân loại (lẫn trả gốc vay 300tr + " +
    "thiết bị + dịch vụ 1 lần) — không tính vào P&L để tránh sai; cần bóc tay.",
  "Lãi vay chia đều tháng theo quý từ loan_payments (dư nợ hiện tại 850tr).",
  "CHƯA có số dư tiền mặt hiện tại (bank_transactions không có cột số dư) — " +
    "runway cần CEO cung cấp số dư quỹ.",
];

export function vnToday(): string {
  return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

type QueryResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

export async function fetchAll<T>(build: (from: number, to: number) => QueryResult<T>): Promise<T[]> {
  const out: T[] = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await build(off, off + 999);
    if (error) throw new Error(`Query covan lỗi: ${error.message}`);
    if (!data || !data.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

type Bucket = {
  revenue: number;
  cogs: number;
  payroll: number;
  ship: number;
  interest: number;
  ads: number;
  opex: number;
};

export async function computePnl(): Promise<PnlSummary> {
  const sb = getServiceClient();

  const [dtChot, misaRows, orderRows, payrollRows, loanRows, expenseRows, adRows] = await Promise.all([
    doanhThuChot(),
    fetchAll<{ ref_date: string; revenue: number | null; cogs: number | null }>((f, t) =>
      sb.from("misa_daily_profit").select("ref_date,revenue,cogs").order("ref_date").range(f, t)),
    fetchAll<{ order_date: string; net_revenue: number | null; shipping_cost: number | null }>((f, t) =>
      sb.from("orders").select("order_date,net_revenue,shipping_cost").eq("status", "delivered").order("order_date").range(f, t)),
    fetchAll<{ month: string; total_company_cost: number | null }>((f, t) =>
      sb.from("payroll").select("month,total_company_cost").order("month").range(f, t)),
    fetchAll<{ period_start: string | null; period_end: string | null; gross_amount: number | null }>((f, t) =>
      sb.from("loan_payments").select("period_start,period_end,gross_amount").eq("payment_type", "interest").range(f, t)),
    fetchAll<{ expense_date: string; amount: number | null }>((f, t) =>
      sb.from("expenses").select("expense_date,amount").in("category", OPEX_CATEGORIES).order("expense_date").range(f, t)),
    fetchAll<{ key: string; value: string | null }>((f, t) =>
      sb.from("config").select("key,value").like("key", "mkt_spend_%").range(f, t)),
  ]);

  const buckets = new Map<string, Bucket>();
  const at = (m: string): Bucket => {
    let b = buckets.get(m);
    if (!b) {
      b = { revenue: 0, cogs: 0, payroll: 0, ship: 0, interest: 0, ads: 0, opex: 0 };
      buckets.set(m, b);
    }
    return b;
  };
  const coverage: Record<string, Set<string>> = {

    sales: new Set(), sales_so_don: new Set(), sales_jt: new Set(),
    sales_legacy: new Set(), cogs: new Set(), payroll: new Set(),
    ship: new Set(), interest: new Set(), ads: new Set(), opex: new Set(),
  };
  const mark = (src: string, month: string, amount: number) => {
    if (amount !== 0) coverage[src].add(month);
  };

  for (const [m, v] of dtChot.theoThang) {
    at(m).revenue += v.doanhThu;
    mark("sales", m, v.doanhThu);
    mark(v.nguon === "so-don" ? "sales_so_don" : "sales_jt", m, v.doanhThu);
  }

  for (const r of misaRows) {
    const m = (r.ref_date || "").slice(0, 7);
    if (!m) continue;
    const cogs = num(r.cogs);
    at(m).cogs += cogs;
    mark("cogs", m, cogs);
  }

  for (const r of orderRows) {
    const m = (r.order_date || "").slice(0, 7);
    if (!m) continue;
    if (!dtChot.theoThang.has(m)) {
      const rev = num(r.net_revenue);
      at(m).revenue += rev;
      mark("sales_legacy", m, rev);
    }
    const ship = num(r.shipping_cost);
    if (ship > 0) {
      at(m).ship += ship;
      mark("ship", m, ship);
    }
  }

  for (const r of payrollRows) {
    const m = (r.month || "").trim();
    if (!m) continue;
    const v = num(r.total_company_cost);
    at(m).payroll += v;
    mark("payroll", m, v);
  }

  const curMonth = vnToday().slice(0, 7);
  for (const r of loanRows) {
    const start = (r.period_start || "").slice(0, 10);
    const end = (r.period_end || "").slice(0, 10);
    const amount = num(r.gross_amount);
    if (!start || !end || !amount) continue;
    const months: string[] = [];
    let y = Number(start.slice(0, 4)), mo = Number(start.slice(5, 7));
    const y1 = Number(end.slice(0, 4)), m1 = Number(end.slice(5, 7));
    while (y < y1 || (y === y1 && mo <= m1)) {
      months.push(`${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}`);
      mo += 1;
      if (mo > 12) { mo = 1; y += 1; }
    }
    for (const m of months) {
      if (m > curMonth) continue;
      const v = amount / months.length;
      at(m).interest += v;
      mark("interest", m, v);
    }
  }

  for (const r of expenseRows) {
    const m = (r.expense_date || "").slice(0, 7);
    if (!m) continue;
    const v = num(r.amount);
    at(m).opex += v;
    mark("opex", m, v);
  }

  for (const r of adRows) {
    const m = (r.key || "").replace("mkt_spend_", "").trim();
    if (m.length !== 7) continue;
    const v = num(r.value);
    at(m).ads += v;
    mark("ads", m, v);
  }

  const pnl: MonthPnl[] = [...buckets.keys()].sort().map((month) => {
    const b = buckets.get(month)!;
    const net =
      b.revenue - b.cogs - b.payroll - b.ship - b.interest - b.ads - b.opex;
    return {
      month,
      revenue: b.revenue,
      cogs: b.cogs,
      gross: b.cogs ? b.revenue - b.cogs : null,
      payroll: b.payroll,
      ship: b.ship,
      interest: b.interest,
      ads: b.ads,
      opex: b.opex,
      net_operating: net,
    };
  });

  const gmMonths = [...coverage.sales].filter((m) => coverage.cogs.has(m)).sort();
  let gmRev = 0, gmCogs = 0;
  for (const p of pnl) {
    if (gmMonths.includes(p.month)) { gmRev += p.revenue; gmCogs += p.cogs; }
  }
  const grossMargin = {
    months: gmMonths,
    revenue: gmRev,
    cogs: gmCogs,
    gross_margin: gmRev - gmCogs,
    gross_margin_pct: gmRev ? Math.round(((gmRev - gmCogs) / gmRev) * 1000) / 10 : null,
  };

  let totalIncome = 0, totalExpense = 0;
  for (const p of pnl) {
    totalIncome += p.revenue;
    totalExpense += p.cogs + p.payroll + p.ship + p.interest + p.ads + p.opex;
  }

  return {
    pnl,
    coverage: Object.fromEntries(Object.entries(coverage).map(([k, v]) => [k, [...v].sort()])),
    gross_margin: grossMargin,
    total_income: totalIncome,
    total_expense: totalExpense,

    caveats: [...dtChot.data.caveats, ...CAVEATS],
  };
}

export const tr = (n: number | null | undefined): string =>
  `${Math.round(((n || 0) / 1e6) * 10) / 10}tr`;
