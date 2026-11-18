export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { pushToUsers, pushConfigured } from "@/lib/push";

export async function POST() {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { count } = await getServiceClient().from("push_subscriptions").select("*", { count: "exact", head: true }).eq("user_id", user.id);
  const subs = count || 0;
  const configured = pushConfigured();
  if (!configured) return NextResponse.json({ sent: 0, subs, configured, error: "VAPID chưa cấu hình trên server" }, { status: 503 });

  const sent = subs ? await pushToUsers([user.id], { title: "IKIHEALING Hub", body: "Gửi thử thông báo điện thoại", url: "/", tag: "acme-push-test" }) : 0;
  return NextResponse.json({ sent, subs, configured });
}
