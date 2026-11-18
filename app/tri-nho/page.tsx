import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { BrainCircuit } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase-server";
import { isAdmin, isManagerOrAbove } from "@/lib/auth";
import { PageHeader } from "@/components/ui/kit";
import { docDoThiTriNho } from "@/lib/do-thi-tri-nho";
import TriNhoClient from "./Client";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Đồ thị trí nhớ | ACME Ops Hub") };
}

export default async function Page() {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove(user.role)) redirect("/?denied=tri-nho");

  const doThi = await docDoThiTriNho({ laAdmin: isAdmin(user.role) });

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-[1500px]">
      <PageHeader icon={BrainCircuit} title={t("Đồ thị trí nhớ")}
        subtitle={t("Máy đang biết gì, nhớ gì, vừa làm gì, và mỗi thứ nối với agent nào. Đọc từ dữ liệu thật, không có nút vẽ tay.")} />
      <TriNhoClient {...doThi} now={Date.now()} />
    </div>
  );
}
