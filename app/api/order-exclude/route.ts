import { NextResponse } from "next/server";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const code = String(b.order_code || "").trim();
  if (!code) return NextResponse.json({ error: "missing order_code" }, { status: 400 });

  const sb = getServiceClient();
  const { data } = await sb.from("config").select("value").eq("key", "sale_excluded_orders").maybeSingle();
  let obj: Record<string, any> = {}; try { obj = JSON.parse(data?.value || "{}"); } catch { }
  if (b.exclude === false) { delete obj[code]; }
  else { obj[code] = { by: user.email || user.full_name || "", sale: b.sale || null, reason: b.reason || null, at: new Date().toISOString() }; }
  await sb.from("config").upsert({ key: "sale_excluded_orders", value: JSON.stringify(obj) }, { onConflict: "key" });
  return NextResponse.json({ ok: true, excluded: Object.keys(obj) });
}
