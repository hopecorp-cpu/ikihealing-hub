"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { capNhatXuLyDon, getQuizOrder, type XuLyDon } from "@/lib/payos";
import { ghiSoDonWeb, donWebDaCoTrongSo } from "@/lib/don-web";

const XU_LY: XuLyDon[] = ["moi", "da_xac_nhan", "dang_giao", "da_giao", "huy"];

async function canQuyen() {
  const user: any = await getCurrentUser();
  if (!user || !isManagerOrAbove(user.role)) throw new Error("Không có quyền xử lý đơn web");
  return user;
}

export async function luuXuLy(orderCode: number, patch: { xuLy?: XuLyDon; maVanDon?: string; ghiChuNoiBo?: string }) {
  const user = await canQuyen();
  if (patch.xuLy && !XU_LY.includes(patch.xuLy)) return { ok: false, loi: "Trạng thái không hợp lệ" };
  const o = await capNhatXuLyDon(orderCode, {
    xuLy: patch.xuLy,
    maVanDon: patch.maVanDon === undefined ? undefined : patch.maVanDon.trim().slice(0, 40),
    ghiChuNoiBo: patch.ghiChuNoiBo === undefined ? undefined : patch.ghiChuNoiBo.trim().slice(0, 500),
  }, user.full_name || user.email || "?");
  if (!o) return { ok: false, loi: "Không tìm thấy đơn " + orderCode };
  revalidatePath("/admin/don-web");
  return { ok: true, loi: "" };
}

export async function chotVaoSo(orderCode: number, lyDoGhiDe?: string) {
  const user = await canQuyen();
  const o = await getQuizOrder(orderCode);
  if (!o) return { ok: false, loi: "Không tìm thấy đơn" };
  if (o.xuLy === "huy") return { ok: false, loi: "Đơn đã huỷ, không ghi sổ" };
  if (o.status === "pending") return { ok: false, loi: "Đơn chuyển khoản chưa nhận tiền — chờ tiền về máy tự ghi" };
  const sb = getServiceClient();
  const co = await donWebDaCoTrongSo(sb, [o]);
  if (co[String(o.orderCode)]) return { ok: false, loi: "Sổ đã có đơn này (" + co[String(o.orderCode)] + ") — không ghi lần hai" };
  const r = await ghiSoDonWeb(sb, {
    orderCode: o.orderCode, name: o.name, phone: o.phone, address: o.address,
    product: o.product, pkg: o.pkg, qty: o.qty, amount: o.amount,
    kieuShip: o.status === "cod" ? "cod" : "ck_truoc",
    maCtv: o.maCtv,

    lyDoGhiDe: lyDoGhiDe || null,
    nguoi: user.full_name || user.email || "?",
  });
  if (!r.ghi) return { ok: false, loi: "Chưa ghi: " + (r.lyDo || "?"), canLyDo: !!r.canLyDo };
  await capNhatXuLyDon(orderCode, {}, user.full_name || user.email || "?");
  revalidatePath("/admin/don-web");
  return { ok: true, loi: "" };
}
