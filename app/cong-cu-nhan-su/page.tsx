import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { PageHeader } from "@/components/ui/kit";
import { UserSearch } from "lucide-react";
import Client from "./Client";

export const dynamic = "force-dynamic";

export default async function CongCuNhanSuPage() {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!["admin", "ceo", "manager"].includes(user.role)) redirect("/");

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <PageHeader
        title={t("Công cụ tham khảo nhân sự")}
        subtitle={t("Bốn nhóm tính cách và thần số học — để hiểu nhau và chọn cách nói, không phải để chấm điểm người")}
        icon={UserSearch}
        iconColor="#8B5CF6"
      />
      <Client />
    </div>
  );
}
