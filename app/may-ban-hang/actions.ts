"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-server";
import { isManagerOrAbove } from "@/lib/auth";
import { getAutoReplyConfig, saveAutoReplyConfig, subscribePages, type AutoReplyConfig } from "@/lib/fb-autoreply";
import { getFlashDeal, saveFlashDeal, type FlashDeal } from "@/lib/flash-deal";

async function gate() {
  const user = await requireUser();
  if (!isManagerOrAbove(user.role)) throw new Error("Chỉ quản lý trở lên được đổi cấu hình này.");
  return user;
}

export async function saveAutoReply(input: {
  enabled: boolean;
  text: string;
  cooldownHours: number;
  buttons: { title: string; url: string }[];
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await gate();
    const cur = await getAutoReplyConfig();
    const next: AutoReplyConfig = {
      enabled: !!input.enabled,
      text: String(input.text || "").trim() || cur.text,
      cooldownHours: Number(input.cooldownHours) > 0 ? Number(input.cooldownHours) : cur.cooldownHours,
      buttons: (input.buttons || []).filter((b) => b.title?.trim() && /^https?:\/\//.test(b.url || "")).slice(0, 3),
    };
    await saveAutoReplyConfig(next);
    revalidatePath("/may-ban-hang");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export async function dangKyWebhookFanpage(): Promise<{ ok: boolean; rows?: { page: string; ok: boolean; error?: string }[]; error?: string }> {
  try {
    await gate();
    return { ok: true, rows: await subscribePages() };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export async function saveFlash(input: Partial<FlashDeal>): Promise<{ ok: boolean; error?: string }> {
  try {
    await gate();
    const cur = await getFlashDeal();
    const next: FlashDeal = {
      enabled: !!input.enabled,
      title: String(input.title ?? cur.title).trim(),
      gift: String(input.gift ?? cur.gift).trim(),
      note: String(input.note ?? cur.note).trim(),
      endsAt: String(input.endsAt ?? cur.endsAt),
      slots: Number(input.slots ?? cur.slots) || 0,

      claimed: input.claimed != null ? Number(input.claimed) || 0 : cur.claimed,
      ctaUrl: String(input.ctaUrl ?? cur.ctaUrl),
    };
    await saveFlashDeal(next);
    revalidatePath("/may-ban-hang");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}
