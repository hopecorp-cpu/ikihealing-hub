"use client";
import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { ackArticle } from "./actions";
import { useLang } from "@/components/lang-provider";

export function AckButton({ articleId, alreadyRead }: { articleId: string; alreadyRead: boolean }) {
  const { t } = useLang();
  const [done, setDone] = useState(alreadyRead);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <div className="mt-6 pt-6 border-t border-gray-100 flex items-center gap-2 text-green-700 font-medium">
        <CheckCircle2 className="w-5 h-5" />
        {t("Bạn đã xác nhận đọc & hiểu bài này")}
      </div>
    );
  }

  const ack = () => {
    startTransition(async () => {
      const res = await ackArticle(articleId);
      if (res.success) setDone(true);
    });
  };

  return (
    <div className="mt-6 pt-6 border-t border-gray-100">
      <button onClick={ack} disabled={pending}
        className="w-full py-3 bg-emerald-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
        <CheckCircle2 className="w-5 h-5" /> {pending ? t("Đang xác nhận...") : t("✓ TÔI ĐÃ ĐỌC & HIỂU BÀI NÀY")}
      </button>
    </div>
  );
}
