"use client";
import { useRouter } from "next/navigation";
import { useLang } from "./lang-provider";
import { LOCALE_COOKIE, LOCALES, LOCALE_NHAN, type Locale } from "@/lib/i18n";

const TEN_DAY: Record<Locale, string> = { vi: "Tiếng Việt", en: "English", ja: "日本語" };

export function LangToggle() {
  const { t: t } = useLang();
  const { locale } = useLang();
  const router = useRouter();
  const chuyen = (l: Locale) => {
    if (l === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  };
  return (
    <div className="inline-flex items-center rounded-lg border border-gray-200 overflow-hidden" role="group" aria-label={t("Ngôn ngữ")}>
      {LOCALES.map((l) => (
        <button
          key={l}
          onClick={() => chuyen(l)}
          title={t(TEN_DAY[l])}
          aria-current={l === locale ? "true" : undefined}
          className={`px-2 py-1 text-xs font-semibold border-l first:border-l-0 border-gray-200 ${
            l === locale ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          {LOCALE_NHAN[l]}
        </button>
      ))}
    </div>
  );
}
