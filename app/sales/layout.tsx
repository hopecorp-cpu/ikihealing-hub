import { getT } from "@/lib/i18n-server";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { HubTabs, type HubTab } from "@/components/hub-tabs";

export const dynamic = "force-dynamic";

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const { t: t } = getT();
  const user = await getCurrentUser();
  const manager = user ? isManagerOrAbove(user.role) : false;

  const tabs: HubTab[] = [
    ...(manager ? [{ href: "/sales", label: t("Tổng quan"), iconKey: "overview" }] : []),
    { href: "/sales/huong-dan", label: t("Bắt đầu ở đây"), iconKey: "start" },
    { href: "/sales/checklist", label: "Checklist", iconKey: "checklist" },
    { href: "/sales/khach-cua-toi", label: t("Khách của tôi"), iconKey: "customers" },
    { href: "/sales/don-online", label: t("Đơn online"), iconKey: "orders" },
    { href: "/sales/telesales", label: t("Kịch bản Telesales"), iconKey: "phone" },
    { href: "/sales/tro-ly", label: t("Trợ lý Sale (AI)"), iconKey: "assist" },
  ];

  return (
    <div>
      <HubTabs tabs={tabs} rootHref="/sales" />
      {children}
    </div>
  );
}
