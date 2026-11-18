import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase-server";
import { getT } from "@/lib/i18n-server";
import { isManagerOrAbove } from "@/lib/auth";
import { layThiTran } from "@/lib/thi-tran-server";
import { EmptyState } from "@/components/ui/kit";
import ThiTran from "./ThiTran";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: `${t("Thị trấn máy")} | ACME Ops Hub` };
}

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove(user.role)) redirect("/");
  const { t } = getT();

  const d = await layThiTran().catch(() => null);
  if (!d) {
    return <EmptyState title={t("Chưa đọc được bản đồ máy")} desc={t("layThiTran() lỗi — xem /may-chay-ngam hoặc log server.")} />;
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-3">
      <ThiTran d={d} />
      <div className="text-[12px] text-gray-400">
        {t("Cùng dữ liệu với")} <Link href="/may-chay-ngam" className="text-teal-700 hover:underline">{t("Máy chạy ngầm")}</Link> {t("(dạng bảng).")}
        {" "}{t("Trạng thái đọc từ watchdog lúc mở trang; việc MausBot đọc từ bảng việc iMac đẩy lên.")}
      </div>
    </div>
  );
}
