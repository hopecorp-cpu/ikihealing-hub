import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove, isSalePosition } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import guide from "@/data/sale-guide.json";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Hướng dẫn cho Sale | IKIHEALING Hub") };
}

export default async function SaleGuidePage() {
  const { t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(isManagerOrAbove(user.role) || isSalePosition((user as any).position))) redirect("/");

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">{t("Hướng dẫn cho Sale — Bắt đầu ở đây")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t(guide.intro)}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {guide.principles.map((p, i) => (
          <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <div className="text-2xl">{p.icon}</div>
            <div className="font-bold text-sm mt-1">{t(p.title)}</div>
            <div className="text-[12px] text-gray-600 mt-0.5 leading-relaxed">{t(p.desc)}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="font-bold text-lg mb-2">{t("Luồng một ngày — làm theo thứ tự này")}</h2>
        <div className="space-y-4">
          {guide.routine.map((block, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <span className="font-bold text-sm">{block.when}</span>
                <span className="text-xs text-gray-400">{block.time}</span>
              </div>
              <div className="divide-y divide-gray-100">
                {block.steps.map((s, j) => (
                  <Link key={j} href={s.href} className="flex items-start gap-3 p-3 hover:bg-gray-50 transition">
                    <span className="text-sm font-semibold text-emerald-700 shrink-0">{t(s.label).split(".")[0]}.</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-800">{t(s.label).replace(/^\d+\.\s*/, "")}</div>
                      <div className="text-[12px] text-gray-500 mt-0.5 leading-relaxed">{t(s.desc)}</div>
                    </div>
                    <span className="text-gray-300 shrink-0">→</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-bold text-lg mb-2">{t("Danh mục công cụ — cái nào để làm gì")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {guide.tools.map((tool, i) => (
            <Link key={i} href={tool.href} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-3 hover:shadow-md hover:border-emerald-300 transition flex gap-3">
              <span className="text-xl shrink-0">{tool.icon}</span>
              <div className="min-w-0">
                <div className="font-semibold text-sm">{tool.name}</div>
                <div className="text-[12px] text-gray-600 mt-0.5">{tool.what}</div>
                <div className="text-[11px] text-emerald-700 mt-1">{tool.when}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <p className="text-center text-[11px] text-gray-400 py-2">{t("Chưa rõ chỗ nào cứ hỏi quản lý. Làm đều mỗi ngày là lên hạng nhanh nhất ")}</p>
    </div>
  );
}
