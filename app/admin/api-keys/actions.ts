"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { isAdmin, isBodRole } from "@/lib/auth";
import { encryptSecret, decryptSecret, last4, hasMasterKey } from "@/lib/secret-crypto";
import { listSecretMeta, clearSecretCache, logSecretAction, type SecretMeta } from "@/lib/secret-vault";
import { revalidatePath } from "next/cache";

async function requireVault() {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập");
  const sb = getServiceClient();
  const { data: profile } = await sb.from("users").select("email, role, active").eq("id", user.id).maybeSingle();
  if (!profile || profile.active === false || isBodRole(profile.role) || !isAdmin(profile.role)) {
    throw new Error("Không có quyền — chỉ Admin/CEO được dùng Két API Key");
  }
  return { sb, userId: user.id, email: (profile.email || user.email || "").toLowerCase() };
}

const SLUG = /^[a-z0-9_]{3,60}$/;

export async function getSecretsForAdmin(): Promise<{ ready: boolean; hasKey: boolean; rows: SecretMeta[] }> {
  await requireVault();
  const hasKey = hasMasterKey();
  try {
    const rows = await listSecretMeta();
    return { ready: true, hasKey, rows };
  } catch {
    return { ready: false, hasKey, rows: [] };
  }
}

export async function upsertSecret(input: {
  id?: string; name: string; label?: string; category?: string; note?: string; value?: string; status?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { sb, userId } = await requireVault();
  const name = (input.name || "").trim().toLowerCase();
  if (!SLUG.test(name)) return { success: false, error: "Tên key phải dạng a-z, 0-9, gạch dưới, dài 3–60 ký tự (vd anthropic_api_key)." };

  const row: any = {
    name,
    label: input.label?.trim() || null,
    category: input.category?.trim() || "Khác",
    note: input.note?.trim() || null,
    status: input.status === "disabled" ? "disabled" : "active",
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };

  const val = (input.value || "").trim();
  if (val) {
    if (!hasMasterKey()) return { success: false, error: "Chưa đặt SECRET_VAULT_KEY trên server nên chưa mã hóa được. Đặt biến rồi thử lại." };
    try {
      row.value_enc = encryptSecret(val);
      row.last4 = last4(val);
    } catch (e: any) {
      return { success: false, error: e?.message || "Lỗi mã hóa" };
    }
  }

  let error;
  if (input.id) ({ error } = await sb.from("secret_vault").update(row).eq("id", input.id));
  else ({ error } = await sb.from("secret_vault").insert(row));
  if (error) return { success: false, error: error.message };

  clearSecretCache(name);
  await logSecretAction({ secret_name: name, action: input.id ? "update" : "create", user_id: userId });
  revalidatePath("/admin/api-keys");
  return { success: true };
}

export async function deleteSecret(id: string): Promise<{ success: boolean; error?: string }> {
  const { sb, userId } = await requireVault();
  const { data: cur } = await sb.from("secret_vault").select("name").eq("id", id).maybeSingle();
  const { error } = await sb.from("secret_vault").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  if (cur?.name) { clearSecretCache(cur.name); await logSecretAction({ secret_name: cur.name, action: "delete", user_id: userId }); }
  revalidatePath("/admin/api-keys");
  return { success: true };
}

export async function revealSecret(id: string): Promise<{ success: boolean; value?: string; error?: string }> {
  const { sb, userId, email } = await requireVault();
  const { data } = await sb.from("secret_vault").select("name,value_enc").eq("id", id).maybeSingle();
  if (!data) return { success: false, error: "Không tìm thấy key" };
  if (!data.value_enc) return { success: false, error: "Key này chưa được điền giá trị" };
  let value: string;
  try { value = decryptSecret(data.value_enc); }
  catch { return { success: false, error: "Giải mã thất bại (SECRET_VAULT_KEY có thể đã đổi so với lúc lưu)" }; }
  await logSecretAction({ secret_name: data.name, action: "reveal", user_id: userId, user_email: email });
  return { success: true, value };
}
