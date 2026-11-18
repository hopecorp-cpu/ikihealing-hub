import Link from "next/link";
import { Video, ArrowRight, Wrench, Sparkles } from "lucide-react";
import { getT } from "@/lib/i18n-server";

export function generateMetadata() {
  const { t } = getT();
  return { title: t("Công cụ Sales & MKT — ACME Hub") };
}

const tools = [
  {
    href: "/tools/prompter",
    title: "Prompter Studio",
    desc: "Quay video đọc kịch bản với teleprompter — AI viết kịch bản, tự cắt im lặng, sửa mắt nhìn camera. Dùng cho video bán hàng, content MXH, reels.",
    icon: Video,
    badge: "Mới",
    available: true,
  },
];

export default function ToolsPage() {
  const { t } = getT();
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          {t("Công cụ Sales & Marketing")} <Wrench className="w-5 h-5 text-gray-400" />
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("Các công cụ hỗ trợ team bán hàng và marketing — quay video, viết nội dung, phân tích.")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.available ? tool.href : "#"}
            className={`group relative bg-white rounded-xl border border-gray-200 p-5 transition ${
              tool.available ? "hover:border-brand-500 hover:shadow-md" : "opacity-50 cursor-not-allowed"
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                <tool.icon className="w-6 h-6 text-brand-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{t(tool.title)}</h3>
                  {tool.badge && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 text-[10px] font-semibold">
                      <Sparkles className="w-3 h-3" />
                      {t(tool.badge)}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1 leading-relaxed">{t(tool.desc)}</p>
                {tool.available && (
                  <div className="text-sm text-brand-600 mt-3 flex items-center gap-1 font-medium opacity-0 group-hover:opacity-100 transition">
                    {t("Mở công cụ")} <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}

        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-5 text-center text-sm text-gray-500">
          {t("Sắp ra mắt: AI viết caption — Phân tích đối thủ — Quản lý lead")}
        </div>
      </div>
    </div>
  );
}
