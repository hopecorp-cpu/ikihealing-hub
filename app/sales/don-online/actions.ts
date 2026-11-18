"use server";

import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { canProcessOnlineOrders } from "./access";

const VALID = ["pending", "confirmed", "shipping", "delivered", "cancelled", "refunded"];

export async function updateOnlineOrderStatus(orderId: string, status: string) {
  const user = await getCurrentUser();
  if (!canProcessOnlineOrders(user)) return { ok: false, error: "Không có quyền" };
  if (!VALID.includes(status)) return { ok: false, error: "Trạng thái không hợp lệ" };

  const sb = getServiceClient();
  const { error } = await sb.from("orders")
    .update({ status })
    .eq("id", orderId)
    .eq("source_platform", "salepage");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/sales/don-online");
  return { ok: true };
}
