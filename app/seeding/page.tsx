import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove, isSalePosition, isMktPosition } from "@/lib/auth";
import { vnDateStr } from "@/lib/payroll";
import seeding from "@/data/seeding-plan.json";
import SeedingGuide from "./SeedingGuide";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Cẩm nang Seeding đa kênh | ACME Ops Hub") };
}

export default async function SeedingPage({ searchParams }: { searchParams: { d?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const ok = user.role === "admin" || user.role === "ceo" || isManagerOrAbove(user.role)
    || isSalePosition((user as any).position) || isMktPosition((user as any).position);
  if (!ok) redirect("/");

  const sb = getServiceClient();
  const date = searchParams.d || vnDateStr();
  const [{ data: users }, tasksRes] = await Promise.all([
    sb.from("users").select("full_name,position").eq("active", true),
    sb.from("seeding_tasks").select("*").eq("task_date", date),
  ]);

  const staff = (users ?? []).filter((u: any) => isSalePosition(u.position) || isMktPosition(u.position)).map((u: any) => u.full_name).filter(Boolean);
  const tasks = tasksRes.error ? [] : (tasksRes.data ?? []);

  return <SeedingGuide data={seeding as any} date={date} staff={staff} tasks={tasks} />;
}
