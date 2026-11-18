import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n-server";
import { getCurrentUser } from "@/lib/supabase-server";
import { GIONG } from "@/lib/tro-ly-giong";
import { GIONG_LIVE } from "@/lib/gemini-live";
import GiongClient from "./GiongClient";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Nói chuyện với Trợ lý AI") };
}

export default async function TroLyGiongPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ceo" && user.role !== "admin") redirect("/?denied=ceo");
  return <GiongClient giong={GIONG.map((g) => ({ ...g }))} coElevenLabs={!!(process.env.ELEVENLABS_API_KEY || "").trim()} giongLive={GIONG_LIVE.map((g) => ({ ...g }))} />;
}
