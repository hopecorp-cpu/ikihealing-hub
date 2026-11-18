"use client";
import { Download } from "lucide-react";
import { fmtVND } from "@/lib/payroll";
import { useLang } from "@/components/lang-provider";

export function ExportButton({ rows, month }: { rows: any[]; month: string }) {
  const { t } = useLang();
  const exportCSV = () => {
    if (!rows || rows.length === 0) { alert(t("Chưa có data")); return; }

    const headers = [
      t("STT"), t("Họ tên"), t("Chức vụ"), t("Lương CB căn cứ BH"), t("Lương Gross"), t("NC chuẩn"), t("NC thực tế"),
      t("Lương theo NC"), t("PC Điện thoại"), t("PC Chuyên cần"), t("PC Ăn trưa"), t("PC Xăng xe"), t("PC khác"),
      t("DS Đạm Mẫu (net)"), t("Thưởng KPI"),
      t("Tổng TN"), t("BH NLĐ 10.5%"), t("GTGT BT"), t("TNTT"), t("Thuế TNCN"), t("Tạm ứng"), t("Khấu trừ khác"), t("THỰC LĨNH"),
      t("Tình trạng TK"), t("BH DN 21.5%"), t("Tổng CP DN"), t("% Thuế/Gross"), t("Ghi chú")
    ];

    const statusLabel: Record<string, string> = { draft: t("Chờ duyệt"), preview: t("Chờ duyệt"), approved: t("Đã duyệt"), paid: t("Đã trả") };
    const csv = [headers.join(",")];
    rows.forEach((r, i) => {
      const taxPct = r.gross_salary ? ((r.personal_income_tax || 0) / r.gross_salary * 100).toFixed(1) : "0.0";
      csv.push([
        i + 1,
        `"${r.users?.full_name ?? ""}"`,
        `"${r.users?.position ?? ""}"`,
        r.base_salary || 0,
        r.gross_salary || 0,
        r.working_days_standard || 0,
        r.working_days_actual || 0,
        r.salary_by_workdays || 0,
        r.allowance_phone || 0,
        r.allowance_attendance || 0,
        r.allowance_lunch || 0,
        r.allowance_fuel || 0,
        r.allowances || 0,
        r.sales_revenue_net || 0,
        r.bonus_amount || 0,
        r.total_income || 0,
        r.employee_insurance || 0,
        r.personal_deduction || 0,
        r.taxable_income || 0,
        r.personal_income_tax || 0,
        r.advance_payment || 0,
        r.deduction_penalty || 0,
        r.net_salary || 0,
        `"${statusLabel[r.status] ?? r.status ?? ""}"`,
        r.employer_insurance || 0,
        r.total_company_cost || 0,
        `${taxPct}%`,
        `"${(r.note ?? "").replace(/"/g, "''")}"`
      ].join(","));
    });

    const blob = new Blob(["﻿" + csv.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `BangLuong_ACME_${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportBankCSV = () => {
    if (!rows || rows.length === 0) { alert(t("Chưa có data")); return; }

    const csv = [`${t("STT")},${t("Họ tên")},${t("Số tài khoản")},${t("Ngân hàng")},${t("Số tiền")},${t("Nội dung")}`];
    rows.forEach((r, i) => {
      csv.push([
        i + 1,
        `"${r.users?.full_name ?? ""}"`,
        "", "",
        r.net_salary || 0,
        `"Luong ${month} - ${r.users?.full_name ?? ""}"`
      ].join(","));
    });

    const blob = new Blob(["﻿" + csv.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ChuyenKhoan_ACME_${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex gap-2">
      <button onClick={exportCSV} className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1">
        <Download className="w-4 h-4" /> {t("Excel/CSV")}
      </button>
      <button onClick={exportBankCSV} className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1">
        <Download className="w-4 h-4" /> {t("File ngân hàng")}
      </button>
    </div>
  );
}
