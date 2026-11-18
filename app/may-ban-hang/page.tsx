import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-server";
import { isManagerOrAbove } from "@/lib/auth";
import { getAutoReplyConfig, listPages } from "@/lib/fb-autoreply";
import { getFlashDeal } from "@/lib/flash-deal";
import { AutoReplyForm, FlashForm } from "./Client";
import { Zap } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MayBanHangPage() {
  const { t: t } = getT();
  const user = await requireUser();
  if (!isManagerOrAbove(user.role)) redirect("/?denied=manager");

  const [autoReply, pages, flash] = await Promise.all([
    getAutoReplyConfig(),
    listPages().catch(() => []),
    getFlashDeal(),
  ]);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2.5 text-gray-900">
          <Zap className="w-6 h-6 text-emerald-600" />
          {t("Máy bán hàng tự động")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("Trả lời tự động tin nhắn fanpage và ưu đãi quà tặng có hạn trên example.com. Sửa ở đây, web tự cập nhật.")}
        </p>
      </div>

      <AutoReplyForm init={autoReply} pages={pages} />
      <FlashForm init={flash} />

      <div className="text-[12px] text-gray-500 bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-1.5">
        <div className="font-semibold text-gray-700">{t("Bật trả lời tự động cần 3 bước một lần duy nhất:")}</div>
        <div>{t("1. Đặt biến")} <code>FB_VERIFY_TOKEN</code> {t("trên Vercel (chuỗi bất kỳ do anh tự đặt).")}</div>
        <div>{t("2. Trong Meta App → Webhooks → Page: dán địa chỉ")} <code>https://ops-hub.example.com/api/fb/webhook</code>{t(", dán đúng chuỗi trên, chọn trường")} <code>messages</code>.</div>
        <div>{t("3. Bấm nút")} <b>{t("&ldquo;Đăng ký fanpage nhận tin nhắn&rdquo;")}</b> {t("ở khối trên.")}</div>
        <div className="pt-1">{t("Xong 3 bước mới tick ô Bật ở trên. Chưa xong mà bật thì không có gì xảy ra — không hỏng gì.")}</div>
      </div>
    </div>
  );
}
