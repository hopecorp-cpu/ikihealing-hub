export function monthRange(month: string): { start: string; nextStart: string } {
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const nextStart = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { start, nextStart };
}
