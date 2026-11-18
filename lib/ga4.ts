import { googleToken } from "@/lib/google-sa";

const SCOPE_GA4 = "https://www.googleapis.com/auth/analytics.readonly";
export type Ky = { tu: string; den: string };

export function ga4Property(): string {
  return (process.env.GA4_PROPERTY_ID || "").replace(/[^\d]/g, "");
}

export async function ga4Report(ky: Ky, metrics: string[], dimension?: string, limit = 10, locChua?: { truong: string; chua: string }): Promise<any> {
  const prop = ga4Property();
  if (!prop) return null;
  const token = await googleToken([SCOPE_GA4]);
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${prop}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      dateRanges: [{ startDate: ky.tu, endDate: ky.den }],
      metrics: metrics.map((name) => ({ name })),
      ...(dimension ? { dimensions: [{ name: dimension }], limit, orderBys: [{ metric: { metricName: metrics[0] }, desc: true }] } : {}),
      ...(locChua ? { dimensionFilter: { filter: { fieldName: locChua.truong, stringFilter: { matchType: "CONTAINS", value: locChua.chua, caseSensitive: false } } } } : {}),
    }),
    cache: "no-store",
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`GA4 lỗi: ${String(j?.error?.message || res.status)}`);
  return j;
}
