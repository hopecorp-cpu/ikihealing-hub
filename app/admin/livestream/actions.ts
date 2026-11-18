"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { livestreamAmount } from "@/lib/payroll";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const auth = getServerClient();
  const { data: { user: authUser } } = await auth.auth.getUser();
  if (!authUser) throw new Error("Chưa đăng nhập");
  const sb = getServiceClient();
  const { data: profile } = await sb.from("users").select("role").eq("id", authUser.id).maybeSingle();
  if (!profile || (profile.role !== "admin" && profile.role !== "ceo")) throw new Error("Không có quyền");
  return { sb, adminId: authUser.id };
}

export async function getLivestreamSessions(month: string) {
  const { sb } = await requireAdmin();
  const start = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const nextStart = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const { data, error } = await sb.from("livestream_sessions")
    .select("id, user_id, session_date, headcount, amount, note, users!livestream_sessions_user_id_fkey(full_name, position)")
    .gte("session_date", start).lt("session_date", nextStart)
    .order("session_date", { ascending: false });
  if (error) return { ready: false, rows: [] as any[] };
  return { ready: true, rows: data ?? [] };
}

export async function addLivestreamSession(input: { user_id: string; session_date: string; headcount: number; note?: string }) {
  const { sb, adminId } = await requireAdmin();
  if (!input.user_id || !input.session_date) return { success: false, error: "Chọn nhân viên + ngày" };
  const headcount = Math.max(1, Math.round(input.headcount || 1));
  const amount = livestreamAmount(headcount);
  const { error } = await sb.from("livestream_sessions").insert({
    user_id: input.user_id, session_date: input.session_date, headcount, amount,
    note: input.note || (headcount >= 2 ? `Live ${headcount} người` : "Live 1 mình"), created_by: adminId,
  });
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/livestream");
  return { success: true, amount };
}

export async function deleteLivestreamSession(id: string) {
  const { sb } = await requireAdmin();
  const { error } = await sb.from("livestream_sessions").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/livestream");
  return { success: true };
}
