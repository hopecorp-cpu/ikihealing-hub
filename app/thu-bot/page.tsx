import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase-server";
import { isCskhPosition, isManagerOrAbove, isSalePosition } from "@/lib/auth";
import { PageHeader } from "@/components/ui/kit";
import ThuBotClient from "./Client";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Thử bot trả lời khách | IKIHEALING Hub") };
}

export default async function Page() {
  const { t: t } = getT();
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  if (!isManagerOrAbove(u.role) && !isSalePosition((u as any).position) && !isCskhPosition((u as any).position)) redirect("/?denied=thu-bot");
  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl">
      <PageHeader icon={FlaskConical} title={t("Thử bot trả lời khách")}
        subtitle={t("Gõ tin giả làm khách, xem bot Zalo OA / Messenger định trả lời gì và vì sao. Không gửi cho ai, không tra đơn, không tạo lead.")} />
      <ThuBotClient />
    </div>
  );
}
