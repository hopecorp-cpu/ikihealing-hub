"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useLang } from "@/components/lang-provider";

type Tab = "product" | "staff";
const num = (v: any) => Number(String(v ?? "").toString().replace(/[^\d.-]/g, "")) || 0;
const fmt = (n: number) => Math.round(n).toLocaleString("vi-VN");

const SCHEMAS: Record<Tab, {
  label: string;
  cols: { key: string; label: string; w: string; type: "text" | "num" }[];
  net: (r: any) => number;
  xlsx: Record<string, number>;
}> = {
  product: {
    label: "Theo mặt hàng",
    cols: [
      { key: "sku", label: "Mã SKU", w: "w-32", type: "text" },
      { key: "product_name", label: "Tên hàng hóa", w: "min-w-[240px]", type: "text" },
      { key: "unit", label: "ĐVT", w: "w-20", type: "text" },
      { key: "quantity", label: "SL", w: "w-20", type: "num" },
      { key: "gross_amount", label: "Tiền hàng", w: "w-32", type: "num" },
      { key: "discount", label: "Khuyến mại", w: "w-28", type: "num" },
      { key: "tax", label: "Thuế", w: "w-28", type: "num" },
    ],
    net: r => num(r.gross_amount) - num(r.discount) - num(r.tax),
    xlsx: { sku: 0, product_name: 1, unit: 2, quantity: 3, gross_amount: 4, discount: 5, tax: 6 },
  },
  staff: {
    label: "Theo nhân viên",
    cols: [
      { key: "code", label: "Mã NV", w: "w-32", type: "text" },
      { key: "name", label: "Tên nhân viên", w: "min-w-[220px]", type: "text" },
      { key: "gross", label: "Tiền hàng", w: "w-32", type: "num" },
      { key: "shipping", label: "Phí GH", w: "w-28", type: "num" },
      { key: "discount", label: "Khuyến mại", w: "w-28", type: "num" },
      { key: "tax", label: "Thuế", w: "w-28", type: "num" },
    ],
    net: r => num(r.gross) - num(r.shipping) - num(r.discount) - num(r.tax),
    xlsx: { code: 0, name: 1, gross: 2, shipping: 3, discount: 4, tax: 5 },
  },
};

