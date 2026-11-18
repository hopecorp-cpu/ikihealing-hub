import { getServerClient, getServiceClient } from "./supabase-server";

export type GuardResult<T = any> =
  | { ok: true; userId: string; role: string; sb: ReturnType<typeof getServiceClient> }
  | { ok: false; error: string };

async function getRole(): Promise<{ userId: string; role: string } | null> {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return null;
  const sb = getServiceClient();
  const { data } = await sb.from("users").select("role, active").eq("id", user.id).maybeSingle();
  if (!data || !data.active) return null;
  return { userId: user.id, role: data.role };
}

export async function guardManager(): Promise<GuardResult> {
  const r = await getRole();
  if (!r) return { ok: false, error: "Chưa đăng nhập hoặc tài khoản bị khoá" };
  if (!["admin", "ceo", "manager"].includes(r.role)) {
    return { ok: false, error: "Không có quyền — chỉ Manager/Admin được dùng tính năng này" };
  }
  return { ok: true, userId: r.userId, role: r.role, sb: getServiceClient() };
}

export async function guardAdmin(): Promise<GuardResult> {
  const r = await getRole();
  if (!r) return { ok: false, error: "Chưa đăng nhập hoặc tài khoản bị khoá" };
  if (!["admin", "ceo"].includes(r.role)) {
    return { ok: false, error: "Không có quyền — chỉ Admin/CEO được dùng tính năng này" };
  }
  return { ok: true, userId: r.userId, role: r.role, sb: getServiceClient() };
}
