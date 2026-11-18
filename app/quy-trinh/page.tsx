import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { getSopLibrary, SOP_INTRO } from "@/lib/sop";
import SopClient from "./SopClient";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Thư viện quy trình | ACME Ops Hub") };
}

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const canEdit = isManagerOrAbove(user.role);
  const { items, updatedAt } = await getSopLibrary();
  return <SopClient items={items} intro={SOP_INTRO} canEdit={canEdit} updatedAt={updatedAt} />;
}
