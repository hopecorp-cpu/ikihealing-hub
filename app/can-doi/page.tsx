import { getT } from "@/lib/i18n-server";
import { requireAdmin } from "@/lib/auth-server";
import { buildDailyBalance } from "@/lib/balance-report";
import { RefreshCw } from "lucide-react";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Cân đối nhanh | IKIHEALING Hub") };
}

export default async function CanDoiPage() {
  const { t: t } = getT();
  await requireAdmin();
  const r = await buildDailyBalance();

  const html = (r.text || "Chưa dựng được bảng cân đối.").replace(/\n/g, "<br/>");
  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      <div
        className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm leading-relaxed text-[15px] text-gray-800 [&_b]:text-gray-900 [&_a]:text-emerald-600 [&_a]:underline"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <p className="text-xs text-gray-400 mt-3 flex items-center gap-1.5">
        <RefreshCw className="w-3.5 h-3.5" /> {t("Tự tính lại mỗi lần mở trang · gửi Telegram tự động 10h sáng · nhắn &quot;cân đối&quot; cho bot để nhận ngay.")}
      </p>
    </div>
  );
}
