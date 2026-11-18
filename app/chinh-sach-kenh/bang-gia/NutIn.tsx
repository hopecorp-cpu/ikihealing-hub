"use client";
import { useLang } from "@/components/lang-provider";
import { Printer } from "lucide-react";

export default function NutIn() {
  const { t: t } = useLang();
  return (
    <button onClick={() => window.print()} className="print:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700">
      <Printer className="w-4 h-4" /> {t("In bảng giá")}
    </button>
  );
}
