"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { saveChannelPolicy, type ChannelPolicy } from "@/lib/channel-policy";
import { revalidatePath } from "next/cache";

export async function saveChannelPolicyAction(policy: Partial<ChannelPolicy>): Promise<{ ok: boolean; error?: string }> {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập" };
  const sb = getServiceClient();
  const { data: me } = await sb.from("users").select("role, full_name").eq("id", user.id).maybeSingle();
  if (!me || !isManagerOrAbove((me as any).role)) return { ok: false, error: "Không đủ quyền" };
  try { await saveChannelPolicy(policy, (me as any).full_name || ""); revalidatePath("/chinh-sach-kenh"); return { ok: true }; }
  catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}
