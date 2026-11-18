import { NextResponse } from "next/server";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isAccountantPosition, isBodRole, isManagerOrAbove } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isBodRole(user.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!(isManagerOrAbove(user.role) || isAccountantPosition((user as any).position))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const month = String(b.month || "").match(/^\d{4}-\d{2}$/) ? b.month : null;
  const saleName = String(b.saleName || "").trim();
  if (!month || !saleName) return NextResponse.json({ error: "missing month/saleName" }, { status: 400 });
  const sb = getServiceClient();
  const key = `sale_ship_${month}`;
  const { data } = await sb.from("config").select("value").eq("key", key).maybeSingle();
  let obj: Record<string, number> = {}; try { obj = JSON.parse(data?.value || "{}"); } catch { }
  obj[saleName] = Math.max(0, Number(b.ship) || 0);
  await sb.from("config").upsert({ key, value: JSON.stringify(obj) }, { onConflict: "key" });
  return NextResponse.json({ ok: true, ship: obj });
}
