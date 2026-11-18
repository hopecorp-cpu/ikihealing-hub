import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove, isMktPosition } from "@/lib/auth";
import { getContentPlan } from "@/lib/content-plan-server";
import PlanClient from "./PlanClient";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Tuyến bài | ACME Ops Hub") };
}

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const canEdit = isManagerOrAbove(user.role) || isMktPosition((user as any).position);
  if (!canEdit) redirect("/?denied=tuyen-bai");

  const plan = await getContentPlan();
  return <PlanClient plan={plan} />;
}
