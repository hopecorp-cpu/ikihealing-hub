import { requireUser } from "@/lib/auth-server";
import { getMyAssignedCustomers, markAssignmentsSeen } from "@/lib/sale-suggestions";
import { ClipboardList } from "lucide-react";
import { MyCustomersClient } from "./client";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function MyCustomersPage() {
  const { t } = getT();
  const user = await requireUser();
  const customers = await getMyAssignedCustomers(user.id);

  await markAssignmentsSeen(user.id, new Date().toISOString());

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-emerald-600" /> {t("Khách của tôi")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {customers.length > 0
            ? `${t("Bạn được giao chăm sóc")} ${customers.length} ${t("khách · gọi/nhắn theo gợi ý bên dưới")}`
            : t("Hiện bạn chưa được giao khách nào. Quản lý sẽ phân bổ qua Trợ lý Sale.")}
        </p>
      </div>
      <MyCustomersClient customers={customers} />
    </div>
  );
}
