"use client";
import { useState, useTransition } from "react";
import { updateProduct, seedProductsFromExcel } from "./actions";
import { fmtVND } from "@/lib/payroll";
import { Edit2, Save, Sprout, X } from "lucide-react";
import { useLang } from "@/components/lang-provider";

export function ProductsClient({ products }: { products: any[] }) {
  const { t } = useLang();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");

  const seed = () => {
    if (!confirm(t("Seed/Update 42 sản phẩm từ file BC CHI PHÍ LỢI NHUẬN?"))) return;
    startTransition(async () => {
      const res = await seedProductsFromExcel();
      if (res.success) { setMsg({ text: `Insert ${res.inserted} ${t("mới")} · Update ${res.updated}`, type: "ok" }); setTimeout(() => location.reload(), 1000); }
      else setMsg({ text: "" + (res as any).error, type: "err" });
    });
  };

  const startEdit = (p: any) => {
    setEditing(p.id);
    setForm({ cost_price: p.cost_price || 0, unit_price: p.unit_price || 0, supplier: p.supplier || "", notes: p.notes || "" });
  };

  const save = (id: string) => {
    startTransition(async () => {
      const res = await updateProduct({ id, ...form });
      if (res.success) { setMsg({ text: t("Đã lưu"), type: "ok" }); setEditing(null); setTimeout(() => location.reload(), 800); }
      else setMsg({ text: "" + (res as any).error, type: "err" });
    });
  };

  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));

  const filtered = products.filter(p =>
    (!search || (p.name + p.sku).toLowerCase().includes(search.toLowerCase())) &&
    (!catFilter || p.category === catFilter)
  );

  return (
    <div className="space-y-4">
      {msg && <div className={`p-3 rounded text-sm ${msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg.text}</div>}

      <div className="flex justify-between gap-3 items-center flex-wrap">
        <div className="flex gap-2 flex-wrap flex-1">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("Tìm SKU / tên...")}
            className="px-3 py-1.5 border border-gray-200 rounded text-sm w-[280px]" />
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded text-sm">
            <option value="">{t("Tất cả nhóm")}</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="text-xs text-gray-500 self-center">{filtered.length}/{products.length} {t("SP")}</span>
        </div>
        <button onClick={seed} disabled={pending}
          className="px-4 py-2 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-semibold inline-flex items-center gap-2">
          <Sprout className="w-4 h-4" /> {t("Seed 42 SP từ file BC CHI PHÍ")}
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="text-left p-2">SKU</th>
              <th className="text-left p-2">{t("Sản phẩm")}</th>
              <th className="text-left p-2">{t("Nhóm")}</th>
              <th className="text-right p-2">{t("Giá bán")}</th>
              <th className="text-right p-2">{t("Giá vốn")}</th>
              <th className="text-right p-2">Margin</th>
              <th className="text-left p-2">Note</th>
              <th className="text-right p-2 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const margin = p.unit_price > 0 ? ((p.unit_price - (p.cost_price || 0)) / p.unit_price) * 100 : 0;
              const isLoss = margin < 0;
              return (
                <tr key={p.id} className={`border-t border-gray-100 ${editing === p.id ? "bg-yellow-50" : isLoss ? "bg-red-50" : ""}`}>
                  <td className="p-2 tabular-nums text-xs">{p.sku}</td>
                  <td className="p-2">
                    <div className="font-medium">{p.name}</div>
                  </td>
                  <td className="p-2 text-xs">
                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">{p.category || "—"}</span>
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {editing === p.id ? (
                      <input type="number" value={form.unit_price} onChange={e => setForm({...form, unit_price: +e.target.value})}
                        className="w-28 p-1 border border-gray-200 rounded text-sm text-right" />
                    ) : fmtVND(p.unit_price)}
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {editing === p.id ? (
                      <input type="number" value={form.cost_price} onChange={e => setForm({...form, cost_price: +e.target.value})}
                        className="w-28 p-1 border border-gray-200 rounded text-sm text-right" />
                    ) : (p.cost_price > 0 ? fmtVND(p.cost_price) : "—")}
                  </td>
                  <td className={`p-2 text-right font-bold ${isLoss ? "text-red-600" : margin >= 50 ? "text-emerald-700" : "text-orange-600"}`}>
                    {p.unit_price > 0 ? `${margin.toFixed(1)}%` : "—"}
                  </td>
                  <td className="p-2 text-xs text-gray-500 max-w-[200px] truncate">{p.notes}</td>
                  <td className="p-2 text-right">
                    {editing === p.id ? (
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => save(p.id)} disabled={pending} className="text-xs px-2 py-1 bg-emerald-600 text-white rounded"><Save className="w-3 h-3 inline" /></button>
                        <button onClick={() => setEditing(null)} className="text-xs px-2 py-1 bg-gray-200 rounded"><X className="w-3 h-3 inline" /></button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(p)} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded">
                        <Edit2 className="w-3 h-3 inline" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="p-12 text-center text-gray-400">
                {products.length === 0 ? t("Chưa có SP — bấm 'Seed 42 SP' để import từ file") : t("Không tìm thấy SP")}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
