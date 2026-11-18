import { NextResponse } from "next/server";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isManagerOrAbove((user as any).role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const code = String(b.order_code || "").trim();
  if (!code) return NextResponse.json({ error: "missing order_code" }, { status: 400 });
  const sale = String(b.sale || "").trim();

  const sb = getServiceClient();
  const { data } = await sb.from("config").select("value").eq("key", "sale_reassign_orders").maybeSingle();
  let obj: Record<string, any> = {}; try { obj = JSON.parse(data?.value || "{}"); } catch { }
  if (!sale) delete obj[code];
  else obj[code] = { sale, by: user.email || (user as any).full_name || "", at: new Date().toISOString() };
  await sb.from("config").upsert({ key: "sale_reassign_orders", value: JSON.stringify(obj) }, { onConflict: "key" });
  return NextResponse.json({ ok: true, order_code: code, sale: sale || null });
}
