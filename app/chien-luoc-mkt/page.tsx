import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove, isMktPosition } from "@/lib/auth";
import { MKT_STRATEGY, getStrategy } from "@/lib/mkt-strategy";
import { getResearchHistory } from "@/lib/content-factory";
import { getT } from "@/lib/i18n-server";
import { FlaskConical } from "lucide-react";
import StrategyClient from "./StrategyClient";
import ResearchNowButton from "./ResearchNowButton";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Chiến lược Marketing | IKIHEALING Hub") };
}

export default async function StrategyPage() {
  const { t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const canEdit = isManagerOrAbove(user.role) || isMktPosition((user as any).position);
  if (!canEdit) redirect("/?denied=chienluoc");

  const s = await getStrategy();
  const research = await getResearchHistory();
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">{t("Chiến lược Marketing tổng thể")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t(MKT_STRATEGY.intro)}{s.updatedAt ? ` · ${t("cập nhật")} ${s.updatedAt.slice(0, 10)}` : ""}</p>
      </div>
      <StrategyClient sections={MKT_STRATEGY.sections} content={s.content} canEdit={canEdit} />

      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-emerald-600" strokeWidth={1.75} />
            <h2 className="font-semibold">{t("Nghiên cứu thị trường (AI · hằng ngày)")}</h2>
          </div>
          {canEdit && <ResearchNowButton />}
        </div>
        <p className="text-xs text-gray-500 mb-3">{t("Agent Research tự tra xu hướng, đối thủ, nỗi đau khách & quy định. Bấm \"Chạy Research ngay\" để tạo bản mới liền. Kết quả nuôi Nhà máy Content.")}</p>
        {research.length === 0 ? (
          <p className="text-sm text-gray-400">{t("Chưa có bản nghiên cứu nào. Agent chạy Chủ Nhật hằng tuần (cần khóa Gemini).")}</p>
        ) : (
          <div className="space-y-2">
            {research.map((r, i) => (
              <details key={i} className="rounded-lg border border-gray-100 bg-gray-50" open={i === 0}>
                <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
                  {t("Bản ngày")} {String(r.at || "").slice(0, 10)}{i === 0 ? ` · ${t("mới nhất")}` : ""}
                </summary>
                <div className="px-3 pb-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{r.summary}</div>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
