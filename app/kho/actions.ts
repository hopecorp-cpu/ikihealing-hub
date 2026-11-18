"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { ghiDotNhap, khaiMocTon } from "@/lib/kho-noi-bo";
import { vnDateStr } from "@/lib/payroll";

async function nguoiGhiSo() {
  const u = await getCurrentUser();
  if (!u) return null;
  if (!isManagerOrAbove(u.role) && !/kho|warehouse|hỗ trợ/i.test(u.position || "")) return null;
  return u;
}

function docDong(raw: string): { items: { name: string; qty: number }[]; loi?: string } {
  const items: { name: string; qty: number }[] = [];
  for (const [i, dong] of raw.split("\n").map(s => s.trim()).entries()) {
    if (!dong) continue;
    const m = dong.split(/[|\t]/).map(s => s.trim());
    const qty = Number((m[1] || "").replace(/[.,\s]/g, ""));
    if (m.length < 2 || !m[0] || !Number.isFinite(qty)) return { items, loi: `Dòng ${i + 1} không đọc được ("${dong.slice(0, 40)}") — cần dạng: Tên hàng | số lượng` };
    items.push({ name: m[0], qty });
  }
  if (!items.length) return { items, loi: "Chưa có dòng nào." };
  return { items };
}

export async function ghiNhapKhoAction(_prev: any, form: FormData) {
  const u = await nguoiGhiSo();
  if (!u) return { loi: "Không có quyền ghi sổ kho." };
  const { items, loi } = docDong(String(form.get("dong") || ""));
  if (loi) return { loi };
  const ngay = String(form.get("ngay") || "") || vnDateStr();
  await ghiDotNhap(getServiceClient(), { ngay, ghiChu: `${u.full_name} ghi`, items });
  revalidatePath("/kho");
  return { ok: `Đã ghi đợt nhập ${ngay}: ${items.length} mã, ${items.reduce((s, x) => s + x.qty, 0)} sp.` };
}

export async function khaiMocTonAction(_prev: any, form: FormData) {
  const u = await nguoiGhiSo();
  if (!u) return { loi: "Không có quyền ghi sổ kho." };
  if (!isManagerOrAbove(u.role)) return { loi: "Khai mốc kiểm kho (đè toàn bộ sổ) chỉ dành cho quản lý." };
  const { items, loi } = docDong(String(form.get("dong") || ""));
  if (loi) return { loi };
  await khaiMocTon(getServiceClient(), items, `kiểm kho thật, ${u.full_name} khai ${vnDateStr()}`);
  revalidatePath("/kho");
  return { ok: `Đã khai mốc mới ${items.length} mã — sổ tự trừ tính lại từ hôm nay.` };
}
