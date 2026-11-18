"use server";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { DEFAULT_DOCS, type DocItem } from "@/lib/doc-registry";
import { buildDistillProposals, type DistillProposal } from "@/lib/distill";
import { revalidatePath } from "next/cache";

const KEY = "doc_registry";
const DISMISS_KEY = "distill_dismissed";

async function requireManager() {
  const user = await getCurrentUser();
  if (!user || !isManagerOrAbove(user.role)) throw new Error("Không có quyền");
  return user;
}

export async function getDocs(): Promise<DocItem[]> {
  try { return JSON.parse((await getConfigValue(KEY)) || "[]"); } catch { return []; }
}

export async function saveDocs(items: DocItem[]): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireManager();
    await setConfigValue(KEY, JSON.stringify(items), `Trung tâm tài liệu — cập nhật bởi ${user.full_name}`);
    revalidatePath("/tai-lieu");
    return { ok: true };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}

export async function seedDocs(): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireManager();
    const cur = await getDocs();
    if (cur.length > 0) return { ok: false, error: "Đã có dữ liệu — không nạp đè" };
    const items: DocItem[] = DEFAULT_DOCS.map(d => ({ ...d, id: crypto.randomUUID() }));
    await setConfigValue(KEY, JSON.stringify(items), "Trung tâm tài liệu — nạp khung mẫu");
    revalidatePath("/tai-lieu");
    return { ok: true };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}

async function getDismissed(): Promise<string[]> {
  try { const a = JSON.parse((await getConfigValue(DISMISS_KEY)) || "[]"); return Array.isArray(a) ? a : []; } catch { return []; }
}

export async function getDistillProposals(): Promise<DistillProposal[]> {
  try {
    const user = await getCurrentUser();
    if (!user || !isManagerOrAbove(user.role)) return [];
    const [proposals, docs, dismissed] = await Promise.all([buildDistillProposals(), getDocs(), getDismissed()]);
    const haveTitles = new Set(docs.map(d => d.title.trim().toLowerCase()));
    const skip = new Set(dismissed);
    return proposals.filter(p => !skip.has(p.id) && !haveTitles.has(p.title.trim().toLowerCase()));
  } catch { return []; }
}

export async function approveProposal(p: DistillProposal): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireManager();
    const docs = await getDocs();
    if (docs.some(d => d.title.trim().toLowerCase() === p.title.trim().toLowerCase())) return { ok: false, error: "Đã có tài liệu cùng tên" };
    const doc: DocItem = {
      id: crypto.randomUUID(), category: p.category, title: p.title, body: p.body,
      owner: user.full_name, updated: new Date().toISOString().slice(0, 10),
      access: p.access, source: "distilled", note: `Đúc kết tự động từ ${p.sourceLabel}`,
    };
    await setConfigValue(KEY, JSON.stringify([...docs, doc]), `Duyệt SOP đúc kết "${p.title}" — ${user.full_name}`);
    revalidatePath("/tai-lieu");
    return { ok: true };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}

export async function dismissProposal(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireManager();
    const cur = await getDismissed();
    if (!cur.includes(id)) await setConfigValue(DISMISS_KEY, JSON.stringify([...cur, id].slice(-200)), "Đề xuất đúc kết bị bỏ qua");
    revalidatePath("/tai-lieu");
    return { ok: true };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}
