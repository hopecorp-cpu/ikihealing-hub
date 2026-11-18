import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { loadApps, loadAppLog } from "@/lib/ai-apps";
import { isManagerOrAbove } from "@/lib/auth";
import AppsClient from "./AppsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kho app AI | ACME Ops Hub" };

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const canSeeLog = isManagerOrAbove(user.role);

  const [apps, log] = await Promise.all([
    loadApps().catch(() => []),
    canSeeLog ? loadAppLog(30).catch(() => []) : Promise.resolve([]),
  ]);

  return <AppsClient apps={apps.filter((a) => a.status === "chot")} log={log} canSeeLog={canSeeLog} />;
}
