"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useTransition } from "react";
import {
  uploadBankStatement, convertCreditTxnsToOrders, convertDebitTxnsToExpenses,
  markAsInternalTransfer, markAsIgnored, updateTxnCategory, autoMatchTransactions,
  previewBankFile, uploadBankWithSheet, renameCategory, bulkUpdateCategory
} from "./actions";
import { Edit2, Settings as SettingsIcon, Save as SaveIcon } from "lucide-react";
import { fmtVND } from "@/lib/payroll";
import { Upload, Check, X, TrendingUp, TrendingDown, FileText, Repeat, Trash2, ArrowRight, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

const REVENUE_CATEGORIES = [
  { v: "revenue_order",   l: "Đơn hàng" },
  { v: "revenue_ecom",    l: "E-commerce (Shopee/Lazada/TikTok)" },
  { v: "revenue_course",  l: "Khoá học" },
  { v: "revenue_other",   l: "Thu khác" },
  { v: "internal_transfer", l: "Chuyển nội bộ (không tính)" },
  { v: "ignored",         l: "Bỏ qua" }
];

const EXPENSE_CATEGORIES = [
  { v: "expense_marketing", l: "Marketing (FB/Google/TikTok ads)" },
  { v: "expense_salary",    l: "Lương + Thưởng" },
  { v: "expense_logistics", l: "Vận chuyển (GHN/GHTK/Viettel Post)" },
  { v: "expense_office",    l: "Văn phòng (điện/nước/internet)" },
  { v: "expense_software",  l: "Phần mềm (MISA/Canva/Notion)" },
  { v: "expense_material",  l: "Nguyên liệu / Nhập hàng" },
  { v: "expense_tax",       l: "Thuế / BHXH" },
  { v: "expense_other",     l: "Chi khác" },
  { v: "internal_transfer", l: "Chuyển nội bộ (không tính)" },
  { v: "ignored",           l: "Bỏ qua" }
];

const CAT_LABELS: Record<string, string> = Object.fromEntries(
  [...REVENUE_CATEGORIES, ...EXPENSE_CATEGORIES].map(c => [c.v, c.l])
);

export function BankReconcileClient({ txns, statements, expenses, sales, revenueByCategory, expenseByCategory, month, currentTab, totalThu, totalChi, allCategoriesInUse }: any) {
  const { t: tDich } = useLang();
  const { t } = useLang();
  const [tab, setTab] = useState(currentTab || "review");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [showCatManager, setShowCatManager] = useState(false);

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };
  const clearSelection = () => setSelectedIds(new Set());

  const unmatched = txns.filter((t: any) => !t.reviewed);
  const credits = txns.filter((t: any) => t.type === "credit" && t.category !== "internal_transfer" && t.category !== "ignored");
  const debits = txns.filter((t: any) => t.type === "debit" && t.category !== "internal_transfer" && t.category !== "ignored");
  const internal = txns.filter((t: any) => t.category === "internal_transfer" || t.category === "ignored");

  let displayed: any[] = [];
  if (tab === "review") displayed = unmatched;
  else if (tab === "thu") displayed = credits;
  else if (tab === "chi") displayed = debits;
  else if (tab === "internal") displayed = internal;

  return (
    <div className="space-y-4">
      <UploadStatementBar />

      <div className="flex justify-between items-center border-b border-gray-200">
        <div className="flex gap-1 overflow-x-auto">
          <TabBtn active={tab === "review"} onClick={() => { setTab("review"); clearSelection(); }}
            label={`${t("Chờ phân loại")} (${unmatched.length})`} highlight={unmatched.length > 0} />
          <TabBtn active={tab === "thu"} onClick={() => { setTab("thu"); clearSelection(); }}
            label={`${t("Tiền VÀO Thu")} (${credits.length})`} color="emerald" />
          <TabBtn active={tab === "chi"} onClick={() => { setTab("chi"); clearSelection(); }}
            label={`${t("Tiền RA Chi")} (${debits.length})`} color="red" />
          <TabBtn active={tab === "internal"} onClick={() => { setTab("internal"); clearSelection(); }}
            label={`${t("Nội bộ / Bỏ qua")} (${internal.length})`} />
        </div>
        <button onClick={() => setShowCatManager(true)}
          className="text-xs px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded hover:bg-purple-100 inline-flex items-center gap-1">
          <SettingsIcon className="w-3 h-3" /> {t("Quản lý nhóm")}
        </button>
      </div>

      {showCatManager && <CategoryManager categories={allCategoriesInUse} onClose={() => setShowCatManager(false)} onSuccess={setMsg} />}

      {msg && (
        <div className={`p-3 rounded text-sm flex items-start gap-2 ${msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {msg.type === "ok" ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <AlertCircle className="w-4 h-4 mt-0.5" />}
          {msg.text}
        </div>
      )}

      {selectedIds.size > 0 && (
        <BulkActionBar
          selectedIds={Array.from(selectedIds)}
          selectedTxns={txns.filter((t: any) => selectedIds.has(t.id))}
          sales={sales}
          onClear={clearSelection}
          onMsg={setMsg}
          pending={pending}
          startTransition={startTransition}
        />
      )}

      {displayed.length > 0 && (() => {
        const cr = displayed.filter((t: any) => t.type === "credit");
        const db = displayed.filter((t: any) => t.type === "debit");
        const crTotal = cr.reduce((s: number, t: any) => s + Math.abs(t.amount), 0);
        const dbTotal = db.reduce((s: number, t: any) => s + Math.abs(t.amount), 0);
        return (
          <div className="flex gap-3 text-sm bg-blue-50 border border-blue-200 rounded-lg p-3">
            <span className="font-semibold">{t("Tab này:")}</span>
            <span><b>{displayed.length}</b> {t("GD")}</span>
            {cr.length > 0 && <span className="text-emerald-700">· {t("Thu:")} <b>{cr.length}</b> · {fmtVND(crTotal)}</span>}
            {db.length > 0 && <span className="text-red-700">· {t("Chi:")} <b>{db.length}</b> · {fmtVND(dbTotal)}</span>}
            <span className="text-gray-500">· {t("Net:")} <b className={crTotal - dbTotal >= 0 ? "text-emerald-700" : "text-red-700"}>{fmtVND(crTotal - dbTotal)}</b></span>
          </div>
        );
      })()}

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="w-10 p-2">
                  <input type="checkbox"
                    checked={displayed.length > 0 && displayed.every((t: any) => selectedIds.has(t.id))}
                    onChange={e => {
                      if (e.target.checked) setSelectedIds(new Set([...selectedIds, ...displayed.map((t: any) => t.id)]));
                      else clearSelection();
                    }} />
                </th>
                <th className="text-left p-2">{t("Ngày")}</th>
                <th className="text-left p-2">{t("Đối tác / Diễn giải")}</th>
                <th className="text-right p-2">{t("Số tiền")}</th>
                <th className="text-left p-2">{t("Phân loại")}</th>
                <th className="text-center p-2">{t("Status")}</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((tx: any) => (
                <tr key={tx.id} className={`border-t border-gray-100 hover:bg-gray-50 ${selectedIds.has(tx.id) ? "bg-blue-50" : ""}`}>
                  <td className="p-2 text-center">
                    <input type="checkbox" checked={selectedIds.has(tx.id)} onChange={() => toggle(tx.id)} />
                  </td>
                  <td className="p-2 text-xs">{tx.txn_date}</td>
                  <td className="p-2 max-w-md">
                    <div className="font-medium">{tx.counterparty || "—"}</div>
                    <div className="text-xs text-gray-500 truncate">{tDich(tx.description)}</div>
                  </td>
                  <td className={`p-2 text-right tabular-nums font-semibold ${tx.type === "credit" ? "text-emerald-700" : "text-red-600"}`}>
                    {tx.type === "credit" ? "+" : "-"}{fmtVND(Math.abs(tx.amount))}
                  </td>
                  <td className="p-2 text-xs">
                    <CategoryBadge
                      txn={tx}
                      allCategories={allCategoriesInUse}
                      onUpdate={(newCat) => {
                        startTransition(async () => {
                          await updateTxnCategory(tx.id, newCat);
                          setMsg({ text: `${t("Đã đổi nhóm thành")} "${CAT_LABELS[newCat] ? t(CAT_LABELS[newCat]) : newCat}"`, type: "ok" });
                          setTimeout(() => location.reload(), 800);
                        });
                      }}
                    />
                  </td>
                  <td className="p-2 text-center">
                    {tx.matched_order_id ? <span className="text-emerald-600">Order</span> :
                     tx.matched_expense_id ? <span className="text-orange-600">Expense</span> :
                     tx.reviewed ? <span className="text-blue-600">✓ Reviewed</span> :
                     <span className="text-orange-500"></span>}
                  </td>
                </tr>
              ))}
              {displayed.length === 0 && (
                <tr><td colSpan={6} className="p-12 text-center text-gray-400">{t("Không có giao dịch nào ở tab này")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
          <h3 className="font-semibold mb-3 text-sm">{t("Tiền vào theo nhóm")}</h3>
          <CategoryBars data={revenueByCategory} total={totalThu} color="#10B981" />
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
          <h3 className="font-semibold mb-3 text-sm">{t("Tiền ra theo nhóm")}</h3>
          <CategoryBars data={expenseByCategory} total={totalChi} color="#EF4444" />
        </div>
      </div>
    </div>
  );
}

function UploadStatementBar() {
  const { t: tDich } = useLang();
  const { t } = useLang();
  const [file, setFile] = useState<File | null>(null);
  const [bank, setBank] = useState("VCB");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [sheets, setSheets] = useState<{ name: string; rowCount: number }[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [filePayload, setFilePayload] = useState<any>(null);

  const onFileSelected = async (f: File | null) => {
    setFile(f);
    setDebugInfo(null);
    setSheets([]);
    setMsg(null);
    if (!f) return;

    const isExcel = /\.(xlsx|xls|xlsm|ods)$/i.test(f.name);
    let payload: any = { fileName: f.name };
    if (isExcel) {
      const buf = await f.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      payload.fileBase64 = btoa(binary);
    } else {
      payload.csvContent = await f.text();
    }
    setFilePayload(payload);

    startTransition(async () => {
      const res = await previewBankFile(payload);
      if (res.success) {
        setDebugInfo(res);
        if (res.sheets && res.sheets.length > 1) {
          setSheets(res.sheets);
          setSelectedSheet(res.sheets[0].name);
        }
      }
    });
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !filePayload) return;
    setMsg(null);
    startTransition(async () => {
      let res;
      if (selectedSheet && sheets.length > 1) {
        res = await uploadBankWithSheet({ bank, fileBase64: filePayload.fileBase64, fileName: file.name, sheetName: selectedSheet });
      } else {
        res = await uploadBankStatement({ bank, ...filePayload });
      }
      if (res.success) {
        setMsg({ text: `${t("Đã import")} ${res.parsed} ${t("GD")} · ${t("Vào")} ${fmtVND(res.totalCredit || 0)} · ${t("Ra")} ${fmtVND(res.totalDebit || 0)} — ${t("Reload trang...")}`, type: "ok" });
        setFile(null);
        setDebugInfo(null);
        setSheets([]);
        setTimeout(() => location.reload(), 1500);
      } else {
        setMsg({ text: "" + (res as any).error, type: "err" });
        if ((res as any).rawPreview) {
          setDebugInfo({
            lines: (res as any).rawPreview,
            headerRowIdx: (res as any).headerRowIdx,
            headersDetected: (res as any).headersDetected,
            errorMode: true
          });
        }
      }
    });
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
      <form onSubmit={handleUpload} className="flex items-end gap-2 flex-wrap">
        <div>
          <label className="text-xs text-gray-600">{t("Ngân hàng")}</label>
          <select value={bank} onChange={e => setBank(e.target.value)} className="block mt-1 p-2 border border-gray-200 rounded text-sm">
            <option value="VCB">Vietcombank</option>
            <option value="MBB">MB Bank</option>
            <option value="TCB">Techcombank</option>
            <option value="ACB">ACB</option>
            <option value="VTB">Vietinbank</option>
            <option value="BIDV">BIDV</option>
            <option value="OTHER">{t("Khác")}</option>
          </select>
        </div>
        <div className="flex-1 min-w-[240px]">
          <label className="text-xs text-gray-600">{t("Upload sao kê (CSV hoặc Excel .xlsx)")}</label>
          <input type="file" accept=".csv,.txt,.tsv,.xlsx,.xls,.xlsm,.ods"
            onChange={e => onFileSelected(e.target.files?.[0] || null)}
            className="block mt-1 w-full text-sm p-2 border border-gray-200 rounded" />
          <p className="text-[10px] text-gray-500 mt-0.5">
            {t("Export trực tiếp từ Internet Banking — Excel hoặc CSV đều được. Sao kê VCB/MB có header ở dòng 5-10 → tự skip")}
          </p>
        </div>
        {sheets.length > 1 && (
          <div>
            <label className="text-xs text-gray-600">{t("Sheet")} ({sheets.length} sheets)</label>
            <select value={selectedSheet} onChange={e => setSelectedSheet(e.target.value)}
              className="block mt-1 p-2 border border-gray-200 rounded text-sm">
              {sheets.map(s => <option key={s.name} value={s.name}>{s.name} ({s.rowCount} rows)</option>)}
            </select>
          </div>
        )}
        <button type="submit" disabled={pending || !file}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-1">
          <Upload className="w-4 h-4" /> {pending ? t("Đang xử lý...") : t("Upload + Auto-detect")}
        </button>
      </form>

      {msg && (
        <div className={`mt-2 p-2 rounded text-sm ${msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg.text}</div>
      )}

      {debugInfo && (
        <div className={`mt-3 border rounded-lg p-3 ${debugInfo.errorMode ? "bg-orange-50 border-orange-200" : "bg-blue-50 border-blue-200"}`}>
          <div className="text-xs font-semibold mb-2 flex items-center gap-2">
            {debugInfo.errorMode ? t("Cấu trúc file (để debug)") : t("Preview file")}
            {debugInfo.headerRowIdx >= 0 && (
              <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                {t("✓ Header tìm thấy ở dòng")} {debugInfo.headerRowIdx + 1}
              </span>
            )}
            {debugInfo.headerRowIdx === -1 && (
              <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                {t("KHÔNG tìm được dòng header")}
              </span>
            )}
          </div>
          {debugInfo.headersDetected && (
            <div className="text-xs mb-2">
              <b>{t("Cột phát hiện:")}</b> <span className="text-gray-600">{debugInfo.headersDetected.join(" | ")}</span>
            </div>
          )}
          <div className="overflow-x-auto bg-white border border-gray-200 rounded">
            <table className="w-full text-[10px] tabular-nums">
              <tbody>
                {(debugInfo.lines || []).slice(0, 15).map((line: string, i: number) => (
                  <tr key={i} className={`border-b border-gray-100 ${i === debugInfo.headerRowIdx ? "bg-green-100 font-bold" : ""}`}>
                    <td className="px-2 py-1 text-gray-400 w-10">{i + 1}</td>
                    <td className="px-2 py-1 break-all">{line || <span className="text-gray-300">{t("[trống]")}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {debugInfo.errorMode && (
            <div className="text-xs text-orange-800 mt-2">
              <b>{t("Cách fix:")}</b> {t('Mở file Excel → kiểm tra xem có sheet khác chứa data không (đôi khi VCB có sheet "Báo cáo" và sheet "Chi tiết") → upload lại và chọn sheet đúng. Hoặc anh chụp screenshot 15 dòng đầu file Excel gửi tôi, tôi sẽ chỉnh parser.')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BulkActionBar({ selectedIds, selectedTxns, sales, onClear, onMsg, pending, startTransition }: any) {
  const { t } = useLang();
  const [saleId, setSaleId] = useState("");
  const [revenueCategory, setRevenueCategory] = useState("revenue_order");
  const [expenseCategory, setExpenseCategory] = useState("expense_other");

  const allCredit = selectedTxns.every((tx: any) => tx.type === "credit");
  const allDebit = selectedTxns.every((tx: any) => tx.type === "debit");
  const totalAmount = selectedTxns.reduce((s: number, tx: any) => s + Math.abs(tx.amount), 0);

  const convertToOrders = () => {
    if (!confirm(`${t("Tạo")} ${selectedIds.length} ${t("đơn hàng từ")} ${selectedIds.length} ${t("giao dịch thu này?")}\n${t("Tổng:")} ${fmtVND(totalAmount)}\n${t("Sale:")} ${saleId ? sales.find((s: any) => s.id === saleId)?.full_name : t("không gán")}`)) return;
    startTransition(async () => {
      const res = await convertCreditTxnsToOrders({ txnIds: selectedIds, saleId: saleId || null });
      if (res.success) {
        onMsg({ text: `${t("Đã tạo")} ${res.created} ${t("đơn hàng.")} ${res.errors?.length ? `${res.errors.length} ${t("lỗi.")}` : ""}`, type: "ok" });
        onClear();
      } else {
        onMsg({ text: "" + res.error, type: "err" });
      }
    });
  };

  const convertToExpenses = () => {
    if (!confirm(`${t("Tạo")} ${selectedIds.length} ${t("chi phí từ")} ${selectedIds.length} ${t("giao dịch chi này?")}\n${t("Tổng:")} ${fmtVND(totalAmount)}\n${t("Nhóm:")} ${expenseCategory}`)) return;
    startTransition(async () => {
      const res = await convertDebitTxnsToExpenses({ txnIds: selectedIds, category: expenseCategory });
      if (res.success) {
        onMsg({ text: `${t("Đã tạo")} ${res.created} ${t("bản ghi chi phí")}`, type: "ok" });
        onClear();
      } else {
        onMsg({ text: "" + res.error, type: "err" });
      }
    });
  };

  const markInternal = () => {
    startTransition(async () => {
      await markAsInternalTransfer(selectedIds);
      onMsg({ text: `${t("Đã đánh dấu")} ${selectedIds.length} ${t("GD là chuyển nội bộ")}`, type: "ok" });
      onClear();
    });
  };

  const markIgnore = () => {
    startTransition(async () => {
      await markAsIgnored(selectedIds);
      onMsg({ text: `${t("Đã bỏ qua")} ${selectedIds.length} ${t("GD")}`, type: "ok" });
      onClear();
    });
  };

  return (
    <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl p-4 shadow-lg flex items-center gap-3 flex-wrap">
      <div className="flex-1 min-w-[180px]">
        <div className="font-bold text-lg">{selectedIds.length} {t("giao dịch chọn")}</div>
        <div className="text-xs opacity-80">{t("Tổng:")} {fmtVND(totalAmount)}</div>
      </div>

      {allCredit && (
        <div className="flex items-center gap-2 flex-wrap">
          <select value={saleId} onChange={e => setSaleId(e.target.value)}
            className="text-xs p-1.5 rounded bg-white text-gray-800">
            <option value="">{t("— Gán sale (option) —")}</option>
            {sales.map((s: any) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
          <button onClick={convertToOrders} disabled={pending}
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 rounded text-xs font-bold inline-flex items-center gap-1">
            <ArrowRight className="w-3 h-3" /> {t("Tạo")} {selectedIds.length} {t("đơn hàng")}
          </button>
        </div>
      )}

      {allDebit && (
        <div className="flex items-center gap-2 flex-wrap">
          <select value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)}
            className="text-xs p-1.5 rounded bg-white text-gray-800 max-w-[200px]">
            {EXPENSE_CATEGORIES.filter(c => c.v.startsWith("expense_")).map(c => <option key={c.v} value={c.v}>{t(c.l)}</option>)}
          </select>
          <button onClick={convertToExpenses} disabled={pending}
            className="px-3 py-1.5 bg-orange-500 hover:bg-orange-400 rounded text-xs font-bold inline-flex items-center gap-1">
            <ArrowRight className="w-3 h-3" /> {t("Tạo")} {selectedIds.length} {t("chi phí")}
          </button>
        </div>
      )}

      <button onClick={markInternal} disabled={pending}
        className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded text-xs font-semibold inline-flex items-center gap-1">
        <Repeat className="w-3 h-3" /> {t("Nội bộ")}
      </button>
      <button onClick={markIgnore} disabled={pending}
        className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded text-xs font-semibold inline-flex items-center gap-1">
        <Trash2 className="w-3 h-3" /> {t("Bỏ qua")}
      </button>
      <button onClick={onClear} className="px-2 py-1.5 hover:bg-white/20 rounded">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function CategoryBars({ data, total, color }: { data: Record<string, number>; total: number; color: string }) {
  const { t } = useLang();
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return <div className="text-center py-6 text-gray-400 text-sm">{t("Chưa có data")}</div>;
  return (
    <div className="space-y-2">
      {entries.map(([cat, amt]) => {
        const pct = total > 0 ? (amt / total) * 100 : 0;
        return (
          <div key={cat}>
            <div className="flex justify-between text-xs mb-0.5">
              <span>{CAT_LABELS[cat] ? t(CAT_LABELS[cat]) : cat}</span>
              <span className="font-semibold tabular-nums">{fmtVND(amt)} ({pct.toFixed(1)}%)</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full" style={{ width: `${pct}%`, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CategoryBadge({ txn, allCategories, onUpdate }: any) {
  const { t } = useLang();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(txn.category || "");
  const [customMode, setCustomMode] = useState(false);
  const [customVal, setCustomVal] = useState("");

  const currentLabel = CAT_LABELS[txn.category] ? t(CAT_LABELS[txn.category]) : (txn.category || t("Chưa phân loại"));
  const isRevenue = txn.type === "credit";
  const presets = isRevenue ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES;

  const presetSet = new Set([...REVENUE_CATEGORIES, ...EXPENSE_CATEGORIES].map((c: any) => c.v));
  const customList = (allCategories || []).filter((c: any) => !presetSet.has(c.cat));

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)}
        className={`group px-2 py-0.5 rounded inline-flex items-center gap-1 hover:ring-1 hover:ring-blue-300 ${
          txn.category === "internal_transfer" ? "bg-gray-100 text-gray-600" :
          txn.category === "ignored" ? "bg-gray-100 text-gray-400" :
          txn.category?.startsWith("revenue_") ? "bg-emerald-100 text-emerald-700" :
          txn.category?.startsWith("expense_") ? "bg-orange-100 text-orange-700" :
          "bg-gray-100"
        }`}>
        <span>{currentLabel}</span>
        <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-50" />
      </button>
    );
  }

  return (
    <div className="bg-white border-2 border-blue-400 rounded p-2 min-w-[240px] shadow-lg">
      {!customMode ? (
        <>
          <select value={val} onChange={e => setVal(e.target.value)}
            className="w-full p-1 border border-gray-200 rounded text-xs">
            <optgroup label={isRevenue ? t("Nhóm Thu") : t("Nhóm Chi")}>
              {presets.filter((c: any) => isRevenue ? c.v.startsWith("revenue_") : c.v.startsWith("expense_")).map((c: any) => (
                <option key={c.v} value={c.v}>{t(c.l)}</option>
              ))}
            </optgroup>
            {customList.length > 0 && (
              <optgroup label={t("Nhóm tự định nghĩa")}>
                {customList.map((c: any) => <option key={c.cat} value={c.cat}>{c.cat} ({c.count})</option>)}
              </optgroup>
            )}
            <optgroup label={t("Khác")}>
              <option value="internal_transfer">{t("Chuyển nội bộ")}</option>
              <option value="ignored">{t("Bỏ qua")}</option>
            </optgroup>
          </select>
          <div className="flex gap-1 mt-2">
            <button onClick={() => { onUpdate(val); setEditing(false); }}
              className="flex-1 px-2 py-1 bg-emerald-600 text-white rounded text-xs">{t("Lưu")}</button>
            <button onClick={() => setCustomMode(true)}
              className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">{t("+ Tạo mới")}</button>
            <button onClick={() => setEditing(false)}
              className="px-2 py-1 border border-gray-200 rounded text-xs">{t("Huỷ")}</button>
          </div>
        </>
      ) : (
        <>
          <label className="text-xs font-semibold">{t("Tên nhóm mới:")}</label>
          <input value={customVal} onChange={e => setCustomVal(e.target.value)}
            placeholder={t("VD: Phí ngân hàng / Tiền vận chuyển nội bộ")}
            autoFocus
            className="w-full mt-1 p-1 border border-gray-200 rounded text-xs" />
          <div className="text-[10px] text-gray-500 mt-1">
            {t("Đặt prefix")} <code>revenue_</code> {t("cho thu,")} <code>expense_</code> {t("cho chi")}
          </div>
          <div className="flex gap-1 mt-2">
            <button onClick={() => { if (customVal.trim()) { onUpdate(customVal.trim()); setEditing(false); } }}
              disabled={!customVal.trim()}
              className="flex-1 px-2 py-1 bg-emerald-600 text-white rounded text-xs disabled:opacity-50">{t("Lưu")}</button>
            <button onClick={() => setCustomMode(false)}
              className="px-2 py-1 border border-gray-200 rounded text-xs">{t("Quay lại")}</button>
          </div>
        </>
      )}
    </div>
  );
}

function CategoryManager({ categories, onClose, onSuccess }: any) {
  const { t } = useLang();
  const [renamingFrom, setRenamingFrom] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [pending, startTransition] = useTransition();

  const handleRename = (oldCat: string) => {
    if (!newName.trim() || newName.trim().length < 2) return;
    if (!confirm(`${t("Đổi tên")} "${oldCat}" ${t("thành")} "${newName.trim()}"?\n${t("Sẽ cập nhật toàn bộ GD có nhóm cũ.")}`)) return;
    startTransition(async () => {
      const res = await renameCategory({ oldCategory: oldCat, newCategory: newName.trim() });
      if (res.success) {
        onSuccess?.({ text: `${t("Đã đổi")} ${res.updated} ${t("GD từ")} "${oldCat}" → "${newName.trim()}"`, type: "ok" });
        setRenamingFrom(null);
        setNewName("");
        setTimeout(() => location.reload(), 800);
      } else {
        onSuccess?.({ text: "" + res.error, type: "err" });
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="border-b border-gray-200 p-4 flex justify-between items-center">
          <h2 className="font-bold">{t("Quản lý nhóm phân loại")}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto">
          <p className="text-xs text-gray-500 mb-3">
            {t("Đổi tên nhóm sẽ áp dụng cho TẤT CẢ GD đang dùng nhóm cũ. Có thể click trực tiếp badge phân loại ở mỗi dòng để đổi nhanh.")}
          </p>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="text-left p-2">{t("Nhóm hiện tại")}</th>
                <th className="text-right p-2">{t("Số GD")}</th>
                <th className="text-right p-2 w-32">{t("Hành động")}</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c: any) => (
                <tr key={c.cat} className="border-t border-gray-100">
                  {renamingFrom === c.cat ? (
                    <>
                      <td className="p-2" colSpan={2}>
                        <div className="flex gap-2 items-center">
                          <span className="text-xs text-gray-500">{c.cat} →</span>
                          <input value={newName} onChange={e => setNewName(e.target.value)} autoFocus
                            placeholder={t("Tên mới (VD: expense_bank_fee)")}
                            className="flex-1 p-1.5 border border-gray-300 rounded text-sm" />
                        </div>
                      </td>
                      <td className="p-2 text-right">
                        <button onClick={() => handleRename(c.cat)} disabled={pending || !newName.trim()}
                          className="text-xs px-2 py-1 bg-emerald-600 text-white rounded disabled:opacity-50 mr-1">
                          <SaveIcon className="w-3 h-3 inline" /> {t("Lưu")}
                        </button>
                        <button onClick={() => { setRenamingFrom(null); setNewName(""); }}
                          className="text-xs px-2 py-1 bg-gray-200 rounded">{t("Huỷ")}</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-2">
                        <div className="tabular-nums text-xs">{c.cat}</div>
                        <div className="text-xs text-gray-500">{CAT_LABELS[c.cat] ? t(CAT_LABELS[c.cat]) : t("(chưa có label)")}</div>
                      </td>
                      <td className="p-2 text-right tabular-nums">{c.count}</td>
                      <td className="p-2 text-right">
                        <button onClick={() => { setRenamingFrom(c.cat); setNewName(c.cat); }}
                          className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded inline-flex items-center gap-1">
                          <Edit2 className="w-3 h-3" /> {t("Đổi tên")}
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {categories.length === 0 && (
                <tr><td colSpan={3} className="p-8 text-center text-gray-400 text-sm">{t("Chưa có nhóm nào")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, label, highlight, color }: any) {
  const c = active
    ? color === "emerald" ? "border-emerald-600 text-emerald-700"
    : color === "red" ? "border-red-600 text-red-700"
    : "border-brand-600 text-brand-700"
    : "border-transparent text-gray-500 hover:text-gray-700";
  return (
    <button onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap ${c} ${highlight && !active ? "animate-pulse" : ""}`}>
      {label}
    </button>
  );
}
