import { getServiceClient } from "./supabase-server";
import { decryptSecret } from "./secret-crypto";

export interface SecretMeta {
  id: string;
  name: string;
  label: string | null;
  category: string;
  last4: string | null;
  note: string | null;
  status: string;
  sort: number;
  has_value: boolean;
  updated_at: string;
  created_at: string;
}

export async function listSecretMeta(): Promise<SecretMeta[]> {
  const sb = getServiceClient();
  const { data } = await sb
    .from("secret_vault")
    .select("id,name,label,category,last4,note,status,sort,value_enc,updated_at,created_at")
    .order("sort", { ascending: true })
    .order("name", { ascending: true });
  return (data ?? []).map((r: any) => ({
    id: r.id, name: r.name, label: r.label, category: r.category,
    last4: r.last4, note: r.note, status: r.status, sort: r.sort,
    has_value: !!r.value_enc,
    updated_at: r.updated_at, created_at: r.created_at,
  }));
}

let cache: Record<string, { val: string; exp: number }> = {};

export async function getSecret(name: string, opts?: { fresh?: boolean }): Promise<string | null> {
  const now = Date.now();
  if (!opts?.fresh && cache[name] && cache[name].exp > now) return cache[name].val;
  const sb = getServiceClient();
  const { data } = await sb
    .from("secret_vault")
    .select("value_enc,status")
    .eq("name", name)
    .maybeSingle();
  if (!data || data.status !== "active" || !data.value_enc) return null;
  let val: string;
  try { val = decryptSecret(data.value_enc); } catch { return null; }
  cache[name] = { val, exp: now + 60_000 };
  return val;
}

export function clearSecretCache(name?: string): void {
  if (name) delete cache[name];
  else cache = {};
}

export async function logSecretAction(entry: {
  secret_name: string;
  action: "create" | "update" | "delete" | "reveal" | "use";
  user_id?: string | null;
  user_email?: string | null;
}): Promise<void> {
  try {
    const sb = getServiceClient();
    await sb.from("secret_vault_log").insert({
      secret_name: entry.secret_name,
      action: entry.action,
      user_id: entry.user_id ?? null,
      user_email: entry.user_email ?? null,
    });
  } catch {  }
}
