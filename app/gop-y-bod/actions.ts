"use server";
import { getCurrentUser } from "@/lib/supabase-server";
import { coTheGhiNhanBaoCao, isManagerOrAbove } from "@/lib/auth";
import { addBodFeedback, getBodFeedback, setFeedbackStatus, deleteFeedback, type FeedbackKind, type FeedbackStatus, type BodFeedback } from "@/lib/bod-feedback";
import { revalidatePath } from "next/cache";

export async function listFeedback(): Promise<BodFeedback[]> {
  return getBodFeedback();
}

export async function submitFeedback(reportKey: string, kind: FeedbackKind, text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Cần đăng nhập" };
    if (!coTheGhiNhanBaoCao(user.role)) return { ok: false, error: "Vai trò chỉ xem không ghi nhận được" };
    if (!text || !text.trim()) return { ok: false, error: "Chưa nhập góp ý" };
    await addBodFeedback({ reportKey, author: user.full_name || "?", kind, text });
    revalidatePath("/gop-y-bod");
    return { ok: true };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}

export async function updateStatus(id: string, status: FeedbackStatus): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user || !isManagerOrAbove(user.role)) return { ok: false, error: "Không có quyền" };
    await setFeedbackStatus(id, status);
    revalidatePath("/gop-y-bod");
    return { ok: true };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}

export async function removeFeedback(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user || !isManagerOrAbove(user.role)) return { ok: false, error: "Không có quyền" };
    await deleteFeedback(id);
    revalidatePath("/gop-y-bod");
    return { ok: true };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}
