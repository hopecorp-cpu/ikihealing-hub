import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { getCosts, summarize } from "@/lib/platform-costs";
import { getT } from "@/lib/i18n-server";
import CostClient from "./CostClient";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Chi phí công cụ | IKIHEALING Hub") };
}

export default async function CostPage() {
  const { t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove(user.role)) redirect("/?denied=chiphi");

  const items = await getCosts();
  const sum = summarize(items);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">{t("Chi phí công cụ & nền tảng")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("Mỗi tháng công ty trả bao nhiêu cho các công cụ đang đấu nối. Danh sách dò từ hệ thống thật — ai biết số thì điền số.")}
        </p>
      </div>
      <CostClient items={items} sum={sum} canEdit={isManagerOrAbove(user.role)} />
    </div>
  );
}
