import "server-only";
import webpush from "web-push";
import { getServiceClient } from "@/lib/supabase-server";

let configured = false;
let daBaoThieu = false;
function ensureVapid(): boolean {
  if (configured) return true;
  const pub = (process.env.VAPID_PUBLIC_KEY || "").trim();
  const priv = (process.env.VAPID_PRIVATE_KEY || "").trim();
  if (!pub || !priv) {

    if (!daBaoThieu) { daBaoThieu = true; console.warn("[push] thiếu VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY trên môi trường này — pushToUsers luôn trả 0"); }
    return false;
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, priv);
  configured = true;
  return true;
}

export function pushConfigured(): boolean { return ensureVapid(); }

export type PushMsg = { title: string; body: string; url?: string; tag?: string; important?: boolean };

export async function pushToUsers(userIds: string[], msg: PushMsg): Promise<number> {
  if (!ensureVapid() || !userIds.length) return 0;
  const sb = getServiceClient();
  const { data: subs } = await sb.from("push_subscriptions").select("*").in("user_id", userIds);
  if (!subs || !subs.length) return 0;
  const payload = JSON.stringify({
    title: msg.title, body: msg.body, url: msg.url || "/", tag: msg.tag, important: !!msg.important,
  });
  let sent = 0;
  await Promise.all(subs.map(async (s: any) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
      sent++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    }
  }));
  return sent;
}
