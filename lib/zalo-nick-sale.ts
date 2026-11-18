export type MocNick = { tu: string; sale: string };
export const NICK_SALE: Record<string, MocNick[]> = {
  "112878121298186278": [{ tu: "2000-01-01", sale: "Phạm Văn Sơn" }],
  "624876886226592559": [{ tu: "2000-01-01", sale: "Lê Thị Cúc" }],
  "717627577509293998": [{ tu: "2000-01-01", sale: "Hoàng Thị Đào" }, { tu: "2026-08-04", sale: "Lê Thị Cúc" }, { tu: "2026-08-21", sale: "Phạm Văn Sơn" }],
};

export function saleCuaNick(id: string | null | undefined, ngay?: string | null, bang: Record<string, MocNick[]> = NICK_SALE): string | null {
  const d = (ngay || new Date(Date.now() + 7 * 3600e3).toISOString()).slice(0, 10);
  const ds = bang[String(id ?? "")];
  if (!ds?.length) return null;
  let ra: string | null = null;
  for (const m of [...ds].sort((a, b) => a.tu.localeCompare(b.tu))) if (m.tu <= d) ra = m.sale;
  return ra;
}

export const tenGoiCuaNick = (id: string | null | undefined, ngay?: string | null) =>
  (saleCuaNick(id, ngay) || "").trim().toLowerCase().split(/\s+/).pop() || null;
