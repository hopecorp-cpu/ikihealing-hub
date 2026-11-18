import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import closer from "@/data/closer-script.json";
import { getCloserCustom } from "./actions";
import CloserClient from "./CloserClient";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Kịch bản CLOSER | IKIHEALING Hub") };
}

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const canEdit = isManagerOrAbove(user.role);

  const sb = getServiceClient();
  let products: { name: string; category: string; unit_price: number }[] = [];
  try {
    const { data } = await sb.from("products").select("name, category, unit_price").eq("active", true).order("category").order("unit_price", { ascending: false });
    products = data || [];
  } catch { }
  const custom = await getCloserCustom();

  return <CloserClient data={closer as any} products={products} custom={custom} canEdit={canEdit} />;
}
