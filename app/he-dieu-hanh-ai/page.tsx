import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { buildAiMap, docPhongAi } from "@/lib/ai-map";
import { listViecMay, listChoDuyetMay, tomTatMay } from "@/lib/viec-may";
import { trangThaiLuong } from "@/lib/luong";
import MapClient from "./MapClient";
import PhongAiPanel from "./PhongAiPanel";
import DoLuongAiPanel from "./DoLuongAiPanel";
import { docDoLuongAi } from "@/lib/do-luong-ai";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Bản đồ Hệ điều hành AI | ACME Ops Hub") };
}

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove(user.role)) redirect("/?denied=he-dieu-hanh-ai");

  const [agents, nhatKy, choDuyet, tt, luong, phongAi, doLuong] = await Promise.all([
    buildAiMap(),
    listViecMay({ limit: 40 }),
    listChoDuyetMay(12),
    tomTatMay(1),
    trangThaiLuong(48),
    docPhongAi(),
    docDoLuongAi(),
  ]);

  return (
    <>
      <MapClient agents={agents} nhatKy={nhatKy as any} choDuyet={choDuyet as any} tomTat={tt} luong={luong} />
      <PhongAiPanel {...phongAi} />
      <DoLuongAiPanel {...doLuong} />
    </>
  );
}
