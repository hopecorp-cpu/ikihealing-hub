import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { listOffers } from "./actions";
import Client from "./Client";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Kết cấu bán hàng | ACME Ops Hub") };
}

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove(user.role)) redirect("/dashboard");
  const { offers, fromConfig, eco } = await listOffers();
  return <Client offers={offers} fromConfig={fromConfig} eco={eco} />;
}
