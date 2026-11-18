import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { docHangDoi, docSo, NEN_TANG } from "@/lib/dang-cheo";
import { PageHeader, EmptyState } from "@/components/ui/kit";
import { Share2 } from "lucide-react";
import DangCheoClient from "./DangCheoClient";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Đăng chéo blog | IKIHEALING Hub") };
}

export default async function DangCheoPage() {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove(user.role)) redirect("/");

  const [hangDoi, so] = await Promise.all([docHangDoi().catch(() => null), docSo().catch(() => ({}))]);
  const tuoiGio = hangDoi?.at ? Math.round((Date.now() - new Date(hangDoi.at).getTime()) / 3600e3) : null;
  const tongDaDang = Object.values(so).reduce((s, m) => s + Object.keys(m || {}).length, 0);
  const chuaBat = NEN_TANG.filter((n) => n.mucTuDong === "tam-tat");

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <PageHeader
        title={t("Đăng chéo blog")}
        subtitle={t("Máy soạn bản đăng theo nội quy từng nền tảng — bạn đọc lại rồi đăng bằng tài khoản của mình")}
        icon={Share2}
      />

      <div className="bg-white border border-gray-100 rounded-2xl p-4 text-[13px] text-gray-600 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)]">
        {t("Đã đăng chéo")} <b className="text-gray-900">{tongDaDang}</b> {t("lượt từ trước tới nay")}
        {tuoiGio != null && <> {t("· bản soạn mới nhất")} {tuoiGio < 1 ? t("vừa xong") : `${tuoiGio} giờ trước`}</>}
        <div className="mt-1.5 text-[12px] text-gray-400">
          {t("Mỗi bản đăng luôn kết bằng link về bài gốc trên example.com — đó là mục đích của việc này.\n          Đăng xong nhớ bấm &quot;Đã đăng&quot; để máy không soạn lại bài đó cho cùng một nền tảng.")}
        </div>
        {chuaBat.length > 0 && (
          <div className="mt-2 text-[12px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-2.5">
            {t("Chưa bật:")} {chuaBat.map((n) => t(n.ten)).join(", ")}{t(". Lý do ghi trong data/so-tay-dang-cheo.json.")}
          </div>
        )}
      </div>

      {!hangDoi?.ds?.length ? (
        <EmptyState
          icon={Share2}
          title={t("Chưa có bản soạn nào")}
          desc={t("Máy soạn mỗi sáng, và chỉ soạn cho nền tảng ĐẾN HẠN theo nhịp riêng của nó — ngày trống là ngày đúng lịch, không phải hỏng.")}
        />
      ) : (
        <DangCheoClient ds={hangDoi.ds} />
      )}
    </div>
  );
}
