"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { MisaClient, mapMisaToAcmeOrder } from "@/lib/misa";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const auth = getServerClient();
  const { data: { user: authUser } } = await auth.auth.getUser();
  if (!authUser) throw new Error("Chưa đăng nhập");
  const sb = getServiceClient();
  const { data: profile } = await sb.from("users").select("role").eq("id", authUser.id).maybeSingle();
  if (!profile || (profile.role !== "admin" && profile.role !== "ceo")) {
    throw new Error("Không có quyền");
  }
  return { sb, adminId: authUser.id };
}

export async function syncMisaOrders(input: { days: number; defaultSaleId?: string }) {
  const { sb, adminId } = await requireAdmin();
  const client = new MisaClient();
  if (!client.isConfigured()) {
    return { success: false, error: "Chưa cấu hình MISA_APP_ID / MISA_APP_SECRET / MISA_SHOP_ID trong Vercel env" };
  }

  const to = new Date();
  const from = new Date(to.getTime() - input.days * 86400000);
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  const { data: log } = await sb.from("misa_sync_log").insert({
    sync_type: "orders",
    sync_from: from.toISOString(),
    sync_to: to.toISOString(),
    triggered_by: adminId,
    status: "running"
  }).select("id").single();

  try {
    const misaOrders = await client.getAllOrders(fromStr, toStr);

    const misaIds = misaOrders.map(m => m.id);
    const { data: existing } = await sb.from("orders").select("id, misa_id").in("misa_id", misaIds);
    const existingMap = new Map((existing ?? []).map((x: any) => [x.misa_id, x.id]));

    let inserted = 0, updated = 0;
    for (const m of misaOrders) {
      const row = mapMisaToAcmeOrder(m);
      if (existingMap.has(m.id)) {

        await sb.from("orders").update(row).eq("misa_id", m.id);
        updated++;
      } else {

        await sb.from("orders").insert({
          ...row,
          salesperson_id: input.defaultSaleId || null,
          counts_for_bonus: true
        });
        inserted++;
      }
    }

    await sb.from("misa_sync_log").update({
      records_synced: misaOrders.length,
      records_new: inserted,
      records_updated: updated,
      status: "success"
    }).eq("id", log!.id);

    revalidatePath("/admin/misa");
    revalidatePath("/sales");
    revalidatePath("/dashboard");
    return { success: true, total: misaOrders.length, inserted, updated };
  } catch (err: any) {
    await sb.from("misa_sync_log").update({
      status: "failed",
      error_message: err.message
    }).eq("id", log!.id);
    return { success: false, error: err.message };
  }
}

export async function syncMisaProducts() {
  const { sb, adminId } = await requireAdmin();
  const client = new MisaClient();
  if (!client.isConfigured()) return { success: false, error: "Chưa cấu hình MISA env" };

  const { data: log } = await sb.from("misa_sync_log").insert({
    sync_type: "products", triggered_by: adminId, status: "running"
  }).select("id").single();

  try {
    const misaProducts = await client.getProducts();
    const skus = misaProducts.map(p => p.sku).filter(Boolean);
    const { data: existing } = await sb.from("products").select("id, sku").in("sku", skus);
    const existingSet = new Set((existing ?? []).map((p: any) => p.sku));

    const toInsert = misaProducts.filter(p => p.sku && !existingSet.has(p.sku)).map(p => ({
      sku: p.sku,
      name: p.name,
      category: p.category,
      price: p.price,
      cost_price: p.cost,
      misa_id: p.id,
      active: true
    }));
    if (toInsert.length > 0) {
      await sb.from("products").insert(toInsert);
    }

    await sb.from("misa_sync_log").update({
      records_synced: misaProducts.length,
      records_new: toInsert.length,
      status: "success"
    }).eq("id", log!.id);
    return { success: true, total: misaProducts.length, inserted: toInsert.length };
  } catch (err: any) {
    await sb.from("misa_sync_log").update({ status: "failed", error_message: err.message }).eq("id", log!.id);
    return { success: false, error: err.message };
  }
}
