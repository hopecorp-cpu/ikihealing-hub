export type OrderOverrides = {
  excluded: Set<string>;
  reassign: Record<string, string>;
};

export async function loadOrderOverrides(sb: any): Promise<OrderOverrides> {
  let excluded = new Set<string>();
  let reassign: Record<string, string> = {};
  try {
    const { data } = await sb.from("config").select("value").eq("key", "sale_excluded_orders").maybeSingle();
    excluded = new Set(Object.keys(JSON.parse(data?.value || "{}")));
  } catch { }
  try {
    const { data } = await sb.from("config").select("value").eq("key", "sale_reassign_orders").maybeSingle();
    const raw = JSON.parse(data?.value || "{}");

    for (const [code, v] of Object.entries(raw)) reassign[code] = typeof v === "string" ? v : ((v as any)?.sale || "");
  } catch { }
  return { excluded, reassign };
}

export function effectiveSaleName(orderCode: string, rawSaleName: string, ov: OrderOverrides): string {
  const re = ov.reassign[orderCode];
  return re != null && re !== "" ? re : (rawSaleName || "");
}
