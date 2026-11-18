"use client";
import { useState, useMemo } from "react";
import { fmtVND } from "@/lib/payroll";
import { useLang } from "@/components/lang-provider";

type P = { name: string; customers: number; qty: number; orders: number; rev: number };
type G = { label: string; customers: number; qty: number; pct: number };

export default function ProductCustomersClient({ products, groups, totalCusts, totalOrders }: { products: P[]; groups: G[]; totalCusts: number; totalOrders: number }) {
  const { t } = useLang();
  const [q, setQ] = useState("");
  const list = useMemo(() => products.filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase())), [products, q]);

  function exportCsv() {
    const head = [t("Sản phẩm"), t("Số khách"), t("% khách"), t("Số lượng"), t("Số đơn"), t("Doanh thu")];
    const lines = list.map(p => [p.name, p.customers, totalCusts ? (p.customers / totalCusts * 100).toFixed(1) + "%" : "", p.qty, p.orders, p.rev]);
    const csv = "﻿" + [head, ...lines].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `khach-dung-san-pham-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">{t("Khách dùng sản phẩm")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("Số khách mua từng sản phẩm (từ MISA — đơn thật). Tổng")} <b>{totalCusts.toLocaleString("vi")}</b> {t("khách ·")} {totalOrders.toLocaleString("vi")} {t("đơn.")}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {groups.map((g, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-3">
            <div className="text-xs text-gray-500">{t(g.label)}</div>
            <div className="text-lg font-bold text-emerald-700">{g.customers.toLocaleString("vi")} {t("khách")}</div>
            <div className="text-[11px] text-gray-400">{g.pct}{t("% tổng · SL")} {g.qty.toLocaleString("vi")}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="text-sm font-semibold mr-2">{t("Tất cả sản phẩm")} ({products.length})</div>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t("Tìm sản phẩm…")} className="p-2 border border-gray-200 rounded-lg text-sm" />
          <button onClick={exportCsv} className="ml-auto px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm">{t("Xuất Excel")}</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr><th className="text-left p-2">{t("Sản phẩm")}</th><th className="text-right p-2">{t("Số khách")}</th><th className="text-right p-2">{t("% khách")}</th><th className="text-right p-2">{t("SL")}</th><th className="text-right p-2">{t("Đơn")}</th><th className="text-right p-2">{t("Doanh thu")}</th></tr>
            </thead>
            <tbody>
              {list.map((p, i) => (
                <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="p-2 font-medium max-w-[320px]">{p.name}</td>
                  <td className="p-2 text-right tabular-nums font-semibold">{p.customers.toLocaleString("vi")}</td>
                  <td className="p-2 text-right tabular-nums text-gray-500">{totalCusts ? (p.customers / totalCusts * 100).toFixed(1) + "%" : "—"}</td>
                  <td className="p-2 text-right tabular-nums">{p.qty.toLocaleString("vi")}</td>
                  <td className="p-2 text-right tabular-nums text-gray-400">{p.orders}</td>
                  <td className="p-2 text-right tabular-nums">{fmtVND(p.rev)}</td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-gray-400">{t("Không có sản phẩm")}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
