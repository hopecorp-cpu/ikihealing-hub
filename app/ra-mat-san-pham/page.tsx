import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { PageHeader } from "@/components/ui/kit";
import { Rocket } from "lucide-react";
import { isManagerOrAbove } from "@/lib/auth";
import { layPhieu } from "@/lib/ra-mat-san-pham";
import Client from "./Client";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sb = getServiceClient();
  const [phieu, { data: users }] = await Promise.all([
    layPhieu(),
    sb.from("users").select("full_name").eq("active", true).not("full_name", "is", null).order("full_name"),
  ]);
  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <PageHeader title={t("Ra mắt sản phẩm mới")} subtitle={t("Mẫu về là mở phiếu — máy đẻ việc cho từng phòng và tự đo 7 ngày đầu")} icon={Rocket} iconColor="#F59E0B" />
      <Client phieu={phieu} nhanSu={(users || []).map((u: any) => u.full_name)} laQuanLy={isManagerOrAbove((user as any).role)} />
    </div>
  );
}
