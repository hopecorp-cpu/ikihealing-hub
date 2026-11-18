import { NextResponse } from "next/server";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove, isSalePosition } from "@/lib/auth";
import { vnDateStr } from "@/lib/payroll";
import { setConfigValue, getConfigValue } from "@/lib/app-config";
import { computeAuto, loadWeekBase, evalProgress, roleOf, dayDocKey, itemsForRole, isMet } from "@/lib/sales-checklist";
import { getSaleSnapshot } from "@/lib/sale-metrics";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const isSale = isSalePosition((user as any).position) || isManagerOrAbove(user.role);
  if (!isSale) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const values: Record<string, number> = {};
  if (b.values && typeof b.values === "object") {
    for (const [k, v] of Object.entries(b.values)) values[k] = Math.max(0, Number(v) || 0);
  }
  const links: Record<string, string> = {};
  if (b.links && typeof b.links === "object") {
    for (const [k, v] of Object.entries(b.links)) if (typeof v === "string" && v.trim()) links[k] = v.trim().slice(0, 500);
  }
  const today = vnDateStr();
  const sb = getServiceClient();
  const role = roleOf((user as any).position);
  const month = today.slice(0, 7);
  const dim = new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate();
  const [auto, weekBase, snap] = await Promise.all([
    computeAuto(sb, user.full_name || "", today, user.id),
    loadWeekBase(sb, user.id, today),
    getSaleSnapshot(user.full_name || "", month).catch(() => ({ me: null } as any)),
  ]);
  const overrides: Record<string, number> = {};
  const myTarget = (snap as any)?.me?.target || 0;
  if (myTarget > 0) overrides.revenue = Math.round(myTarget / dim / 1e5) * 1e5;
  const prog = evalProgress(values, auto, weekBase, role, overrides, links);

  const missing = itemsForRole(role).filter(it => !isMet(it, values, auto, weekBase, overrides, links)).map(it => it.label);

  const key = dayDocKey(today, user.id);
  let prev: any = {};
  try { prev = JSON.parse((await getConfigValue(key)) || "{}"); } catch { }
  const confirmedAt = b.confirm ? new Date().toISOString() : (prev.confirmedAt || null);

  const doc = {
    name: user.full_name || "", userId: user.id, date: today, role,
    values, links, auto, pct: prog.pct, done: prog.done, total: prog.total, missing,
    savedAt: new Date().toISOString(), confirmedAt,
  };
  await setConfigValue(key, JSON.stringify(doc), "Checklist Sale hằng ngày");
  return NextResponse.json({ ok: true, ...prog, confirmedAt });
}