function prevMonth() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function RevenueManager() {
  const { t } = useLang();
  const [tab, setTab] = useState<Tab>("product");
  const [month, setMonth] = useState(prevMonth());
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [dirty, setDirty] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const sc = SCHEMAS[tab];

  const load = useCallback(async () => {
    setLoading(true); setMsg("");
    const r = await fetch(`/api/finance/revenue?type=${tab}&month=${month}`).then(x => x.json()).catch(() => null);
    setRows(r?.rows ?? []); setDirty(false); setLoading(false);
  }, [tab, month]);
  useEffect(() => { load(); }, [load]);

  const setCell = (i: number, key: string, v: string) => {
    setRows(rs => rs.map((r, j) => j === i ? { ...r, [key]: v } : r)); setDirty(true);
  };
  const addRow = () => { setRows(rs => [...rs, Object.fromEntries(sc.cols.map(c => [c.key, ""]))]); setDirty(true); };
  const delRow = (i: number) => { setRows(rs => rs.filter((_, j) => j !== i)); setDirty(true); };

  const save = async () => {
    setSaving(true); setMsg("");
    const r = await fetch(`/api/finance/revenue`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: tab, month, rows }),
    }).then(x => x.json()).catch(() => null);
    setSaving(false);
    if (r?.ok) { setMsg(`${t("✓ Đã lưu")} ${r.saved} ${t("dòng cho tháng")} ${month}`); setDirty(false); }
    else setMsg(t("Lỗi lưu: ") + (r?.error || t("thử lại")));
  };

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setMsg(t("Đang đọc file…"));
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
      const map = sc.xlsx;
      const nameCol = tab === "product" ? map.product_name : map.name;
      const grossCol = tab === "product" ? map.gross_amount : map.gross;
      const out: any[] = [];
      for (const row of aoa) {
        const name = row[nameCol];
        if (!name || typeof name !== "string" || !name.trim()) continue;
        if (typeof row[grossCol] !== "number") continue;
        if (tab === "staff" && !row[map.code]) continue;
        const o: any = {};
        for (const [k, c] of Object.entries(map)) o[k] = row[c] ?? "";
        out.push(o);
      }
      if (!out.length) { setMsg(t("Không đọc được dòng nào — kiểm tra đúng file MShopkeeper?")); }
      else { setRows(out); setDirty(true); setMsg(`${t("✓ Đã nạp")} ${out.length} ${t("dòng từ Excel — kiểm tra rồi bấm Lưu")}`); }
    } catch (err) { setMsg(t("Lỗi đọc Excel: ") + String(err).slice(0, 60)); }
    if (fileRef.current) fileRef.current.value = "";
  };

  const totalNet = rows.reduce((s, r) => s + sc.net(r), 0);
  const totalGross = rows.reduce((s, r) => s + num(tab === "product" ? r.gross_amount : r.gross), 0);
  const totalKM = rows.reduce((s, r) => s + num(r.discount), 0);
  const totalTax = rows.reduce((s, r) => s + num(r.tax), 0);
  const totalShip = rows.reduce((s, r) => s + num(r.shipping), 0);
  const dtChuaThue = totalGross - totalKM;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      <div>
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">{t("Tài chính · Kế toán nhập")}</p>
        <h1 className="text-2xl font-bold text-gray-900">{t("Doanh thu hàng tháng")}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t("Nhập tay hoặc nhập từ file Excel MShopkeeper. Lưu theo từng tháng.")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["product", "staff"] as Tab[]).map(tabKey => (
          <button key={tabKey} onClick={() => setTab(tabKey)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === tabKey ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {t(SCHEMAS[tabKey].label)}
          </button>
        ))}
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="ml-auto px-3 py-2 rounded-lg border border-gray-200 text-sm" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={addRow} className="px-3 py-1.5 rounded-lg text-sm bg-white border border-gray-200 hover:bg-gray-50">{t("+ Thêm dòng")}</button>
        <button onClick={() => fileRef.current?.click()} className="px-3 py-1.5 rounded-lg text-sm bg-white border border-gray-200 hover:bg-gray-50">{t("Nhập từ Excel")}</button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onImport} className="hidden" />
        <button onClick={save} disabled={saving || !dirty}
          className="px-4 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40">
          {saving ? t("Đang lưu…") : dirty ? t("Lưu thay đổi") : t("Đã lưu")}
        </button>
        {msg && <span className="text-xs text-gray-600">{msg}</span>}
      </div>

      {rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
          <SumBox label={t("Tiền hàng")} val={totalGross} />
          <SumBox label={t("− Khuyến mại")} val={-totalKM} muted />
          <SumBox label={t("Doanh thu (chưa thuế)")} val={dtChuaThue} highlight hint={t("khớp P&L")} />
          <SumBox label={t("− Thuế GTGT")} val={-totalTax} muted />
          <SumBox label={tab === "staff" ? t("DT thuần (sau thuế, phí GH)") : t("DT thuần (sau thuế)")} val={totalNet} />
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="text-left text-gray-500">
                {sc.cols.map(c => <th key={c.key} className={`py-2 px-2 font-medium ${c.type === "num" ? "text-right" : ""}`}>{t(c.label)}</th>)}
                <th className="py-2 px-2 text-right font-medium">{t("Doanh thu")}</th>
                <th className="py-2 px-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={sc.cols.length + 2} className="text-center text-gray-400 py-10">{t("Đang tải…")}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={sc.cols.length + 2} className="text-center text-gray-400 py-10">{t("Chưa có dữ liệu tháng")} {month}. {t("Bấm “+ Thêm dòng” hoặc “Nhập từ Excel”.")}</td></tr>
              ) : rows.map((r, i) => (
                <tr key={i} className="border-t hover:bg-gray-50/60">
                  {sc.cols.map(c => (
                    <td key={c.key} className="px-1 py-0.5">
                      <input value={r[c.key] ?? ""} onChange={e => setCell(i, c.key, e.target.value)}
                        className={`w-full px-1.5 py-1 rounded border border-transparent hover:border-gray-200 focus:border-indigo-400 focus:bg-white outline-none ${c.type === "num" ? "text-right tabular-nums" : ""} ${c.w}`}
                        inputMode={c.type === "num" ? "numeric" : "text"} />
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right tabular-nums font-medium text-gray-800 whitespace-nowrap">{fmt(sc.net(r))}</td>
                  <td className="px-1 py-1 text-center">
                    <button onClick={() => delRow(i)} className="text-gray-300 hover:text-red-500" title={t("Xoá dòng")}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="sticky bottom-0 bg-gray-50">
                <tr className="border-t font-semibold text-gray-800">
                  <td className="py-2 px-2" colSpan={sc.cols.length - 1}>{t("TỔNG")} ({rows.length} {t("dòng")})</td>
                  <td className="py-2 px-2 text-right tabular-nums">{fmt(totalGross)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{fmt(totalNet)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      <p className="text-xs text-gray-400">
        {t("Doanh thu (cột phải) tự tính = Tiền hàng −")} {tab === "staff" ? t("Phí GH − ") : ""}{t("Khuyến mại − Thuế. Mặt hàng lưu vào kho chung (hiện ở trang “DT theo mặt hàng”); Nhân viên lưu riêng cho kế toán.")}
      </p>
    </div>
  );
}

function SumBox({ label, val, highlight, muted, hint }: { label: string; val: number; highlight?: boolean; muted?: boolean; hint?: string }) {
  return (
    <div className={`rounded-xl border p-3 ${highlight ? "border-emerald-300 bg-emerald-50" : "border-gray-200 bg-white"}`}>
      <p className="text-[11px] text-gray-500 leading-tight">{label}{hint && <span className="text-emerald-600 font-medium"> · {hint}</span>}</p>
      <p className={`text-lg font-bold tabular-nums mt-0.5 ${highlight ? "text-emerald-700" : muted ? "text-gray-400" : "text-gray-900"}`}>{fmt(val)}</p>
    </div>
  );
}
