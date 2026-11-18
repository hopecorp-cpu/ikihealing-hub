import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { vnDateStr } from "@/lib/payroll";
import { summarizeLegal } from "@/lib/legal-register";
import { getLegalRegister } from "./actions";
import PhapCheClient from "./PhapCheClient";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Sổ pháp chế | ACME Ops Hub") };
}

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove(user.role)) redirect("/?denied=phap-che");

  const items = await getLegalRegister();
  const today = vnDateStr();
  const summary = summarizeLegal(items, today);

  return <PhapCheClient items={items} today={today} summary={summary} />;
}
