import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { PageHeader } from "@/components/ui/kit";
import { Store } from "lucide-react";
import { isManagerOrAbove, isAccountantPosition } from "@/lib/auth";
import Client from "./Client";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove((user as any).role) && !isAccountantPosition((user as any).position)) redirect("/");
  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <PageHeader title={t("Đối soát sàn Shopee / TikTok")} subtitle={t("Thả file xuất từ sàn — máy ra ba cột và danh sách lệch đích danh mã đơn")} icon={Store} iconColor="#EE4D2D" />
      <Client />
    </div>
  );
}
