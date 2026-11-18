import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { getChannelPolicy, marginRefPct } from "@/lib/channel-policy";
import { bangGiaV4, choCeoChot } from "@/lib/gia-v4";
import { bienGopPct } from "@/lib/gia-v4-von";
import PolicyClient from "./PolicyClient";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Chính sách kênh | IKIHEALING Hub") };
}

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove(user.role)) redirect("/?denied=chinh-sach-kenh");

  const [policy, ref] = await Promise.all([getChannelPolicy(), marginRefPct()]);

  const bangV4 = bangGiaV4();
  const bienV4 = bangV4.map((d) => (d.ma && d.gia != null && d.kenh !== "B2B quà tặng" ? bienGopPct(d.ma, d.gia) : null));
  return <PolicyClient policy={policy} refMargin={ref?.pct ?? null} bangV4={bangV4} bienV4={bienV4} choCeo={choCeoChot()} />;
}
