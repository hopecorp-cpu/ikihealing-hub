"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { encryptSecret, decryptSecret, last4, hasMasterKey } from "@/lib/secret-crypto";
import { isBodRole } from "@/lib/auth";
import { ACCOUNTS_WHITELIST } from "./layout";

async function requireVaultAccess() {
  const auth = getServerClient();
  const { data: { user: authUser } } = await auth.auth.getUser();
  if (!authUser) throw new Error("Chưa đăng nhập");
  const sb = getServiceClient();
  const { data: profile } = await sb.from("users").select("email, role").eq("id", authUser.id).maybeSingle();
  const email = (profile?.email || authUser.email || "").toLowerCase().trim();
  if (isBodRole(profile?.role) || !ACCOUNTS_WHITELIST.map(e => e.toLowerCase()).includes(email)) {
    throw new Error("Không có quyền truy cập kho tài khoản");
  }
  return { sb, adminId: authUser.id, email };
}

async function logAccountAction(sb: ReturnType<typeof getServiceClient>, entry: {
  account_id?: string | null; platform?: string | null;
  field: "account" | "password" | "two_fa"; action: "create" | "update" | "delete" | "reveal";
  user_id?: string | null; user_email?: string | null;
}) {
  try {
    await sb.from("platform_accounts_log").insert({
      account_id: entry.account_id ?? null, platform: entry.platform ?? null,
      field: entry.field, action: entry.action,
      user_id: entry.user_id ?? null, user_email: entry.user_email ?? null,
    });
  } catch {  }
}

export async function getPlatformAccounts() {
  const { sb } = await requireVaultAccess();
  const { data, error } = await sb.from("platform_accounts")
    .select("id,category,platform,label,url,username,notes,sort,updated_at,created_at,password_enc,password_last4,two_fa_enc,two_fa_last4")
    .order("sort", { ascending: true })
    .order("platform", { ascending: true });
  if (error) return { ready: false, hasKey: hasMasterKey(), rows: [] as any[] };
  const rows = (data ?? []).map((r: any) => ({
    id: r.id, category: r.category, platform: r.platform, label: r.label,
    url: r.url, username: r.username, notes: r.notes, sort: r.sort,
    updated_at: r.updated_at, created_at: r.created_at,
    has_password: !!r.password_enc, password_last4: r.password_last4 ?? null,
    has_two_fa: !!r.two_fa_enc, two_fa_last4: r.two_fa_last4 ?? null,
  }));
  return { ready: true, hasKey: hasMasterKey(), rows };
}

export async function upsertPlatformAccount(input: {
  id?: string; category: string; platform: string; label?: string;
  url?: string; username?: string; password?: string; two_fa?: string; notes?: string;
}) {
  const { sb, adminId, email } = await requireVaultAccess();
  if (!input.platform?.trim()) return { success: false, error: "Nhập tên nền tảng" };

  const row: any = {
    category: input.category || "Khác",
    platform: input.platform.trim(),
    label: input.label || null, url: input.url || null,
    username: input.username || null, notes: input.notes || null,
    updated_by: adminId, updated_at: new Date().toISOString(),
  };

  for (const [field, encCol, l4Col] of [
    ["password", "password_enc", "password_last4"],
    ["two_fa", "two_fa_enc", "two_fa_last4"],
  ] as const) {
    const val = ((input as any)[field] || "").trim();
    if (val) {
      if (!hasMasterKey()) return { success: false, error: "Chưa đặt SECRET_VAULT_KEY trên server nên chưa mã hóa được. Đặt biến rồi thử lại." };
      try { row[encCol] = encryptSecret(val); row[l4Col] = last4(val); }
      catch (e: any) { return { success: false, error: e?.message || "Lỗi mã hóa" }; }
    } else if (!input.id) {
      row[encCol] = null; row[l4Col] = null;
    }
  }

  let error: any, id = input.id;
  if (input.id) {
    ({ error } = await sb.from("platform_accounts").update(row).eq("id", input.id));
  } else {
    const ins = await sb.from("platform_accounts").insert(row).select("id").maybeSingle();
    error = ins.error; id = ins.data?.id;
  }
  if (error) return { success: false, error: error.message };
  await logAccountAction(sb, { account_id: id, platform: row.platform, field: "account", action: input.id ? "update" : "create", user_id: adminId, user_email: email });
  revalidatePath("/admin/accounts");
  return { success: true };
}

export async function deletePlatformAccount(id: string) {
  const { sb, adminId, email } = await requireVaultAccess();
  const { data: cur } = await sb.from("platform_accounts").select("platform").eq("id", id).maybeSingle();
  const { error } = await sb.from("platform_accounts").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  await logAccountAction(sb, { account_id: id, platform: cur?.platform ?? null, field: "account", action: "delete", user_id: adminId, user_email: email });
  revalidatePath("/admin/accounts");
  return { success: true };
}

export async function revealPlatformSecret(id: string, field: "password" | "two_fa"): Promise<{ success: boolean; value?: string; error?: string }> {
  const { sb, adminId, email } = await requireVaultAccess();
  const col = field === "two_fa" ? "two_fa_enc" : "password_enc";
  const { data } = await sb.from("platform_accounts").select(`platform,${col}`).eq("id", id).maybeSingle();
  if (!data) return { success: false, error: "Không tìm thấy tài khoản" };
  const blob = (data as any)[col] as string | null;
  if (!blob) return { success: false, error: "Mục này chưa có giá trị" };
  let value: string;
  try { value = decryptSecret(blob); }
  catch { return { success: false, error: "Giải mã thất bại (SECRET_VAULT_KEY có thể đã đổi so với lúc lưu)" }; }
  await logAccountAction(sb, { account_id: id, platform: (data as any).platform, field, action: "reveal", user_id: adminId, user_email: email });
  return { success: true, value };
}
