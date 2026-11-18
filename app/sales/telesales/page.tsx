import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove, isSalePosition } from "@/lib/auth";
import { vnDateStr } from "@/lib/payroll";
import playbook from "@/data/telesales-playbook.json";
import TelesalesPlaybook from "./TelesalesPlaybook";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Kịch bản Telesales | IKIHEALING Hub") };
}

export default async function TelesalesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const ok = user.role === "admin" || user.role === "ceo" || isManagerOrAbove(user.role) || isSalePosition((user as any).position);
  if (!ok) redirect("/");

  let leads: any[] = [];
  try {
    const sb = getServiceClient();
    const today = vnDateStr();
    const ident = (user.email || user.full_name || "").trim();
    const { data } = await sb.from("customer_care_log")
      .select("customer_phone,customer_name,sale_name,flow_type,current_day,last_contact,next_due,status,note,updated_at")
      .eq("updated_by", ident).eq("last_contact", today)
      .order("updated_at", { ascending: false }).limit(200);
    leads = data || [];
  } catch { }

  return <TelesalesPlaybook data={playbook as any} saleName={user.full_name || ""} initialLeads={leads} />;
}
