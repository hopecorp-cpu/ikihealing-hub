"use server";

import { getCurrentUser } from "@/lib/supabase-server";
import { isCskhPosition, isManagerOrAbove, isSalePosition } from "@/lib/auth";
import { handleInboundMessage, type KenhChat } from "@/lib/zalo-agent";
import type { YKhach } from "@/lib/doc-y-khach";

export type KetQuaThu = {
  ok: boolean; error?: string;
  reply?: string; hot?: boolean; medical?: boolean; flagged?: string[]; coSdt?: boolean;
  yKhach?: YKhach; handoffNote?: string; chanBoi?: string[]; ms?: number;
};

export async function thuBot(text: string, lichSu: { role: "user" | "assistant"; content: string }[], kenh: KenhChat): Promise<KetQuaThu> {
  const u = await getCurrentUser();
  if (!u) return { ok: false, error: "Chưa đăng nhập" };
  if (!isManagerOrAbove(u.role) && !isSalePosition((u as any).position) && !isCskhPosition((u as any).position)) {
    return { ok: false, error: "Chỉ quản lý, sale, CSKH dùng máy thử bot" };
  }
  const tin = String(text || "").trim().slice(0, 1000);
  if (!tin) return { ok: false, error: "Gõ một tin khách trước" };
  const ls = (Array.isArray(lichSu) ? lichSu : []).slice(-6)
    .filter((l) => l && (l.role === "user" || l.role === "assistant"))
    .map((l) => ({ role: l.role, content: String(l.content || "").slice(0, 500) }));
  const t0 = Date.now();
  try {
    const r = await handleInboundMessage(tin, ls, "", kenh === "facebook" ? "facebook" : "zalo");

    return { ok: true, reply: r.reply, hot: r.hot, medical: !!r.medical, flagged: r.flagged || [], coSdt: !!r.capturedPhone,
      yKhach: r.yKhach, handoffNote: r.handoffNote, chanBoi: r.chanBoi, ms: Date.now() - t0 };
  } catch (e: any) {
    return { ok: false, error: `Bộ não bot lỗi: ${String(e?.message || e).slice(0, 160)}` };
  }
}
