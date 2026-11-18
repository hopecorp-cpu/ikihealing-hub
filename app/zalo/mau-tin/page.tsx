import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { ZaloThanhTren } from "../ZaloMobile";
import MauTinClient from "./MauTinClient";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Mẫu tin nhanh | Zalo CRM") };
}

export default async function MauTinPage() {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const quanLy = user.role === "admin" || user.role === "ceo" || isManagerOrAbove(user.role);
  return (
    <div className="flex h-full flex-col">
      <ZaloThanhTren tieuDe={t("Mẫu tin nhanh")} />
      <MauTinClient quanLy={quanLy} />
    </div>
  );
}
