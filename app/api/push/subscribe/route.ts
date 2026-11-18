export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sub = await req.json().catch(() => null);
  if (!sub?.endpoint) return NextResponse.json({ error: "Bad subscription" }, { status: 400 });
  const sb = getServiceClient();
  const { error } = await sb.from("push_subscriptions").upsert({
    user_id: user.id, endpoint: sub.endpoint,
    p256dh: sub.keys?.p256dh || "", auth: sub.keys?.auth || "",
    updated_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { endpoint } = await req.json().catch(() => ({}));
  if (endpoint) await getServiceClient().from("push_subscriptions").delete().eq("endpoint", endpoint);
  return NextResponse.json({ ok: true });
}
