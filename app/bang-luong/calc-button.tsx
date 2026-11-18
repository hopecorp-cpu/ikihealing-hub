"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { calcPayrollForMonth } from "./calc-action";
import { Calculator } from "lucide-react";
import { useLang } from "@/components/lang-provider";

export function CalcButton({ month }: { month: string }) {
  const { t } = useLang();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const router = useRouter();

  const run = async () => {
    if (!confirm(`${t("Chốt bảng lương tháng")} ${month}?\n\n${t("Áp dụng:")}\n${t("• Tier ACME thực tế (Lead Sale 150M, Sale NV 100M, Trực Page 1.5%)")}\n${t("• Trừ VAT 8% Đạm Mẫu")}\n${t("• Trừ × 85% nếu thử việc")}\n${t("• Thưởng nhóm Sale (≥300M DS nhóm)")}\n${t("• Trần BH 46.8M, thuế TNCN 5 bậc 2026")}\n\n${t("Ghi đè bản draft cũ.")}`)) return;
    setLoading(true); setMsg("");
    try {
      const res = await calcPayrollForMonth(month);
      if (res.success) {
        setMsg(`${t("Đã chốt")} ${res.count} ${t("phiếu lương")}`);
        router.refresh();
      } else {
        setMsg("" + res.error);
      }
    } catch (e: any) {
      setMsg("" + e.message);
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(""), 5000);
    }
  };

  return (
    <>
      <button onClick={run} disabled={loading}
        className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-brand-700 disabled:opacity-50">
        <Calculator className="w-4 h-4" />
        {loading ? t("Đang tính...") : t("Chốt lương tháng này")}
      </button>
      {msg && <span className="text-sm font-medium">{msg}</span>}
    </>
  );
}
