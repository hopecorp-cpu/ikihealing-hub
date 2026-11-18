"use server";

import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove, isMktPosition } from "@/lib/auth";
import { setCampaignStatus, adjustCampaignBudget, listCampaigns, type AdCampaign } from "@/lib/ads-control";

export type { AdCampaign };

async function guard(): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập" };
  if (!(isManagerOrAbove(user.role) || isMktPosition((user as any).position))) return { ok: false, error: "Không có quyền điều khiển quảng cáo" };
  return { ok: true };
}

export async function getAdCampaigns(): Promise<{ ok: boolean; campaigns?: AdCampaign[]; error?: string }> {
  const g = await guard(); if (!g.ok) return { ok: false, error: g.error };
  return listCampaigns();
}

export async function pauseAd(id: string): Promise<{ ok: boolean; error?: string }> {
  const g = await guard(); if (!g.ok) return { ok: false, error: g.error };
  return setCampaignStatus(id, "PAUSED");
}
export async function resumeAd(id: string): Promise<{ ok: boolean; error?: string }> {
  const g = await guard(); if (!g.ok) return { ok: false, error: g.error };
  return setCampaignStatus(id, "ACTIVE");
}
export async function bumpAd(id: string, pct: number): Promise<{ ok: boolean; newBudget?: number; oldBudget?: number; error?: string }> {
  const g = await guard(); if (!g.ok) return { ok: false, error: g.error };
  return adjustCampaignBudget(id, pct);
}
