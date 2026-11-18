import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { loadApps } from "@/lib/ai-apps";
import { getConfigNumber } from "@/lib/app-config";
import AdminAppsClient from "./AdminAppsClient";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Quản trị app AI | ACME Ops Hub") };
}

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove(user.role)) redirect("/kho-app-ai");

  const [apps, ceiling] = await Promise.all([
    loadApps().catch(() => []),
    getConfigNumber("ai_cost_ceiling", 0).catch(() => 0),
  ]);

  return <AdminAppsClient apps={apps} ceiling={ceiling} />;
}
