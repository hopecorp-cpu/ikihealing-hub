"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove, isMktPosition } from "@/lib/auth";
import { khungTuTuNgay, type MucBanTin } from "@/lib/ban-tin-tuan-core";
import { gomTuan, dungThu, luuNhap } from "@/lib/ban-tin-tuan";
import { revalidatePath } from "next/cache";

async function guard(): Promise<{ ok: boolean; error?: string; email?: string }> {
  const { data: { user } } = await getServerClient().auth.getUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập" };
  const { data: me } = await getServiceClient().from("users").select("role, position").eq("id", user.id).maybeSingle();
  if (!me || (!isManagerOrAbove((me as any).role) && !isMktPosition((me as any).position))) return { ok: false, error: "Chỉ quản lý hoặc phòng Marketing dùng được" };
  return { ok: true, email: user.email || "" };
}

export async function luuNhapAction(input: { tuNgay: string; mucIds: string[]; linkThem: string }): Promise<{ ok: boolean; error?: string }> {
  const g = await guard(); if (!g.ok) return { ok: false, error: g.error };
  const k = khungTuTuNgay(input.tuNgay);
  if (!k) return { ok: false, error: "Tuần không hợp lệ" };
  const gom = await gomTuan(k);
  const chon = new Set(input.mucIds);
  const muc = gom.muc.filter((m) => chon.has(m.id));
  const linkThem = String(input.linkThem || "").slice(0, 3000);
  if (!muc.length && !linkThem.trim()) return { ok: false, error: "Chưa chọn mục nào" };
  const b = dungThu(muc, linkThem, k.tuNgay, k.denNgay);
  const r = await luuNhap({ tuNgay: k.tuNgay, denNgay: k.denNgay, subject: b.subject, html: b.html, mucIds: muc.map((m) => m.id), linkThem, luc: new Date().toISOString(), nguoi: g.email || "" }, b.tuCam);
  if (r.ok) revalidatePath("/ban-tin-tuan");
  return r;
}

export async function xemTruocAction(input: { tuNgay: string; denNgay: string; muc: MucBanTin[]; linkThem: string }): Promise<{ ok: boolean; error?: string; subject?: string; html?: string; tuCam?: string[] }> {
  const g = await guard(); if (!g.ok) return { ok: false, error: g.error };
  const muc = (input.muc || []).slice(0, 40);
  const b = dungThu(muc, String(input.linkThem || "").slice(0, 3000), input.tuNgay, input.denNgay);
  return { ok: true, subject: b.subject, html: b.html.split("{{LINK_HUY}}").join("#"), tuCam: b.tuCam };
}
