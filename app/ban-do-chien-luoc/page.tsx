import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { computeStrategyMap, STRATEGY_MAP } from "@/lib/strategy-map";
import { getConfigNumber } from "@/lib/app-config";
import StrategyMapClient from "./StrategyMapClient";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Bản đồ chiến lược | IKIHEALING Hub") };
}

export default async function Page() {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const canEdit = isManagerOrAbove(user.role);

  const data = await computeStrategyMap();
  const fixedCost = await getConfigNumber("monthly_fixed_cost", 0);

  return <StrategyMapClient data={data} intro={t(STRATEGY_MAP.intro)} canEdit={canEdit} fixedCost={fixedCost} />;
}
