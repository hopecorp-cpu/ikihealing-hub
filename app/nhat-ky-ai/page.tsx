import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { loadAppLog } from "@/lib/ai-apps";
import { monthCost } from "@/lib/covan/cost";
import LogClient from "./LogClient";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Nhật ký AI | IKIHEALING Hub") };
}

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove(user.role)) redirect("/kho-app-ai");

  const [log, cost] = await Promise.all([
    loadAppLog(200).catch(() => []),
    monthCost().catch(() => ({ vnd: 0, calls: 0, ceiling: 0, overPct: null })),
  ]);

  return <LogClient log={log} cost={cost} />;
}
