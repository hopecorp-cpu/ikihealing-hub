import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { vnDateStr } from "@/lib/payroll";
import { isSalePosition, isManagerOrAbove } from "@/lib/auth";
import { norm } from "@/lib/sale-metrics";
import { computeRevenueLoop } from "@/lib/revenue-loop";
import { LoopClient } from "./LoopClient";

export const dynamic = "force-dynamic";

export default async function VongLapDoanhThuPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isAdmin = user.role === "admin" || user.role === "ceo";
  const isManager = isManagerOrAbove(user.role);
  const isSale = isSalePosition((user as any).position);
  if (!isAdmin && !isManager && !isSale) redirect("/");

  const month = vnDateStr().slice(0, 7);
  const data = await computeRevenueLoop(month);

  const canSeeAll = isAdmin || isManager;
  const meKey = norm(user.full_name);
  const view = canSeeAll ? data : { ...data, sales: data.sales.filter(s => norm(s.name) === meKey) };

  return <LoopClient data={view} canSeeAll={canSeeAll} canEdit={isAdmin} />;
}
