"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function getMyNotifications(limit = 20) {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { items: [], unread: 0 };
  const sb = getServiceClient();
  const [{ data: items }, { count }] = await Promise.all([
    sb.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(limit),
    sb.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("read", false)
  ]);
  return { items: items ?? [], unread: count ?? 0 };
}

export async function markNotificationRead(id: string) {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { success: false };
  const sb = getServiceClient();
  await sb.from("notifications").update({ read: true }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/");
  return { success: true };
}

export async function markAllNotificationsRead() {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { success: false };
  const sb = getServiceClient();
  await sb.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
  revalidatePath("/");
  return { success: true };
}
