import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { isBodRole } from "@/lib/auth";
import { draftCareMessage, getCareHistory } from "@/lib/care-memory";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isBodRole(user.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const phone = new URL(req.url).searchParams.get("phone") || "";
  if (!phone) return NextResponse.json({ error: "missing phone" }, { status: 400 });
  return NextResponse.json({ ok: true, events: await getCareHistory(phone) });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isBodRole(user.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const phone = String(b.phone || "").trim();
  if (!phone) return NextResponse.json({ error: "missing phone" }, { status: 400 });

  const r = await draftCareMessage(phone, { intent: b.intent });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 200 });
  return NextResponse.json({
    ok: true,
    text: r.text,
    flagged: r.flagged,
    brief: r.brief && {
      name: r.brief.name, orders: r.brief.orders, totalSpent: r.brief.totalSpent,
      daysSinceLastOrder: r.brief.daysSinceLastOrder, products: r.brief.products, touches: r.brief.touches,
    },
  });
}
