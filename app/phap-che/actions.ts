"use server";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { DEFAULT_LEGAL_ITEMS, type LegalItem } from "@/lib/legal-register";
import { revalidatePath } from "next/cache";

const KEY = "legal_register";

async function requireManager() {
  const user = await getCurrentUser();
  if (!user || !isManagerOrAbove(user.role)) throw new Error("Không có quyền");
  return user;
}

export async function getLegalRegister(): Promise<LegalItem[]> {
  try { return JSON.parse((await getConfigValue(KEY)) || "[]"); } catch { return []; }
}

export async function saveLegalRegister(items: LegalItem[]): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireManager();
    await setConfigValue(KEY, JSON.stringify(items), `Sổ pháp chế — cập nhật bởi ${user.full_name}`);
    revalidatePath("/phap-che");
    return { ok: true };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}

export async function seedLegalDefaults(): Promise<{ ok: boolean; error?: string; count?: number }> {
  try {
    await requireManager();
    const cur = await getLegalRegister();
    if (cur.length > 0) return { ok: false, error: "Sổ đã có dữ liệu — không nạp đè" };
    const items: LegalItem[] = DEFAULT_LEGAL_ITEMS.map(it => ({ ...it, id: crypto.randomUUID() }));
    await setConfigValue(KEY, JSON.stringify(items), "Sổ pháp chế — nạp khung mẫu");
    revalidatePath("/phap-che");
    return { ok: true, count: items.length };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}
