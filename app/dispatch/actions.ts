"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove, isMktPosition } from "@/lib/auth";
import { runCampaign, suggestCampaign, type CampaignInput } from "@/lib/dispatch";
import { revalidatePath } from "next/cache";

export async function suggestCampaignAction(): Promise<{ ok: boolean; input?: CampaignInput; rationale?: string; error?: string }> {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập" };
  const sb = getServiceClient();
  const { data: me } = await sb.from("users").select("role, position").eq("id", user.id).maybeSingle();
  if (!me || (!isManagerOrAbove((me as any).role) && !isMktPosition((me as any).position))) return { ok: false, error: "Không đủ quyền" };
  try { const s = await suggestCampaign(); return { ok: true, input: s.input, rationale: s.rationale }; }
  catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}

export async function runCampaignAction(input: CampaignInput): Promise<{ ok: boolean; passed?: number; failed?: number; error?: string }> {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập" };
  const sb = getServiceClient();
  const { data: me } = await sb.from("users").select("role, position").eq("id", user.id).maybeSingle();
  if (!me || (!isManagerOrAbove((me as any).role) && !isMktPosition((me as any).position))) {
    return { ok: false, error: "Không đủ quyền" };
  }
  const r = await runCampaign(input);
  revalidatePath("/dispatch");
  return r;
}
