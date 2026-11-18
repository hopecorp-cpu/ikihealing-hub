"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { guardManager } from "@/lib/role-guard";
import { generateSalesScript } from "@/lib/insights";
import { revalidatePath } from "next/cache";

export async function createCustomerInsight(input: {
  customer_name: string;
  customer_phone?: string;
  customer_source?: string;
  product_interested?: string;
  pain_keywords: string[];
  identity_keywords: string[];
  perception_keywords: string[];
  showoff_keywords: string[];
  community_keywords: string[];
  speed_keywords: string[];
  custom_notes?: string;
}) {
  const g = await guardManager();
  if (!g.ok) return { success: false, error: g.error };
  const { userId: user_id, sb } = g;
  const user = { id: user_id };

  const script = generateSalesScript({
    customer_name: input.customer_name,
    product_interested: input.product_interested || "Đạm Mẫu",
    pain: input.pain_keywords,
    identity: input.identity_keywords,
    perception: input.perception_keywords,
    showoff: input.showoff_keywords,
    community: input.community_keywords,
    speed: input.speed_keywords
  });

  const { data, error } = await sb.from("customer_insights").insert({
    sale_id: user.id,
    customer_name: input.customer_name,
    customer_phone: input.customer_phone || null,
    customer_source: input.customer_source || null,
    product_interested: input.product_interested || null,
    pain_keywords: input.pain_keywords,
    identity_keywords: input.identity_keywords,
    perception_keywords: input.perception_keywords,
    showoff_keywords: input.showoff_keywords,
    community_keywords: input.community_keywords,
    speed_keywords: input.speed_keywords,
    custom_notes: input.custom_notes || null,
    generated_script: script,
    status: "lead"
  }).select().single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/insights/customer");
  return { success: true, insight: data, script };
}

export async function getMyCustomerInsights() {
  const g = await guardManager();
  if (!g.ok) return [];
  const { data } = await g.sb.from("customer_insights").select("*").eq("sale_id", g.userId).order("created_at", { ascending: false });
  return data ?? [];
}

export async function updateInsightStatus(id: string, status: string) {
  const g = await guardManager();
  if (!g.ok) return { success: false, error: g.error };
  const { error } = await g.sb.from("customer_insights").update({ status, updated_at: new Date().toISOString() }).eq("id", id).eq("sale_id", g.userId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/insights/customer");
  return { success: true };
}
