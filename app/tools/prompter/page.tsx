import Link from "next/link";
import { ChevronRight, Video } from "lucide-react";
import StudioApp from "@/components/tools/prompter/StudioApp";
import { getT } from "@/lib/i18n-server";

export const metadata = { title: "Prompter Studio — ACME Hub" };

export default function PrompterPage() {
  const { t } = getT();
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <nav className="text-xs text-gray-500 mb-2 flex items-center gap-1.5">
          <Link href="/tools" className="hover:text-gray-900">{t("Công cụ")}</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-900">Prompter Studio</span>
        </nav>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Video className="w-6 h-6 text-brand-600" /> Prompter Studio
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("Quay video đọc kịch bản qua teleprompter — AI viết script, tự cắt im lặng, sửa mắt nhìn camera bằng AI.")}
        </p>
      </div>
      <StudioApp />
    </div>
  );
}
