"use server";
import { revalidatePath } from "next/cache";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { moPhieu, doiTrangThai, doTatCa, type PhieuRaMat } from "@/lib/ra-mat-san-pham";

async function quanLy() {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return null;
  const sb = getServiceClient();
  const { data: u } = await sb.from("users").select("id, role, full_name").eq("id", user.id).maybeSingle();
  return u && isManagerOrAbove(u.role) ? u : null;
}

export async function taoPhieu(input: { ma: string; ten: string; sku?: string; ngayRaMat: string; moTa?: string; phuTrach: PhieuRaMat["phuTrach"] }) {
  const u = await quanLy();
  if (!u) return { ok: false as const, error: "Chỉ quản lý mới mở phiếu ra mắt" };
  if (!input.ten.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(input.ngayRaMat)) return { ok: false as const, error: "Thiếu tên hoặc ngày ra mắt" };
  const ma = (input.sku || input.ma || input.ten).trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const sb = getServiceClient();
  const r = await moPhieu(sb, { ...input, ma, ten: input.ten.trim() }, u.full_name);
  revalidatePath("/ra-mat-san-pham"); revalidatePath("/tasks");
  return { ok: true as const, ma, viec: r.viec };
}

export async function doiTrangThaiPhieu(ma: string, trangThai: PhieuRaMat["trangThai"]) {
  const u = await quanLy();
  if (!u) return { ok: false as const, error: "Chỉ quản lý" };
  await doiTrangThai(getServiceClient(), ma, trangThai);
  revalidatePath("/ra-mat-san-pham"); revalidatePath("/tasks");
  return { ok: true as const };
}

export async function doNgay() {
  const u = await quanLy();
  if (!u) return { ok: false as const, error: "Chỉ quản lý" };
  const r = await doTatCa(getServiceClient());
  revalidatePath("/ra-mat-san-pham");
  return { ok: true as const, ...r };
}
