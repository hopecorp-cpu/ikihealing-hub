"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/supabase-server";
import { isAdmin, isManagerOrAbove } from "@/lib/auth";
import { datDungKhanCap } from "@/lib/dung-khan-cap";
import { NHOM_DUNG, type NhomDung } from "@/lib/dung-khan-cap-core";
import { sendTelegram, tgEscape } from "@/lib/telegram";

export async function bamDungKhanCap(nhom: NhomDung, dung: boolean, lyDo: string): Promise<{ ok: boolean; error?: string }> {
  const u = await getCurrentUser();
  if (!u) return { ok: false, error: "Chưa đăng nhập" };
  if (!NHOM_DUNG.some((n) => n.ma === nhom)) return { ok: false, error: "Nhóm không hợp lệ" };
  if (dung && !isManagerOrAbove(u.role)) return { ok: false, error: "Chỉ quản lý trở lên được bấm dừng" };
  if (!dung && !isAdmin(u.role)) return { ok: false, error: "Chỉ CEO/admin được mở lại" };
  const ly = String(lyDo || "").trim().slice(0, 300);
  if (ly.length < 5) return { ok: false, error: "Ghi lý do (ít nhất 5 ký tự) để người sau biết vì sao" };

  const boi = (u as any).full_name || u.email || "?";
  try {
    await datDungKhanCap({ nhom, dung, boi, lyDo: ly });
  } catch (e: any) {
    return { ok: false, error: `Không ghi được công tắc: ${e?.message || e}` };
  }
  const ten = NHOM_DUNG.find((n) => n.ma === nhom)?.ten || nhom;

  await sendTelegram(`<b>${dung ? "DỪNG KHẨN CẤP" : "MỞ LẠI"}: ${tgEscape(ten)}</b>\nBởi: ${tgEscape(boi)}\nLý do: ${tgEscape(ly)}`)
    .catch((e: any) => console.error("[hop-duyet] không báo được CEO:", e?.message || e));
  revalidatePath("/", "layout");
  return { ok: true };
}
