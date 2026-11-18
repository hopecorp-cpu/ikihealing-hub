import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { getDocs, getDistillProposals } from "./actions";
import DocClient from "./DocClient";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Trung tâm tài liệu | ACME Ops Hub") };
}

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const canEdit = isManagerOrAbove(user.role);
  const [docs, proposals] = await Promise.all([getDocs(), canEdit ? getDistillProposals() : Promise.resolve([])]);
  return <DocClient docs={docs} canEdit={canEdit} proposals={proposals} />;
}
