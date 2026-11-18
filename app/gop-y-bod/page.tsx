import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { coTheGhiNhanBaoCao, isBodRole, isManagerOrAbove } from "@/lib/auth";
import { REPORTS } from "@/lib/bod-feedback";
import { listFeedback } from "./actions";
import Client from "./Client";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Góp ý BOD | ACME Ops Hub") };
}

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const feedback = await listFeedback();
  const reports = isBodRole(user.role) ? REPORTS.filter((r) => r.key !== "luong-thuong") : REPORTS;
  return <Client reports={reports} feedback={feedback} canManage={isManagerOrAbove(user.role)} canGhiNhan={coTheGhiNhanBaoCao(user.role)} />;
}
