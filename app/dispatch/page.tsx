import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove, isMktPosition } from "@/lib/auth";
import { getBriefs } from "@/lib/dispatch";
import { getFails } from "@/lib/campaign-memory";
import DispatchClient from "./DispatchClient";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Dispatch — Hub điều phối | IKIHEALING Hub") };
}

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove(user.role) && !isMktPosition((user as any).position)) redirect("/?denied=dispatch");
  const [briefs, fails] = await Promise.all([getBriefs(), getFails()]);
  return <DispatchClient briefs={briefs} fails={fails} />;
}
