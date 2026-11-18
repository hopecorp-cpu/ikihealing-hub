"use client";
import Link from "next/link";
import { useState } from "react";
import type { SaleUrgent } from "@/lib/sale-urgent";
import { useLang } from "@/components/lang-provider";
import { AlertTriangle } from "lucide-react";

export function SaleAlertBar({ data }: { data: SaleUrgent | null }) {
  const { t } = useLang();
  const [min, setMin] = useState(false);
  if (!data) return null;

  const items: { icon: string; text: string; href: string }[] = [];
  if (data.unreplied > 0) {
    const age = data.oldestHours >= 24 ? `${Math.round(data.oldestHours / 24)} ${t("ngày")}` : `${Math.round(data.oldestHours)}h`;
    items.push({ icon: "", text: `${data.unreplied} ${t("khách ĐANG CHỜ bạn trả lời")}${data.oldestHours >= 24 ? ` — ${t("lâu nhất")} ${age} (${data.oldestName})!` : ""}`, href: "/danh-ba-khach" });
  }
  if (data.fbTotal > 0) {
    const fbAge = data.fbOldestHours >= 24 ? `${Math.round(data.fbOldestHours / 24)} ${t("ngày")}` : `${Math.round(data.fbOldestHours)}h`;
    items.push({ icon: "", text: `${data.fbTotal} ${t("khách Facebook CHƯA được trả lời")} (${data.fbInbox} tin + ${data.fbComment} cmt)${data.fbOldestHours >= 24 ? ` — ${t("cũ nhất")} ${fbAge}` : ""} — ${t("hàng chung, ai rảnh nhận!")}`, href: "/cham-soc-kh" });
  }
  if (data.callsToday === 0) items.push({ icon: "", text: t("Hôm nay bạn CHƯA GỌI khách nào — tệp nóng phải gọi!"), href: "/cham-soc-kh" });
  if (data.careToday === 0) items.push({ icon: "", text: t("Hôm nay bạn CHƯA CHĂM khách nào — chăm là ra tiền!"), href: "/cham-soc-kh" });

  if (data.coachViol > 0) items.push({ icon: "", text: `${data.coachViol} ${t("cuộc bạn tư vấn có dấu hiệu VI PHẠM luật QC — sửa ngay kẻo phạt 30-60tr!")}`, href: "/chat-quality" });
  else if (data.coachCount > 0) items.push({ icon: "", text: `${data.coachCount} ${t("khách bạn tư vấn cần điều chỉnh cách chăm — xem gợi ý")}`, href: "/chat-quality" });

  if (!items.length) return null;
  const primary = items[0].href;

  if (min) {
    return (
      <button onClick={() => setMin(false)}
        className="w-full mb-3 flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold animate-pulse">
        {items.length} {t("việc GẤP cần làm — bấm để xem")}
      </button>
    );
  }

  return (
    <div className="mb-4 rounded-xl border-2 border-red-500 bg-red-50 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between bg-red-600 text-white px-3 py-1.5">
        <span className="font-bold text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 animate-pulse shrink-0" /> {t("VIỆC GẤP CỦA BẠN HÔM NAY")}</span>
        <button onClick={() => setMin(true)} className="text-white/80 hover:text-white text-xs">{t("thu gọn ▲")}</button>
      </div>
      <div className="p-3 space-y-2">
        {items.map((it, i) => (
          <Link key={i} href={it.href} className="flex items-center gap-2 bg-white border border-red-200 rounded-lg px-3 py-2 text-sm text-red-800 font-medium hover:bg-red-100">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" /><span className="flex-1">{it.text}</span><span className="text-xs text-red-500 font-bold shrink-0">{t("LÀM NGAY →")}</span>
          </Link>
        ))}
        <Link href={primary} className="block text-center bg-red-600 text-white rounded-lg py-2 text-sm font-bold hover:bg-red-700">{t("▶ Bắt tay vào làm ngay")}</Link>
      </div>
    </div>
  );
}
