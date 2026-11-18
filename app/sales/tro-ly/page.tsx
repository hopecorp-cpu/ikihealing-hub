import { requireManager } from "@/lib/auth-server";
import { getSaleSuggestions } from "@/lib/sale-suggestions";
import { Headset } from "lucide-react";
import { SaleAssistantClient } from "./client";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function SaleAssistantPage() {
  const { t } = getT();
  await requireManager();
  const data = await getSaleSuggestions();

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Headset className="w-6 h-6 text-blue-600" /> {t("Trợ lý Sale")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("Phân tệp khách · gợi ý nên bán gì · combo & chiết khấu — cập nhật realtime từ dữ liệu đơn")}
        </p>
      </div>
      <SaleAssistantClient data={data} />
    </div>
  );
}
