"use client";
import { useState, useTransition } from "react";
import { ApexChart } from "@/components/ui/chart";
import { saveBalanceSheet } from "./actions";
import { useLang } from "@/components/lang-provider";

type Pnl = { month: string; label: string; revenue: number; cogs: number; profit: number };
type Bal = { totalAssets?: number; equity?: number; inventory?: number; receivables?: number; payables?: number; cash?: number; debt?: number };

const FIELDS: { key: keyof Bal; label: string }[] = [
  { key: "totalAssets", label: "Tổng tài sản" }, { key: "equity", label: "Vốn chủ sở hữu" },
  { key: "inventory", label: "Tồn kho" }, { key: "receivables", label: "Phải thu" },
  { key: "payables", label: "Phải trả" }, { key: "cash", label: "Tiền & tương đương" }, { key: "debt", label: "Nợ vay" },
];
const trM = (n: number) => (n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 0 });
const pct = (n: number | null) => n == null ? "—" : (Math.round(n * 1000) / 10) + "%";
const x = (n: number | null) => n == null ? "—" : (Math.round(n * 100) / 100) + "x";

export default function FinancialRatios({ pnl, balance }: { pnl: Pnl[]; balance: Record<string, Bal> }) {
  const { t, ml, locale } = useLang();
  const months = pnl.map(p => p.month);
  const [editMonth, setEditMonth] = useState<string>(months[months.length - 1] || "");
  const [form, setForm] = useState<Bal>(balance[editMonth] ? { ...mapToM(balance[editMonth]) } : {});
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function pickMonth(m: string) { setEditMonth(m); setForm(balance[m] ? mapToM(balance[m]) : {}); setMsg(null); }
  function save() {
    const data: Record<string, number> = {};
    for (const f of FIELDS) data[f.key] = Math.round((Number(form[f.key]) || 0) * 1e6);
    start(async () => { const r = await saveBalanceSheet(editMonth, data); setMsg(r.ok ? t("Đã lưu. Tải lại trang để cập nhật chỉ số.") : "" + r.error); });
  }

  const rows = pnl.map(p => {
    const b = balance[p.month] || {};
    const ta = b.totalAssets || 0, eq = b.equity || 0, inv = b.inventory || 0, debt = b.debt || 0;
    const ros = p.revenue ? p.profit / p.revenue : null;
    const roa = ta ? p.profit / ta : null;
    const roe = eq ? p.profit / eq : null;
    const at = ta ? p.revenue / ta : null;
    const em = eq ? ta / eq : null;
    const invT = inv ? p.cogs / inv : null;
    const debtR = ta ? debt / ta : null;
    return { ...p, has: !!(ta && eq), ros, roa, roe, at, em, invT, debtR };
  });
  const latest = [...rows].reverse().find(r => r.has);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-10 space-y-5">
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <h2 className="font-bold text-gray-900 mb-1">{t("Chỉ số quản trị tài chính (ROE · ROA · DuPont)")}</h2>
        <p className="text-xs text-gray-500 mb-4">{t("Kết hợp P&L + số cân đối kế toán nhập tay. Đơn vị nhập:")} <b>{t("triệu đồng")}</b>.</p>

        {latest && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 mb-4 text-sm">
            <div className="font-semibold text-indigo-900 mb-1">{t("Phân tích DuPont —")} {ml(t(latest.label))}</div>
            <div className="text-gray-700">ROE <b>{pct(latest.roe)}</b> = {t("Biên LN")} <b>{pct(latest.ros)}</b> × {t("Vòng quay TS")} <b>{x(latest.at)}</b> × {t("Đòn bẩy")} <b>{x(latest.em)}</b></div>
            <div className="text-xs text-gray-500 mt-1">ROA {pct(latest.roa)} · {t("Vòng quay tồn kho")} {x(latest.invT)} · {t("Hệ số nợ")} {pct(latest.debtR)}</div>
            <div className="text-xs mt-1 text-indigo-700">{t("Năm hoá (×12):")} <b>ROE {pct(latest.roe != null ? latest.roe * 12 : null)}</b> · <b>ROA {pct(latest.roa != null ? latest.roa * 12 : null)}</b> <span className="text-gray-400">{t("(ước tính nếu duy trì nhịp tháng này cả năm)")}</span></div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr><th className="text-left p-2">{t("Tháng")}</th><th className="text-right p-2">{t("DT (tr)")}</th><th className="text-right p-2">{t("LNST (tr)")}</th><th className="text-right p-2">ROS</th><th className="text-right p-2">ROA</th><th className="text-right p-2">ROE</th><th className="text-right p-2">{t("Vòng quay TS")}</th><th className="text-right p-2">{t("Đòn bẩy")}</th><th className="text-right p-2">{t("Hệ số nợ")}</th></tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.month} className="border-t border-gray-100">
                  <td className="p-2 font-medium">{ml(t(r.label))}</td>
                  <td className="p-2 text-right tabular-nums">{trM(r.revenue)}</td>
                  <td className={`p-2 text-right tabular-nums ${r.profit < 0 ? "text-red-600" : ""}`}>{trM(r.profit)}</td>
                  <td className="p-2 text-right tabular-nums">{pct(r.ros)}</td>
                  <td className="p-2 text-right tabular-nums">{r.has ? pct(r.roa) : <span className="text-gray-300">{t("cần nhập")}</span>}</td>
                  <td className="p-2 text-right tabular-nums font-semibold">{r.has ? pct(r.roe) : "—"}</td>
                  <td className="p-2 text-right tabular-nums">{x(r.at)}</td>
                  <td className="p-2 text-right tabular-nums">{x(r.em)}</td>
                  <td className="p-2 text-right tabular-nums">{r.has ? pct(r.debtR) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5">
          <div className="text-sm font-semibold text-gray-700 mb-2">{t("Xu hướng ROS · ROA · ROE (%)")}</div>
          <ApexChart type="line" height={220}
            series={[
              { name: "ROS", data: rows.map(r => (r.ros != null ? Math.round(r.ros * 1000) / 10 : null)) },
              { name: "ROA", data: rows.map(r => (r.roa != null ? Math.round(r.roa * 1000) / 10 : null)) },
              { name: "ROE", data: rows.map(r => (r.roe != null ? Math.round(r.roe * 1000) / 10 : null)) },
            ]}
            options={{
              colors: ["#3b82f6", "#f59e0b", "#10b981"],
              xaxis: { categories: rows.map(r => t(r.label).replace("Tháng ", locale === "vi" ? "T" : "M")) },
              yaxis: { labels: { formatter: (v: number) => `${Math.round(v)}%` } },
              tooltip: { y: { formatter: (v: number) => `${v}%` } },
              markers: { size: 3, hover: { size: 5 } },
            }} />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <h3 className="font-semibold">{t("Nhập số cân đối kế toán")}</h3>
          <select value={editMonth} onChange={e => pickMonth(e.target.value)} className="p-2 border border-gray-200 rounded-lg text-sm">
            {pnl.map(p => <option key={p.month} value={p.month}>{ml(t(p.label))}</option>)}
          </select>
          <span className="text-xs text-gray-400">{t("đơn vị: triệu đồng")}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {FIELDS.map(f => (
            <div key={f.key}>
              <label className="text-xs text-gray-600">{t(f.label)}</label>
              <input type="number" inputMode="numeric" value={(form[f.key] as any) ?? ""} onFocus={e => e.target.select()}
                onChange={e => setForm({ ...form, [f.key]: e.target.value === "" ? undefined : +e.target.value })}
                className="w-full p-2 border border-gray-200 rounded-lg text-sm text-right" placeholder="0" />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button onClick={save} disabled={pending} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50">{pending ? t("Đang lưu…") : t("Lưu")}</button>
          {msg && <span className="text-sm">{msg}</span>}
        </div>
      </div>
    </div>
  );
}

function mapToM(b: Bal): Bal { const o: any = {}; for (const k of Object.keys(b)) o[k] = b[k as keyof Bal] != null ? Math.round((b[k as keyof Bal] as number) / 1e6) : undefined; return o; }
