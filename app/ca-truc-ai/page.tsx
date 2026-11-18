import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove, isSalePosition } from "@/lib/auth";
import { docCaTruc } from "@/lib/ca-truc-ai";
import { PageHeader, EmptyState } from "@/components/ui/kit";
import { MessagesSquare } from "lucide-react";
import CaTrucClient from "./CaTrucClient";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Ca trực AI | ACME Ops Hub") };
}

export default async function CaTrucPage() {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const duocXem = isManagerOrAbove(user.role) || isSalePosition((user as any).position);
  if (!duocXem) redirect("/");

  const kq = await docCaTruc().catch(() => null);
  const tuoiGio = kq?.at ? Math.round((Date.now() - new Date(kq.at).getTime()) / 3600e3) : null;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <PageHeader
        title={t("Ca trực AI")}
        subtitle={t("Máy soạn sẵn câu trả lời cho khách đang chờ — bạn đọc lại rồi gửi trong Zalo/Facebook của mình")}
        icon={MessagesSquare}
      />

      {!kq || !kq.ds?.length ? (
        <EmptyState
          icon={MessagesSquare}
          title={t("Chưa có bản soạn nào")}
          desc={t("Máy soạn mỗi sáng. Chưa có nghĩa là lượt soạn chưa chạy — báo quản lý nếu qua 9h sáng vẫn trống.")}
        />
      ) : (
        <>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 text-[13px] text-gray-600 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)]">
            {t("Máy đã soạn")} <b className="text-gray-900">{kq.soan}</b> {t("câu")}
            {kq.khoiLai > 0 && <> {t("(trong đó")} <b>{kq.khoiLai}</b> {t("câu khơi lại cho khách nhắn xong rồi im)")}</>}
            {tuoiGio != null && <> {t("· soạn")} {tuoiGio < 1 ? t("vừa xong") : `${tuoiGio} giờ trước`}</>}
            {kq.boVìTuCam > 0 && <> {t("· bỏ")} {kq.boVìTuCam} {t("câu vì dính từ cấm")}</>}
            <div className="mt-1.5 text-[12px] text-gray-400">
              {t("Máy KHÔNG tự nhắn cho khách. Đọc lại rồi gửi — sửa cho hợp giọng của bạn cũng được.\n              Câu nào hỏi giá, hỏi đơn hàng hay chạm chuyện bệnh thì tự trả lời, đừng gửi nguyên văn.")}
            </div>
          </div>

          <CaTrucClient ds={kq.ds} meName={(user as any).full_name || ""} />
        </>
      )}
    </div>
  );
}
