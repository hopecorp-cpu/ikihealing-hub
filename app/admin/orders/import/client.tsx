"use client";
import { useState, useTransition } from "react";
import { previewCsvImport, commitCsvImport } from "./actions";
import { Upload, FileSpreadsheet, Check, X, AlertCircle, ArrowRight, RotateCcw, Save } from "lucide-react";
import { fmtVND } from "@/lib/payroll";
import { useLang } from "@/components/lang-provider";

type Step = "upload" | "preview" | "done";

export function ImportWizard({ sales }: { sales: any[] }) {
  const { t } = useLang();
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<string>("auto");
  const [defaultSaleId, setDefaultSaleId] = useState("");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [csvContent, setCsvContent] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  const prepareFilePayload = async (f: File): Promise<{ csvContent?: string; fileBase64?: string; fileName: string }> => {
    const isExcel = /\.(xlsx|xls|xlsm|ods)$/i.test(f.name);
    if (isExcel) {
      const buf = await f.arrayBuffer();
      const base64 = Buffer.from(buf).toString("base64");
      return { fileBase64: base64, fileName: f.name };
    }
    const text = await f.text();
    return { csvContent: text, fileName: f.name };
  };

  const onUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setMsg({ text: t("Chọn file trước (CSV hoặc Excel)"), type: "err" }); return; }
    startTransition(async () => {
      try {
        const payload = await prepareFilePayload(file);

        setCsvContent(JSON.stringify(payload));
        const res = await previewCsvImport({ ...payload, forceFormat: format === "auto" ? undefined : format });
        if (res.success) {
          setPreview(res);
          setStep("preview");
        } else {
          setMsg({ text: "" + res.error, type: "err" });
        }
      } catch (err: any) {
        setMsg({ text: "" + t("Lỗi đọc file:") + " " + err.message, type: "err" });
      }
    });
  };

  const onCommit = () => {
    if (!confirm(`${t("Import")} ${preview.stats.total} ${t("đơn vào DB?")}\n\n${t("Doanh thu cuối:")} ${fmtVND(preview.stats.totalFinal)}\n${t("Khách hàng mới:")} ${preview.stats.uniqueCustomers}\n${defaultSaleId ? t("Sale: gán mặc định") : t("Không gán sale → bonus = 0")}`)) return;
    const cachedPayload = JSON.parse(csvContent || "{}");
    startTransition(async () => {
      const res = await commitCsvImport({
        ...cachedPayload,
        forceFormat: format === "auto" ? undefined : format,
        defaultSaleId: defaultSaleId || undefined,
        skipDuplicates
      });
      if (res.success) {
        setResult(res);
        setStep("done");
      } else {
        setMsg({ text: "" + (res as any).error, type: "err" });
      }
    });
  };

  const reset = () => {
    setStep("upload"); setFile(null); setCsvContent(""); setPreview(null); setResult(null); setMsg(null);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <FileSpreadsheet className="w-6 h-6 text-brand-600" /> {t("Import đơn hàng từ CSV")}
      </h1>

      <div className="flex items-center gap-2 text-sm">
        <StepBadge active={step === "upload"} done={step !== "upload"} num={1} label={t("Upload")} />
        <ArrowRight className="w-4 h-4 text-gray-400" />
        <StepBadge active={step === "preview"} done={step === "done"} num={2} label={t("Preview")} />
        <ArrowRight className="w-4 h-4 text-gray-400" />
        <StepBadge active={step === "done"} done={false} num={3} label={t("Done")} />
      </div>

      {step === "upload" && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-6 space-y-4">
          <form onSubmit={onUpload} className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t("Format file")}</label>
              <select value={format} onChange={e => setFormat(e.target.value)}
                className="mt-1 w-full p-2 border border-gray-200 rounded-lg text-sm">
                <option value="auto">{t("Tự nhận diện (recommended)")}</option>
                <option value="pancake">Pancake export</option>
                <option value="shopee">Shopee export</option>
                <option value="tiktok">TikTok Shop export</option>
                <option value="misa">MISA eShop export</option>
                <option value="generic">Generic CSV</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">{t("File CSV / Excel (.xlsx, .xls, .csv, .tsv)")}</label>
              <input type="file" accept=".csv,.txt,.tsv,.xlsx,.xls,.xlsm,.ods" onChange={e => setFile(e.target.files?.[0] || null)}
                className="mt-1 block w-full text-sm p-2 border border-gray-200 rounded-lg" />
              <p className="text-xs text-gray-500 mt-1">
                {t("Hỗ trợ trực tiếp Excel — không cần convert. Sheet đầu tiên sẽ được đọc.")}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">{t("Sale mặc định (gán cho mọi đơn nếu CSV không có sale)")}</label>
              <select value={defaultSaleId} onChange={e => setDefaultSaleId(e.target.value)}
                className="mt-1 w-full p-2 border border-gray-200 rounded-lg text-sm">
                <option value="">{t("— Không gán (bonus = 0) —")}</option>
                {sales.map((s: any) => <option key={s.id} value={s.id}>{s.full_name} ({s.position})</option>)}
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={skipDuplicates} onChange={e => setSkipDuplicates(e.target.checked)} />
              {t("Bỏ qua đơn đã tồn tại (order_code trùng)")}
            </label>

            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-800">
              <b>{t("Format CSV được hỗ trợ:")}</b>
              <ul className="mt-2 ml-4 list-disc space-y-1">
                <li><b>Pancake:</b> {t("Export từ Pancake → Đơn hàng → Xuất CSV")}</li>
                <li><b>Shopee:</b> {t("Shopee Seller Center → Đơn hàng → Xuất Excel → Save as CSV")}</li>
                <li><b>TikTok Shop:</b> {t("Seller Center → Orders → Export")}</li>
                <li><b>MISA:</b> {t("MISA eShop → Báo cáo → Xuất CSV")}</li>
                <li><b>Generic:</b> {t("Cần cột tối thiểu:")} <code>order_code, qty, gross_revenue, order_date</code></li>
              </ul>
              {t("Auto-detect cột tiếng Việt:")} <i>{t("Mã đơn hàng, Tên khách hàng, Số điện thoại, Sản phẩm, Số lượng, Đơn giá, Tổng tiền, Trạng thái, Ngày tạo, Kênh, ...")}</i>
            </div>

            {msg && <div className={`p-3 rounded text-sm ${msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg.text}</div>}

            <button type="submit" disabled={pending || !file}
              className="w-full py-3 bg-brand-600 text-white rounded-lg font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2">
              <Upload className="w-4 h-4" /> {pending ? t("Đang phân tích...") : t("Phân tích file")}
            </button>
          </form>
        </div>
      )}

      {step === "preview" && preview && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold">{t("Kết quả phân tích")}</h2>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Format: <b>{preview.result.format}</b></span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              <Stat label={t("Tổng đơn")} value={String(preview.stats.total)} color="#3B82F6" />
              <Stat label={t("Lỗi parse")} value={String(preview.stats.withErrors)} color={preview.stats.withErrors > 0 ? "#EF4444" : "#10B981"} />
              <Stat label={t("Tổng DT")} value={fmtVND(preview.stats.totalFinal)} color="#10B981" />
              <Stat label={t("KH mới")} value={String(preview.stats.uniqueCustomers)} color="#8B5CF6" />
              <Stat label="SKU" value={String(preview.stats.uniqueSKUs)} color="#F59E0B" />
            </div>
            {preview.stats.dateRange.from && (
              <div className="text-xs text-gray-500 mt-2">
                {t("Date range:")} <b>{preview.stats.dateRange.from}</b> → <b>{preview.stats.dateRange.to}</b>
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
            <div className="p-3 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-semibold text-sm">{t("Preview 20 đơn đầu")}</h3>
              <div className="text-xs text-gray-500">{preview.result.parsed.length} {t("đơn tổng")}</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500 uppercase">
                  <tr>
                    <th className="text-left p-2">{t("Mã đơn")}</th>
                    <th className="text-left p-2">{t("KH")}</th>
                    <th className="text-left p-2">{t("SP")}</th>
                    <th className="text-right p-2">{t("SL")}</th>
                    <th className="text-right p-2">{t("Đơn giá")}</th>
                    <th className="text-right p-2">Final</th>
                    <th className="text-left p-2">{t("Kênh")}</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">{t("Ngày")}</th>
                    <th className="text-left p-2">{t("Lỗi")}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.result.parsed.slice(0, 20).map((p: any, i: number) => (
                    <tr key={i} className={`border-t border-gray-100 ${p.errors.length > 0 ? "bg-red-50" : ""}`}>
                      <td className="p-2 tabular-nums">{p.order_code}</td>
                      <td className="p-2">
                        <div>{p.customer_name || "—"}</div>
                        <div className="text-gray-500">{p.customer_phone || ""}</div>
                      </td>
                      <td className="p-2">{p.product_name || p.product_sku || "—"}</td>
                      <td className="p-2 text-right">{p.quantity}</td>
                      <td className="p-2 text-right tabular-nums">{fmtVND(p.unit_price)}</td>
                      <td className="p-2 text-right tabular-nums font-semibold">{fmtVND(p.final_revenue)}</td>
                      <td className="p-2">{p.channel}</td>
                      <td className="p-2">{p.status}</td>
                      <td className="p-2">{p.order_date}</td>
                      <td className="p-2 text-red-600">{p.errors.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 -mx-4 flex justify-between items-center">
            <button onClick={reset} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">
              <RotateCcw className="w-4 h-4 inline mr-1" /> {t("Chọn file khác")}
            </button>
            <button onClick={onCommit} disabled={pending}
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2">
              <Save className="w-4 h-4" /> {pending ? t("Đang import...") : `${t("IMPORT")} ${preview.stats.total} ${t("ĐƠN VÀO DB")}`}
            </button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-8 text-center">
          <Check className="w-16 h-16 text-green-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold">{t("Import xong!")}</h2>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto">
            <Stat label="Inserted" value={String(result.inserted)} color="#10B981" />
            <Stat label="⏭ Skipped" value={String(result.skipped)} color="#6B7280" />
            <Stat label="Failed" value={String(result.failed)} color={result.failed > 0 ? "#EF4444" : "#10B981"} />
            <Stat label={t("KH mới")} value={String(result.customersCreated)} color="#8B5CF6" />
          </div>
          {result.failedRows?.length > 0 && (
            <details className="mt-4 text-left max-w-2xl mx-auto">
              <summary className="text-sm text-red-600 cursor-pointer">{t("Xem")} {result.failedRows.length} {t("đơn fail")}</summary>
              <ul className="text-xs mt-2 space-y-1">
                {result.failedRows.slice(0, 20).map((r: any, i: number) => (
                  <li key={i}>Row {r.row} ({r.code}): {r.error}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="flex gap-2 justify-center mt-6">
            <button onClick={reset} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">{t("Import thêm file")}</button>
            <a href="/sales" className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-semibold">{t("Xem đơn vừa import")}</a>
            <a href="/dashboard" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold">{t("Xem Dashboard")}</a>
          </div>
        </div>
      )}
    </div>
  );
}

function StepBadge({ active, done, num, label }: any) {
  return (
    <div className={`flex items-center gap-2 ${active ? "text-brand-700 font-bold" : done ? "text-green-700" : "text-gray-400"}`}>
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
        active ? "bg-brand-600 text-white" :
        done ? "bg-green-600 text-white" : "bg-gray-200"
      }`}>
        {done ? <Check className="w-3 h-3" /> : num}
      </span>
      {label}
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
