import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove, isMktPosition, isSalePosition } from "@/lib/auth";
import { ShieldCheck, AlertTriangle, MessageSquare, Clock } from "lucide-react";
import guide from "@/data/so-tay-truc-trang.json";
import CopyReply from "./CopyReply";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Sổ tay trực trang | ACME Ops Hub") };
}

export default async function SoTayTrucTrangPage() {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const pos = (user as any).position;
  const ok = isManagerOrAbove(user.role) || isMktPosition(pos) || isSalePosition(pos);
  if (!ok) redirect("/?denied=sotaytructrang");

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-brand-600" /> {t("Sổ tay trực trang")}
        </h1>
        <p className="text-sm text-gray-600 mt-2 leading-6">{t(guide.intro)}</p>
      </div>

      <section className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
        <h2 className="font-bold text-gray-900 mb-3">{t("Sáu nguyên tắc")}</h2>
        <ol className="space-y-3">
          {guide.nguyenTac.map((n, k) => (
            <li key={k} className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-brand-50 text-brand-700 text-xs font-bold flex items-center justify-center mt-0.5">{k + 1}</span>
              <div>
                <p className="font-semibold text-gray-900 text-[15px]">{t(n.title)}</p>
                <p className="text-[13px] text-gray-600 leading-6 mt-0.5">{n.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-brand-600" /> {t("Câu trả lời soạn sẵn")}
        </h2>
        {guide.mauTraLoi.map((m, k) => (
          <div key={k} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{t("Tình huống")}</p>
            <p className="font-semibold text-gray-900 mt-1">{m.tinhHuong}</p>
            <p className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-[13px] leading-6 text-gray-800 mt-3 whitespace-pre-wrap">{m.reply}</p>
            <p className="text-[13px] text-gray-500 mt-2 leading-6"><span className="font-semibold text-gray-700">{t("Vì sao:")} </span>{m.vi}</p>
            <CopyReply text={m.reply} />
          </div>
        ))}
      </section>

      <section className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
        <h2 className="font-bold text-amber-900 flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4" /> {t("Chuyển ngay, không tự trả lời")}
        </h2>
        <ul className="space-y-1.5">
          {guide.chuyenNgay.map((c, k) => (
            <li key={k} className="text-[13px] text-amber-900 flex gap-2 leading-6">
              <span className="text-amber-600 mt-0.5">•</span><span>{c}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
        <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4 text-brand-600" /> {t("Khung giờ")}
        </h2>
        <p className="text-[13px] text-gray-700 leading-6">{guide.khungGio}</p>
      </section>

      <p className="text-xs text-gray-400">
        {t("Sửa nội dung sổ tay:")} <code>data/so-tay-truc-trang.json</code> {t("— không cần đụng code.")}
      </p>
    </div>
  );
}
