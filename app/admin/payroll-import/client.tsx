"use client";
import { useState, useTransition } from "react";
import { previewPayrollExcel, commitPayrollImport } from "./actions";
import { fmtVND } from "@/lib/payroll";
import { Upload, Wallet, Check, AlertCircle, FileSpreadsheet, Save, ArrowRight } from "lucide-react";
import { useLang } from "@/components/lang-provider";

export function PayrollImportClient() {
  const { t } = useLang();
  const [file, setFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>("");
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [preview, setPreview] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [status, setStatus] = useState<"draft" | "approved" | "paid">("approved");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  const handleFile = async (f: File | null) => {
    setFile(f);
    if (!f) return;
    const buf = await f.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    setFileBase64(btoa(bin));
  };

  const doPreview = () => {
    if (!fileBase64) return;
    startTransition(async () => {
      const res = await previewPayrollExcel({ fileBase64 });
      if (res.success) { setPreview(res); setStep("preview"); }
      else setMsg({ text: "" + res.error, type: "err" });
    });
  };

  const doCommit = () => {
    if (!confirm(`${t("Import")} ${preview.stats.totalRows} ${t("dòng lương trong")} ${preview.stats.totalSheets} sheets?\nStatus: ${status}`)) return;
    startTransition(async () => {
      const res = await commitPayrollImport({ fileBase64, status });
      if (res.success) { setResult(res); setStep("done"); }
      else setMsg({ text: "" + (res as any).error, type: "err" });
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Wallet className="w-8 h-8 text-emerald-600" />
        <div>
          <h1 className="text-2xl font-bold">{t("Import Bảng lương từ Excel")}</h1>
          <p className="text-sm text-gray-500">{t("Format hỗ trợ: ACME_BangLuong_2026_ChuanHoa.xlsx — auto-detect sheet \"Tháng X.YYYY\"")}</p>
        </div>
      </div>

      {step === "upload" && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs">
            <b>{t("Format file chuẩn:")}</b>
            <ul className="mt-1 ml-4 list-disc">
              <li>{t("Sheet đặt tên dạng")} <code>{t("Tháng 1.2026")}</code>, <code>{t("Tháng 2.2026")}</code> {t("(1 sheet = 1 tháng)")}</li>
              <li>{t("Header ở dòng 4: STT · Họ tên · Năm sinh · Chức vụ · CCCD · MST · Lương CB · Lương Gross · NC chuẩn · NC thực · ... · Thực lĩnh · CP DN")}</li>
              <li>{t("Data từ dòng 5 trở đi")}</li>
              <li>{t("Hệ thống auto-match NV theo tên với")} <code>users.full_name</code></li>
            </ul>
          </div>

          <div>
            <label className="text-sm font-medium">{t("Chọn file Excel (.xlsx)")}</label>
            <input type="file" accept=".xlsx,.xls,.xlsm,.ods" onChange={e => handleFile(e.target.files?.[0] || null)}
              className="mt-1 block w-full p-2 border border-gray-200 rounded-lg text-sm" />
          </div>

          <div>
            <label className="text-sm font-medium">{t("Status khi import")}</label>
            <select value={status} onChange={e => setStatus(e.target.value as any)}
              className="mt-1 w-full p-2 border border-gray-200 rounded-lg text-sm">
              <option value="draft">{t("Draft (nháp — chưa duyệt)")}</option>
              <option value="approved">{t("Approved (đã duyệt — NV xem được)")}</option>
              <option value="paid">{t("Paid (đã chi)")}</option>
            </select>
          </div>

          {msg && <div className={`p-3 rounded text-sm ${msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg.text}</div>}

          <button onClick={doPreview} disabled={pending || !file}
            className="w-full py-3 bg-brand-600 text-white rounded-lg font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2">
            <Upload className="w-4 h-4" /> {pending ? t("Đang đọc...") : t("Phân tích file")}
          </button>
        </div>
      )}

      {step === "preview" && preview && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
            <h3 className="font-bold mb-3">{t("Preview")}</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Stat label={t("Sheets")} value={String(preview.stats.totalSheets)} color="#3B82F6" />
              <Stat label={t("Dòng lương")} value={String(preview.stats.totalRows)} color="#10B981" />
              <Stat label={t("✓ Match")} value={String(preview.stats.matched)} color="#10B981" />
              <Stat label={t("✗ Không match")} value={String(preview.stats.unmatched)} color={preview.stats.unmatched > 0 ? "#EF4444" : "#10B981"} />
              <Stat label={t("Tổng CP DN")} value={fmtVND(preview.stats.totalCost)} color="#F59E0B" />
            </div>
          </div>

          {preview.sheets.map((s: any) => (
            <div key={s.sheetName} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
              <div className="p-3 border-b border-gray-100 flex justify-between items-center">
                <h4 className="font-semibold">{s.sheetName} <span className="text-xs text-gray-500">→ month: {s.month}</span></h4>
                <span className="text-xs">{s.rows.length} {t("NV")}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500 uppercase">
                    <tr>
                      <th className="text-left p-2">{t("Match")}</th>
                      <th className="text-left p-2">{t("NV (Excel)")}</th>
                      <th className="text-left p-2">{t("Chức vụ")}</th>
                      <th className="text-right p-2">{t("Gross")}</th>
                      <th className="text-right p-2">{t("NC")}</th>
                      <th className="text-right p-2">{t("Thưởng")}</th>
                      <th className="text-right p-2">{t("Thực lĩnh")}</th>
                      <th className="text-right p-2">{t("CP DN")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.rows.map((r: any, i: number) => (
                      <tr key={i} className={`border-t border-gray-100 ${!r.matched_user ? "bg-red-50" : ""}`}>
                        <td className="p-2">
                          {r.matched_user ? <Check className="w-3 h-3 text-green-600 inline" /> : <AlertCircle className="w-3 h-3 text-red-600 inline" />}
                        </td>
                        <td className="p-2 font-medium">{r.empName}</td>
                        <td className="p-2 text-xs">{r.position}</td>
                        <td className="p-2 text-right tabular-nums">{fmtVND(r.gross_salary)}</td>
                        <td className="p-2 text-right">{r.working_days_actual}/{r.working_days_standard}</td>
                        <td className="p-2 text-right tabular-nums">{r.bonus_amount > 0 ? fmtVND(r.bonus_amount) : "—"}</td>
                        <td className="p-2 text-right tabular-nums font-semibold text-emerald-700">{fmtVND(r.net_salary)}</td>
                        <td className="p-2 text-right tabular-nums text-gray-500">{fmtVND(r.total_company_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {preview.stats.unmatched > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm">
              <b>{preview.stats.unmatched} {t("NV không match")}</b> {t("— họ sẽ bị skip khi commit. Nếu là NV đã nghỉ thì OK. Nếu cần import → tạo user trong /nhan-su trước.")}
            </div>
          )}

          <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 -mx-4 flex justify-between items-center">
            <button onClick={() => setStep("upload")} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">{t("← Chọn file khác")}</button>
            <button onClick={doCommit} disabled={pending} className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2">
              <Save className="w-4 h-4" /> {pending ? t("Đang import...") : `${t("COMMIT")} ${preview.stats.matched} ${t("dòng vào DB")}`}
            </button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-8 text-center">
          <Check className="w-16 h-16 text-green-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold">{t("Import xong!")}</h2>
          <p className="text-sm text-gray-600 mt-1">{result.imported} {t("dòng lương đã được cập nhật vào DB")}</p>
          <div className="flex gap-2 justify-center mt-4">
            <button onClick={() => { setStep("upload"); setFile(null); setFileBase64(""); }} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">{t("Import file khác")}</button>
            <a href="/bang-luong" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold">{t("Xem bảng lương")}</a>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: any) {
  return (
    <div className="bg-gray-50 rounded p-3 text-center">
      <div className="text-xs text-gray-500 uppercase">{label}</div>
      <div className="text-xl font-bold mt-1 tabular-nums" style={{ color }}>{value}</div>
    </div>
  );
}
