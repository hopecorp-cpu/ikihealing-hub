"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { docCuaHang, ghiCuaHang, type SanPhamShop } from "@/lib/cua-hang";
import { dongBoPinterest } from "@/lib/pinterest-feed";

async function canQuyen() {
  const user: any = await getCurrentUser();
  if (!user || !isManagerOrAbove(user.role)) throw new Error("Không có quyền sửa cửa hàng");
  return user;
}

async function ghiLichSu(ai: string, truoc: SanPhamShop[], sau: SanPhamShop[]) {
  const cu = new Map(truoc.map((p) => [p.n, p]));
  const doi: string[] = [];
  for (const p of sau) {
    const c = cu.get(p.n);
    if (!c) { doi.push(`thêm "${p.n}"`); continue; }
    if (c.price !== p.price) doi.push(`giá "${p.n}" ${c.price} -> ${p.price}`);
    if (!!c.an !== !!p.an) doi.push(`${p.an ? "ẩn" : "hiện"} "${p.n}"`);
    if ((c.trangThai || "") !== (p.trangThai || "")) doi.push(`trạng thái "${p.n}" ${c.trangThai || "đang bán"} -> ${p.trangThai || "đang bán"}`);
    if (!!c.het_hang !== !!p.het_hang) doi.push(`${p.het_hang ? "hết hàng" : "còn hàng"} "${p.n}"`);
    cu.delete(p.n);
  }
  for (const n of cu.keys()) doi.push(`xoá "${n}"`);
  let so: any[] = [];
  try { so = JSON.parse((await getConfigValue("shop_san_pham_lich_su")) || "[]"); } catch {}
  so.unshift({ luc: new Date().toISOString(), ai, doi: doi.length ? doi : ["sửa chữ/ảnh/thứ tự"] });
  await setConfigValue("shop_san_pham_lich_su", JSON.stringify(so.slice(0, 50)));
}

export async function luuCuaHang(ds: SanPhamShop[]) {
  const user = await canQuyen();
  const truoc = await docCuaHang();
  const kq = await ghiCuaHang(ds);
  if (!kq.ok) return kq;
  await ghiLichSu(user.full_name || user.email || "?", truoc, ds);
  revalidatePath("/admin/cua-hang");

  let pinterest = "";
  try { pinterest = await dongBoPinterest(); } catch (e: any) { pinterest = "Pinterest: đẩy feed LỖI (" + (e?.message || e) + ") — web vẫn đã đổi"; }
  return { ...kq, pinterest };
}

export async function napTuWeb(): Promise<{ ok: boolean; loi: string[]; so?: number }> {
  await canQuyen();
  if ((await docCuaHang()).length) return { ok: false, loi: ["Đã có danh sách — không nạp đè"] };
  const html = await fetch("https://example.com/shop/", { cache: "no-store" }).then((r) => r.text());
  const m = html.match(/const PRODUCTS=(\[[\s\S]*?\]);<\/script>/);
  if (!m) return { ok: false, loi: ["Không tìm thấy danh sách sản phẩm trong trang /shop"] };
  const ds: SanPhamShop[] = JSON.parse(m[1]);

  for (const p of ds) if (p.cat === "dam" && !p.qua) p.qua = "Tặng bình lắc NOVA + cẩm nang thực đơn 21 ngày. Quà thật, không quy đổi.";
  const kq = await ghiCuaHang(ds);
  revalidatePath("/admin/cua-hang");
  return { ...kq, so: ds.length };
}
