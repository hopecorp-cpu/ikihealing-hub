"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { loadApps, saveApps, DEFAULT_APPS, type AiApp } from "@/lib/ai-apps";
import { setConfigValue } from "@/lib/app-config";
import { revalidatePath } from "next/cache";

async function guard(): Promise<{ ok: boolean; error?: string }> {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập" };
  const sb = getServiceClient();
  const { data: me } = await sb.from("users").select("role").eq("id", user.id).maybeSingle();
  if (!me || !isManagerOrAbove((me as any).role)) return { ok: false, error: "Chỉ quản lý trở lên mới sửa được kho app" };
  return { ok: true };
}

export async function saveAppAction(app: AiApp): Promise<{ ok: boolean; error?: string }> {
  const g = await guard(); if (!g.ok) return g;
  if (!app.code?.trim() || !app.ten?.trim() || !app.system?.trim()) return { ok: false, error: "Thiếu mã, tên hoặc bộ hướng dẫn" };
  const apps = await loadApps();
  const i = apps.findIndex((a) => a.code === app.code);
  const clean: AiApp = {
    ...app,
    code: app.code.trim().toUpperCase().replace(/\s+/g, "-"),
    goi_y: (app.goi_y || []).map((s) => s.trim()).filter(Boolean).slice(0, 5),
  };
  if (i >= 0) apps[i] = clean; else apps.push(clean);
  await saveApps(apps);
  revalidatePath("/quan-tri-app-ai"); revalidatePath("/kho-app-ai");
  return { ok: true };
}

export async function deleteAppAction(code: string): Promise<{ ok: boolean; error?: string }> {
  const g = await guard(); if (!g.ok) return g;
  const apps = (await loadApps()).filter((a) => a.code !== code);
  await saveApps(apps);
  revalidatePath("/quan-tri-app-ai"); revalidatePath("/kho-app-ai");
  return { ok: true };
}

export async function resetAppsAction(): Promise<{ ok: boolean; error?: string }> {
  const g = await guard(); if (!g.ok) return g;
  await saveApps(DEFAULT_APPS);
  revalidatePath("/quan-tri-app-ai"); revalidatePath("/kho-app-ai");
  return { ok: true };
}

export async function saveCeilingAction(vnd: number): Promise<{ ok: boolean; error?: string }> {
  const g = await guard(); if (!g.ok) return g;
  await setConfigValue("ai_cost_ceiling", String(Math.max(0, Math.round(vnd))), "Trần chi phí AI mỗi tháng (đồng) — vượt thì máy kêu");
  revalidatePath("/quan-tri-app-ai"); revalidatePath("/nhat-ky-ai");
  return { ok: true };
}
