"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập");
  const sb = getServiceClient();
  const { data: profile } = await sb.from("users").select("role").eq("id", user.id).maybeSingle();
  if (!profile || (profile.role !== "admin" && profile.role !== "ceo")) throw new Error("Không có quyền");
  return { sb };
}

export async function updateProduct(input: { id: string; cost_price?: number; unit_price?: number; supplier?: string; notes?: string; active?: boolean }) {
  const { sb } = await requireAdmin();
  const { id, ...patch } = input;
  const { error } = await sb.from("products").update(patch).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/products");
  return { success: true };
}

export async function seedProductsFromExcel() {
  const { sb } = await requireAdmin();

  const products = [
    { sku: "SP-A-001", name: "Sản phẩm A", category: "Nhóm mẫu 1", qty: 10, dt: 2_000_000, giaNhap: 100_000, giaVon: 1_000_000 },
    { sku: "SP-B-001", name: "Sản phẩm B", category: "Nhóm mẫu 1", qty: 10, dt: 1_000_000, giaNhap: 50_000, giaVon: 500_000 },
    { sku: "SP-C-001", name: "Sản phẩm C", category: "Nhóm mẫu 2", qty: 5, dt: 1_000_000, giaNhap: 0, giaVon: 0 }
  ];

  const { data: existing } = await sb.from("products").select("id,sku");
  const existingMap = new Map((existing ?? []).map((p: any) => [p.sku, p.id]));

  let inserted = 0, updated = 0;
  for (const p of products) {
    const unit_price = p.qty > 0 ? Math.round(p.dt / p.qty) : 0;
    const cost_price = p.qty > 0 && p.giaVon > 0 ? Math.round(p.giaVon / p.qty) : p.giaNhap;
    const data = {
      sku: p.sku, name: p.name, category: p.category,
      unit_price, cost_price, vat_rate: 0.08, active: true,
      notes: `Dữ liệu mẫu: ${p.qty} cái · DT ${new Intl.NumberFormat("vi-VN").format(p.dt)}đ`
    };
    if (existingMap.has(p.sku)) {
      await sb.from("products").update(data).eq("id", existingMap.get(p.sku));
      updated++;
    } else {
      const { error } = await sb.from("products").insert(data);
      if (!error) inserted++;
    }
  }

  revalidatePath("/admin/products");
  return { success: true, inserted, updated };
}
