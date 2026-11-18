export const VAT_RATE = 0.08;
const VAT_MUL = 1 + VAT_RATE;

export const netOf = (row: { net_amount?: number | null }): number => Number(row?.net_amount) || 0;

export const sumNet = (rows: Array<{ net_amount?: number | null }>): number =>
  (rows || []).reduce((s, r) => s + netOf(r), 0);

export const toGross = (net: number): number => Math.round((Number(net) || 0) * VAT_MUL);

export const commissionBase = (net: number, shipFee = 0): number =>
  Math.max(0, (Number(net) || 0) - (Number(shipFee) || 0));

