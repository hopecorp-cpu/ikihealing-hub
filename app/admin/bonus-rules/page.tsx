import { requireAdmin } from "@/lib/auth-server";
import { getServiceClient } from "@/lib/supabase-server";
import { BonusRulesClient } from "./client";

export const dynamic = "force-dynamic";

export default async function BonusRulesPage() {
  await requireAdmin();
  const sb = getServiceClient();
  const { data: rules } = await sb.from("bonus_rules").select("*").order("priority", { ascending: false });
  return <BonusRulesClient rules={rules ?? []} />;
}
