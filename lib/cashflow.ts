import { getConfigValue } from "@/lib/app-config";

export type Tx = { date: string | null; amount: number; type: "credit" | "debit"; details?: string; cat?: string; isJt?: boolean; ref?: string };
export type CashMonth = { month: string; in: number; opIn: number; finIn: number; out: number; net: number };

const read = async (key: string): Promise<any> => {
  try { return JSON.parse((await getConfigValue(key)) || "null"); } catch { return null; }
};

const FINANCING_REFS = new Set([
  "TT26028057212872",
  "TT26014229167333",
  "FT25349346000335",
]);
const isFinancing = (t: Tx) => t.type === "credit" && FINANCING_REFS.has(t.ref || "");

export async function computeCashFlow() {
  const [mbTx, tcbTx, mbLatest, tcbLatest] = await Promise.all([
    read("mb_transactions"), read("tcb_transactions"), read("mb_latest"), read("tcb_latest"),
  ]);
  const mb: Tx[] = Array.isArray(mbTx) ? mbTx : [];
  const tcb: Tx[] = Array.isArray(tcbTx) ? tcbTx : [];
  if (!mb.length && !tcb.length) return null;

  const byMonth: Record<string, CashMonth> = {};
  const add = (t: Tx) => {
    const m = (t.date || "").slice(0, 7);
    if (!m) return;
    const r = (byMonth[m] ??= { month: m, in: 0, opIn: 0, finIn: 0, out: 0, net: 0 });
    if (t.type === "credit") {
      r.in += t.amount;
      if (isFinancing(t)) r.finIn += t.amount; else r.opIn += t.amount;
    } else r.out += t.amount;
    r.net = r.in - r.out;
  };
  mb.forEach(add); tcb.forEach(add);
  const months = Object.values(byMonth).sort((a, b) => (a.month < b.month ? -1 : 1));

  const dates = [...mb, ...tcb].map(t => t.date).filter(Boolean).sort() as string[];
  const from = dates[0], to = dates[dates.length - 1];
  const partial = new Set<string>();
  if (from && from.slice(8) !== "01") partial.add(from.slice(0, 7));
  if (to) { const last = new Date(new Date(to.slice(0, 7) + "-01T00:00:00Z").getTime() + 32 * 864e5); last.setUTCDate(0); if (+to.slice(8) < last.getUTCDate()) partial.add(to.slice(0, 7)); }

  const jtIn = mb.filter(t => t.isJt && t.type === "credit").reduce((s, t) => s + t.amount, 0);
  const finInTotal = [...mb, ...tcb].filter(isFinancing).reduce((s, t) => s + t.amount, 0);
  const totalIn = months.reduce((s, m) => s + m.in, 0);
  const opIn = totalIn - finInTotal;
  const otherIn = opIn - jtIn;

  const byCat: Record<string, { n: number; sum: number }> = tcbLatest?.byCat || {};

  const closing = (mbLatest?.balance?.closing ?? 0) + (tcbLatest?.balance?.closing ?? 0);
  const staleDays = to ? Math.floor((Date.now() - new Date(to + "T00:00:00Z").getTime()) / 864e5) : null;

  return {
    months, partial: [...partial], window: { from, to }, staleDays,
    totals: { in: totalIn, opIn, finIn: finInTotal, out: months.reduce((s, m) => s + m.out, 0), closing },

    jt: { in: jtIn, sharePct: opIn > 0 ? Math.round(jtIn / opIn * 100) : 0 },
    other: { in: otherIn, sharePct: opIn > 0 ? Math.round(otherIn / opIn * 100) : 0 },
    fin: { in: finInTotal },
    byCat, tcbSpend: tcbLatest?.spend ?? 0,
    banks: { mb: mbLatest?.balance?.closing ?? null, tcb: tcbLatest?.balance?.closing ?? null },
  };
}

export type CashFlow = NonNullable<Awaited<ReturnType<typeof computeCashFlow>>>;
