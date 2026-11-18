"use client";
import { useState, useMemo } from "react";
import { useLang } from "@/components/lang-provider";

type S = { sku: string; name: string; unit: string; opening: number; inQty: number; outQty: number; closing: number };

export default function StockClient({ items }: { items: S[] }) {
  const { t } = useLang();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"" | "low" | "out">("");
  const list = useMemo(() => items.filter(p =>
    (!q || p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase())) &&
    (filter === "" || (filter === "out" ? p.closing <= 0 : p.closing > 0 && p.closing <= 10))
  ), [items, q, filter]);

  function exportCsv() {
    const head = [t("Mã hàng"), t("Tên hàng"), t("ĐVT"), t("Tồn đầu kỳ"), t("Nhập"), t("Xuất"), t("Tồn cuối kỳ")];
    const lines = list.map(p => [p.sku, p.name, p.unit, p.opening, p.inQty, p.outQty, p.closing]);
    const csv = "﻿" + [head, ...lines].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `ton-kho-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4 space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="text-sm font-semibold mr-2">{t("Tồn kho theo sản phẩm")}</div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={t("Tìm mã/tên SP…")} className="p-2 border border-gray-200 rounded-lg text-sm" />
        <select value={filter} onChange={e => setFilter(e.target.value as any)} className="p-2 border border-gray-200 rounded-lg text-sm">
          <option value="">{t("Tất cả")}</option>
          <option value="low">{t("Sắp hết (≤10)")}</option>
          <option value="out">{t("Hết hàng (≤0)")}</option>
        </select>
        <span className="text-xs text-gray-400">{list.length} {t("SP")}</span>
        <button onClick={exportCsv} className="ml-auto px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm">{t("Xuất Excel")}</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr><th className="text-left p-2">{t("Mã")}</th><th className="text-left p-2">{t("Tên hàng")}</th><th className="text-left p-2">{t("ĐVT")}</th><th className="text-right p-2">{t("Tồn đầu")}</th><th className="text-right p-2">{t("Nhập")}</th><th className="text-right p-2">{t("Xuất")}</th><th className="text-right p-2">{t("Tồn cuối")}</th></tr>
          </thead>
          <tbody>
            {list.map((p, i) => {
              const low = p.closing > 0 && p.closing <= 10, out = p.closing <= 0;
              return (
                <tr key={i} className={`border-t border-gray-100 hover:bg-gray-50 ${out ? "bg-red-50" : low ? "bg-amber-50" : ""}`}>
                  <td className="p-2 tabular-nums text-xs">{p.sku}</td>
                  <td className="p-2 font-medium max-w-[300px]">{p.name}</td>
                  <td className="p-2 text-xs text-gray-500">{p.unit}</td>
                  <td className="p-2 text-right tabular-nums text-gray-400">{p.opening.toLocaleString("vi")}</td>
                  <td className="p-2 text-right tabular-nums text-blue-600">{p.inQty ? "+" + p.inQty.toLocaleString("vi") : "—"}</td>
                  <td className="p-2 text-right tabular-nums text-gray-600">{p.outQty ? "−" + p.outQty.toLocaleString("vi") : "—"}</td>
                  <td className={`p-2 text-right tabular-nums font-bold ${out ? "text-red-600" : low ? "text-amber-600" : "text-emerald-700"}`}>{p.closing.toLocaleString("vi")}{out ? " " : low ? " " : ""}</td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-gray-400">{t("Không có sản phẩm")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
