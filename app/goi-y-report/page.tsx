import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove, isMktPosition } from "@/lib/auth";
import { buildReportAdvice } from "@/lib/report-advisor";
import { Lightbulb, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import CopyDraft from "./CopyDraft";
import SnapshotBoard from "./SnapshotBoard";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Gợi ý hướng báo cáo PR | IKIHEALING Hub") };
}

export default async function GoiYReportPage() {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const ok = isManagerOrAbove(user.role) || isMktPosition((user as any).position);
  if (!ok) redirect("/?denied=goiyreport");

  const a = await buildReportAdvice();
  const ready = a.ideas.filter((i) => i.ready);
  const waiting = a.ideas.filter((i) => !i.ready);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Lightbulb className="w-6 h-6 text-brand-600" /> {t("Gợi ý hướng báo cáo PR")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("Máy tự quét dữ liệu ACME (đơn hàng, vận đơn, quiz, khảo sát) rồi đề xuất hướng báo cáo công bố cho báo chí —\n          theo mô hình báo cáo thị trường định kỳ. Số liệu mồi bên dưới đã tính từ dữ liệu thật, không phải ví dụ.\n          Kỳ dữ liệu: tháng")} {a.month} {t("(so cùng kỳ")} {a.prevMonth}).
        </p>
      </div>

      <SnapshotBoard s={a.snapshot} />

      {a.fbDraft && (
        <section className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
          <h2 className="font-bold flex items-center gap-2 mb-1"><FileText className="w-4 h-4 text-brand-600" /> {t("Bài đăng báo cáo tháng (sẵn để copy)")}</h2>
          <p className="text-xs text-gray-500 mb-3">{t("Định dạng theo báo cáo thị trường định kỳ: câu chốt bức tranh chung, khối tổng quan, rồi từng phân khúc một dòng có số và so sánh kỳ trước.")}</p>
          <pre className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-[13px] leading-6 whitespace-pre-wrap font-sans text-gray-800">{a.fbDraft}</pre>
          <CopyDraft text={a.fbDraft} />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-bold text-gray-900">{t("Đủ mẫu — công bố được ngay (")}{ready.length})</h2>
        {ready.map((i) => (
          <div key={i.key} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-bold text-gray-900">{t(i.title)}</h3>
              <span className="shrink-0 text-xs font-bold text-brand-700 bg-brand-50 rounded-full px-2.5 py-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> {i.score}/100
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-2">{i.angle}</p>
            <ul className="mt-3 space-y-1.5">
              {i.seeds.map((s, k) => (
                <li key={k} className="text-[13px] text-gray-800 flex gap-2">
                  <span className="text-brand-600 mt-0.5">•</span><span className="sensitive">{s}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-400 mt-3">{t("Cỡ mẫu")} {i.n.toLocaleString("vi-VN")} {t("· Nguồn:")} {i.source}</p>
          </div>
        ))}
      </section>

      {waiting.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-bold text-gray-900">{t("Chờ đủ mẫu (")}{waiting.length})</h2>
          {waiting.map((i) => (
            <div key={i.key} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5 opacity-90">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-bold text-gray-700">{t(i.title)}</h3>
                <span className="shrink-0 text-xs font-bold text-amber-700 bg-amber-50 rounded-full px-2.5 py-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {i.n.toLocaleString("vi-VN")} {t("mẫu")}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-2">{i.angle}</p>
              {i.need && <p className="text-sm font-semibold text-amber-700 mt-2">{t("Cần:")} {i.need}</p>}
              <p className="text-xs text-gray-400 mt-2">{t("Nguồn:")} {i.source}</p>
            </div>
          ))}
        </section>
      )}

      <section className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
        <h2 className="font-bold text-gray-900 mb-2">{t("Đã công bố (tránh trùng)")}</h2>
        <ul className="space-y-1">
          {a.published.map((p, k) => (
            <li key={k} className="text-[13px] text-gray-600 flex gap-2"><span className="text-gray-400">•</span>{p}</li>
          ))}
        </ul>
        <a href="https://example.com/blog/danh-muc-bao-cao.html" target="_blank" rel="noopener"
           className="inline-block mt-3 text-sm font-semibold text-brand-700 hover:underline">{t("Xem chuyên mục Báo cáo trên blog →")}</a>
      </section>
    </div>
  );
}
