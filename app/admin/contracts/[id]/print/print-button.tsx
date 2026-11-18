"use client";
import { useLang } from "@/components/lang-provider";
import { Printer } from "lucide-react";

export function PrintButton() {
  const { t } = useLang();
  return (
    <button onClick={() => window.print()}
      className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold inline-flex items-center gap-1 shadow-lg">
      <Printer className="w-4 h-4" /> {t("In / Lưu PDF")}
    </button>
  );
}
