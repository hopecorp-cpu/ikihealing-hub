"use server";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { markContacted, pickAssignee, saveLeadConfig, type LeadStatus } from "@/lib/leads";
import { revalidatePath } from "next/cache";

export async function contactLead(leadId: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập" };
  const sb = getServiceClient();
  if (!isManagerOrAbove(user.role)) {
    const { data } = await sb.from("leads").select("assignee_id").eq("id", leadId).maybeSingle();
    if (!data || data.assignee_id !== (user as any).id) return { ok: false, error: "Không phải lead của bạn" };
  }
  await markContacted(sb, leadId);
  revalidatePath("/leads");
  return { ok: true };
}

export async function setLeadStatus(leadId: string, status: LeadStatus) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập" };
  const sb = getServiceClient();
  if (!isManagerOrAbove(user.role)) {
    const { data } = await sb.from("leads").select("assignee_id").eq("id", leadId).maybeSingle();
    if (!data || data.assignee_id !== (user as any).id) return { ok: false, error: "Không phải lead của bạn" };
  }
  const patch: any = { status };
  if (status === "contacted") patch.first_contact_at = new Date().toISOString();
  await sb.from("leads").update(patch).eq("id", leadId);
  revalidatePath("/leads");
  return { ok: true };
}

export async function reassignLead(leadId: string, toSaleId?: string) {
  const user = await getCurrentUser();
  if (!user || !isManagerOrAbove(user.role)) return { ok: false, error: "Không có quyền" };
  const sb = getServiceClient();
  const { data: cur } = await sb.from("leads").select("assignee_id, source, product, share_count").eq("id", leadId).maybeSingle();
  const next = toSaleId || (await pickAssignee(sb, { source: cur?.source, product: cur?.product, exclude: cur?.assignee_id }));
  if (!next) return { ok: false, error: "Không có sale để chia" };
  const now = new Date().toISOString();
  await sb.from("leads").update({ assignee_id: next, assigned_at: now, last_reassign_at: now, status: "new", first_contact_at: null, share_count: (cur?.share_count || 1) + 1 }).eq("id", leadId);
  revalidatePath("/leads");
  return { ok: true };
}

export async function saveLeadConfigAction(input: { slaMinutes: number; reassignMinutes: number; autoReassign: boolean }) {
  const user = await getCurrentUser();
  if (!user || !isManagerOrAbove(user.role)) return { ok: false, error: "Không có quyền" };
  await saveLeadConfig({
    slaMinutes: Math.max(1, Math.round(Number(input.slaMinutes) || 15)),
    reassignMinutes: Math.max(1, Math.round(Number(input.reassignMinutes) || 15)),
    autoReassign: !!input.autoReassign,
  });
  revalidatePath("/leads");
  return { ok: true };
}
