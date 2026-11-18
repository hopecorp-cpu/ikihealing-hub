import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { boChienDich } from "@/lib/bo-chien-dich";
import { listDepartmentsWithMembers } from "../tasks/actions";
import Client from "./client";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Bổ chiến dịch | IKIHEALING Hub") };
}

function thangNay() {
  const d = new Date(Date.now() + 7 * 3600e3);
  return d.toISOString().slice(0, 7);
}

export default async function Page({ searchParams }: { searchParams: { mucTieu?: string; thang?: string; ten?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove(user.role)) redirect("/?denied=bo-chien-dich");

  const mucTieu = Number(searchParams.mucTieu) || 0;
  const thang = /^\d{4}-\d{2}$/.test(searchParams.thang || "") ? searchParams.thang! : thangNay();

  const [ban, phongBan] = await Promise.all([
    mucTieu > 0 ? boChienDich(mucTieu, thang, searchParams.ten) : Promise.resolve(null),
    listDepartmentsWithMembers(),
  ]);

  return <Client ban={ban} phongBan={phongBan} mucTieu={mucTieu} thang={thang} />;
}
