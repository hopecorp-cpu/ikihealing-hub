import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { getDepartmentsWithMembers } from "./actions";
import { PhongBanClient } from "./client";
import { Building2 } from "lucide-react";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function PhongBanPage() {
  const { t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin" && user.role !== "ceo") redirect("/");

  const data = await getDepartmentsWithMembers();

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Building2 className="w-6 h-6 text-brand-600" /> {t("Phòng ban")}
      </h1>
      <PhongBanClient {...data} />
    </div>
  );
}
