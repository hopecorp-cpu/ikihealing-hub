"use client";
import { useState } from "react";
import Link from "next/link";
import { Bot, ChevronRight, CheckCircle2, X } from "lucide-react";
import type { AdminReminder } from "@/lib/admin-reminders";
import { useLang } from "@/components/lang-provider";

const SEV_STYLE: Record<string, { ring: string; chip: string; label: string }> = {
  high: { ring: "border-red-200 bg-red-50", chip: "bg-red-100 text-red-700", label: "Gấp" },
  med: { ring: "border-amber-200 bg-amber-50", chip: "bg-amber-100 text-amber-700", label: "Cần làm" },
  low: { ring: "border-gray-200 bg-gray-50", chip: "bg-gray-100 text-gray-600", label: "Lưu ý" },
};

export function AdminAssistant({ reminders }: { reminders: AdminReminder[] }) {
  const { t } = useLang();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = reminders.filter(r => !dismissed.has(r.id));
  const highCount = visible.filter(r => r.severity === "high").length;

  if (reminders.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
          <Bot className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <div className="font-semibold flex items-center gap-2">{t("Trợ lý ảo ACME")} <CheckCircle2 className="w-4 h-4 text-emerald-600" /></div>
          <div className="text-sm text-gray-500">{t("Không có việc HR nào cần nhắc. Mọi thứ ổn ")}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 shadow">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold flex items-center gap-2">
              {t("Trợ lý ảo ACME")}
              {highCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-bold animate-pulse">
                  {highCount} {t("gấp")}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500">{visible.length} {t("việc HR cần anh/chị xử lý")}</div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {visible.map(r => {
  const { t: t } = useLang();
          const st = SEV_STYLE[r.severity] || SEV_STYLE.low;
          return (
            <div key={r.id} className={`border rounded-lg p-3 flex items-start gap-3 ${st.ring}`}>
              <div className="text-xl leading-none mt-0.5">{r.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{t(r.title)}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${st.chip}`}>{t(st.label)}</span>
                  {r.daysLeft != null && (
                    <span className="text-[10px] text-gray-500">
                      {r.daysLeft < 0 ? `${t("quá")} ${Math.abs(r.daysLeft)} ${t("ngày")}` : `${t("còn")} ${r.daysLeft} ${t("ngày")}`}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-600 mt-0.5">{r.detail}</div>
                <Link href={r.actionHref} className="text-xs text-indigo-600 font-medium inline-flex items-center gap-0.5 mt-1 hover:underline">
                  {r.actionLabel} <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <button onClick={() => setDismissed(prev => new Set(prev).add(r.id))}
                className="text-gray-400 hover:text-gray-600 shrink-0" title={t("Ẩn nhắc này (phiên hiện tại)")}>
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
