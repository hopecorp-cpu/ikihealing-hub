import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { layNick } from "@/lib/hop-thu-zalo-server";
import { ZaloThanhTren } from "../ZaloMobile";
import KetNoiClient from "./KetNoiClient";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Kết nối Zalo | Zalo CRM") };
}

export default async function KetNoiPage() {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const quanLy = user.role === "admin" || user.role === "ceo" || isManagerOrAbove(user.role);
  const nick = await layNick();
  return (
    <div className="flex h-full flex-col">
      <ZaloThanhTren tieuDe={t("Kết nối Zalo")} />
      <KetNoiClient quanLy={quanLy} nick={nick.map((n) => ({ ownId: n.ownId, sale: n.sale, tenZalo: n.tenZalo, song: n.song, status: n.status }))} />
    </div>
  );
}
