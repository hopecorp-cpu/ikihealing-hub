"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { book, setStatus, type ConsultStatus } from "@/lib/consultations";
import { revalidatePath } from "next/cache";

async function me(): Promise<{ id: string; full_name: string } | null> {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return null;
  const sb = getServiceClient();
  const { data } = await sb.from("users").select("id, full_name").eq("id", user.id).maybeSingle();
  return (data as any) || null;
}

export async function bookAction(input: {
  slot_date: string; slot_time: string; staff_id: string; staff_name: string;
  customer_name: string; customer_phone?: string; channel?: string; source?: string; note?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const u = await me();
  if (!u) return { ok: false, error: "Chưa đăng nhập" };
  if (!input.customer_name?.trim()) return { ok: false, error: "Nhập tên khách giúp em" };
  const r = await book({ ...input, created_by: u.id });
  if (r.ok) revalidatePath("/lich-tu-van");
  return r;
}

export async function walkInAction(input: {
  slot_date: string; staff_id: string; staff_name: string; customer_name: string; customer_phone?: string; note?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const u = await me();
  if (!u) return { ok: false, error: "Chưa đăng nhập" };
  if (!input.customer_name?.trim()) return { ok: false, error: "Nhập tên khách giúp em" };
  const now = new Date(Date.now() + 7 * 3600e3);
  const slot = `${String(now.getUTCHours()).padStart(2, "0")}:${now.getUTCMinutes() < 30 ? "00" : "30"}`;
  const r = await book({ ...input, slot_time: slot, source: "vang-lai", channel: "truc-tiep", created_by: u.id });
  if (!r.ok) return r;
  const sb = getServiceClient();
  const { data } = await sb.from("consultations").select("id")
    .eq("slot_date", input.slot_date).eq("slot_time", slot).eq("staff_id", input.staff_id).maybeSingle();
  if (data?.id) await setStatus(String(data.id), "den");
  revalidatePath("/lich-tu-van");
  return { ok: true };
}

export async function statusAction(id: string, status: ConsultStatus, outcome?: string): Promise<{ ok: boolean; error?: string }> {
  const u = await me();
  if (!u) return { ok: false, error: "Chưa đăng nhập" };
  const r = await setStatus(id, status, outcome);
  if (r.ok) revalidatePath("/lich-tu-van");
  return r;
}
