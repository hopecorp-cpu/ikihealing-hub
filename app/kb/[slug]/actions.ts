"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function ackArticle(articleId: string) {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { success: false, error: "Chưa đăng nhập" };

  const sb = getServiceClient();
  const { error } = await sb.from("kb_read_log").upsert({
    user_id: user.id,
    article_id: articleId,
    acknowledged: true
  }, { onConflict: "user_id,article_id" });
  if (error) return { success: false, error: error.message };
  revalidatePath("/kb");
  return { success: true };
}
