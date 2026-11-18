"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";

export async function danhDauDaCham(leadId: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "chưa đăng nhập" };
  const sb = getServiceClient();

  const { data: lead } = await sb.from("leads").select("id, assignee_id, status, first_contact_at").eq("id", leadId).maybeSingle();
  if (!lead) return { ok: false, error: "không thấy khách này" };

  if (lead.assignee_id && lead.assignee_id !== (user as any).id) return { ok: false, error: "khách này của người khác" };

  const patch: any = { status: "contacted" };
  if (!lead.first_contact_at) patch.first_contact_at = new Date().toISOString();
  if (!lead.assignee_id) patch.assignee_id = (user as any).id;

  const { error } = await sb.from("leads").update(patch).eq("id", leadId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/viec-hom-nay");
  return { ok: true };
}

export async function danhDauBoQua(leadId: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "chưa đăng nhập" };
  const sb = getServiceClient();
  const { data: lead } = await sb.from("leads").select("assignee_id").eq("id", leadId).maybeSingle();
  if (lead?.assignee_id && lead.assignee_id !== (user as any).id) return { ok: false, error: "khách này của người khác" };
  const { error } = await sb.from("leads").update({ status: "lost" }).eq("id", leadId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/viec-hom-nay");
  return { ok: true };
}
