"use server";
import { guardManager } from "@/lib/role-guard";
import { revalidatePath } from "next/cache";

export async function createConcept(input: {
  name: string;
  dna_pain: string;
  dna_value: string;
  dna_trigger: string;
  dna_viral: string;
  dna_scale: string;
  dna_design: string;
  description?: string;
  target_revenue?: number;
}) {
  const g = await guardManager();
  if (!g.ok) return { success: false, error: g.error };
  const { data, error } = await g.sb.from("product_concepts").insert({
    created_by: g.userId,
    ...input,
    status: "idea"
  }).select().single();
  if (error) return { success: false, error: error.message };
  revalidatePath("/insights/products");
  return { success: true, concept: data };
}

export async function listConcepts(filter: "all" | "mine" | "top" = "all") {
  const g = await guardManager();
  if (!g.ok) return [];
  let q = g.sb.from("product_concepts").select("*, users!product_concepts_created_by_fkey(full_name)");
  if (filter === "mine") q = q.eq("created_by", g.userId);
  if (filter === "top") q = q.order("avg_score", { ascending: false, nullsFirst: false });
  else q = q.order("created_at", { ascending: false });
  const { data } = await q.limit(50);
  return data ?? [];
}

export async function voteConcept(conceptId: string, score: number, comment: string) {
  const g = await guardManager();
  if (!g.ok) return { success: false, error: g.error };
  const { error } = await g.sb.from("concept_votes").upsert({
    concept_id: conceptId,
    voter_id: g.userId,
    score,
    comment
  }, { onConflict: "concept_id,voter_id" });
  if (error) return { success: false, error: error.message };
  revalidatePath("/insights/products");
  return { success: true };
}

export async function getMyVote(conceptId: string) {
  const g = await guardManager();
  if (!g.ok) return null;
  const { data } = await g.sb.from("concept_votes").select("*").eq("concept_id", conceptId).eq("voter_id", g.userId).maybeSingle();
  return data;
}

export async function updateConceptStatus(id: string, status: string) {
  const g = await guardManager();
  if (!g.ok) return { success: false, error: g.error };
  const { error } = await g.sb.from("product_concepts").update({ status }).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/insights/products");
  return { success: true };
}
