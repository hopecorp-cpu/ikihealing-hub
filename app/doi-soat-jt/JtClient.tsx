"use client";
import { useState, useMemo } from "react";
import { useLang } from "@/components/lang-provider";

type R = { waybill_no: string; status_name: string; status_group: string; receiver_name: string | null; receiver_phone: string | null; receiver_address: string | null; goods_name: string | null; cod_value: number; real_cod_value: number; order_create_time: string | null };

const GROUPS = [
  { k: "", l: "Tất cả" }, { k: "delivered", l: "Đã giao" }, { k: "returned", l: "Hoàn hàng" },
  { k: "cancelled", l: "Đã hủy" }, { k: "transit", l: "Đang VC" }, { k: "other", l: "Vấn đề" },
];
const badge: Record<string, string> = { delivered: "bg-emerald-100 text-emerald-700", returned: "bg-red-100 text-red-700", cancelled: "bg-gray-100 text-gray-600", transit: "bg-amber-100 text-amber-700", other: "bg-purple-100 text-purple-700" };
const vnd = (n: number) => (n || 0) > 0 ? (n).toLocaleString("vi-VN") + "đ" : "—";

export default function JtClient({ rows }: { rows: R[] }) {
  const { t } = useLang();
  const [q, setQ] = useState("");
  const [grp, setGrp] = useState("");

  const list = useMemo(() => rows.filter(r =>
    (!grp || r.status_group === grp) &&
    (!q || (r.receiver_name || "").toLowerCase().includes(q.toLowerCase()) || (r.receiver_phone || "").includes(q) || (r.waybill_no || "").includes(q) || (r.goods_name || "").toLowerCase().includes(q.toLowerCase()))
  ), [rows, q, grp]);

  function exportCsv() {
    const head = [t("Mã vận đơn"), t("Trạng thái"), t("Người nhận"), t("SĐT"), t("Địa chỉ"), t("Sản phẩm"), t("COD"), t("COD thực thu"), t("Ngày tạo")];
    const lines = list.map(r => [r.waybill_no, r.status_name, r.receiver_name || "", r.receiver_phone || "", r.receiver_address || "", r.goods_name || "", r.cod_value || 0, r.real_cod_value || 0, r.order_create_time || ""]);
    const csv = "﻿" + [head, ...lines].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `doi-soat-jt-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4 space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="text-sm font-semibold mr-2">{t("Vận đơn chi tiết")}</div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={t("Tìm tên/SĐT/mã VĐ/SP…")} className="p-2 border border-gray-200 rounded-lg text-sm" />
        <select value={grp} onChange={e => setGrp(e.target.value)} className="p-2 border border-gray-200 rounded-lg text-sm">
          {GROUPS.map(g => <option key={g.k} value={g.k}>{t(g.l)}</option>)}
        </select>
        <span className="text-xs text-gray-400">{list.length.toLocaleString("vi")} / {rows.length.toLocaleString("vi")}</span>
        <button onClick={exportCsv} className="ml-auto px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm">{t("Xuất Excel")}</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr><th className="text-left p-2">{t("Mã VĐ")}</th><th className="text-left p-2">{t("Trạng thái")}</th><th className="text-left p-2">{t("Người nhận")}</th><th className="text-left p-2">{t("Địa chỉ")}</th><th className="text-left p-2">{t("Sản phẩm")}</th><th className="text-right p-2">{t("COD")}</th><th className="text-left p-2">{t("Ngày")}</th></tr>
          </thead>
          <tbody>
            {list.slice(0, 800).map((r, i) => (
              <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="p-2 tabular-nums text-xs">{r.waybill_no}</td>
                <td className="p-2"><span className={`px-2 py-0.5 rounded text-xs ${badge[r.status_group] || "bg-gray-100"}`}>{r.status_name}</span></td>
                <td className="p-2"><div className="font-medium">{r.receiver_name || "—"}</div><div className="text-xs text-gray-400">{r.receiver_phone}</div></td>
                <td className="p-2 text-xs text-gray-500 max-w-[220px] truncate">{r.receiver_address}</td>
                <td className="p-2 text-xs max-w-[180px] truncate">{r.goods_name}</td>
                <td className="p-2 text-right tabular-nums">{vnd(r.cod_value)}</td>
                <td className="p-2 text-xs text-gray-500">{(r.order_create_time || "").slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length > 800 && <div className="p-2 text-center text-xs text-gray-400">{t("Hiện 800 dòng đầu — lọc hoặc Xuất Excel để xem hết.")}</div>}
      </div>
    </div>
  );
}
