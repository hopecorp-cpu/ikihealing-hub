"use client";
import { useEffect } from "react";
import { useLang } from "@/components/lang-provider";
import { AlertTriangle } from "lucide-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useLang();
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="flex justify-center mb-4"><AlertTriangle className="w-12 h-12 text-amber-500" /></div>
        <h2 className="text-xl font-bold mb-2">{t("Đã có lỗi xảy ra")}</h2>
        <p className="text-sm text-gray-600 mb-1">{error.message}</p>
        {error.digest && <p className="text-xs text-gray-400 mb-4">{t("Mã lỗi:")} {error.digest}</p>}
        <button onClick={reset} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700">
          {t("Thử lại")}
        </button>
      </div>
    </div>
  );
}
