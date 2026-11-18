"use client";
import { useState, useMemo } from "react";
import { useLang } from "@/components/lang-provider";

type R = { phone: string | null; name: string | null; hotline: string | null; last_message: string | null; last_contact: string | null };
const dmy = (s: string | null) => s ? new Date(s).toLocaleDateString("vi-VN") : "—";

export default function ContactsClient({ rows }: { rows: R[] }) {
  const { t } = useLang();
  const [q, setQ] = useState("");
  const [hotline, setHotline] = useState("");
  const [onlyPhone, setOnlyPhone] = useState(false);
  const hotlines = useMemo(() => [...new Set(rows.map(r => r.hotline).filter(Boolean))] as string[], [rows]);

  const list = useMemo(() => rows.filter(r =>
    (!hotline || r.hotline === hotline) &&
    (!onlyPhone || r.phone) &&
    (!q || (r.name || "").toLowerCase().includes(q.toLowerCase()) || (r.phone || "").includes(q))
  ), [rows, q, hotline, onlyPhone]);

  function exportCsv() {
    const head = [t("Tên"), t("SĐT"), t("Hotline"), t("Liên hệ cuối"), t("Tin nhắn cuối")];
    const lines = list.map(r => [r.name || "", r.phone || "", r.hotline || "", dmy(r.last_contact), (r.last_message || "").replace(/[\n",]/g, " ")]);
    const csv = "﻿" + [head, ...lines].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `danh-ba-khach-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={t("Tìm tên / SĐT…")} className="p-2 border border-gray-200 rounded-lg text-sm" />
        <select value={hotline} onChange={e => setHotline(e.target.value)} className="p-2 border border-gray-200 rounded-lg text-sm">
          <option value="">{t("Tất cả hotline")}</option>
          {hotlines.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={onlyPhone} onChange={e => setOnlyPhone(e.target.checked)} /> {t("Chỉ khách có SĐT")}</label>
        <span className="text-xs text-gray-400">{list.length.toLocaleString("vi")} / {rows.length.toLocaleString("vi")}</span>
        <button onClick={exportCsv} className="ml-auto px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm">{t("Xuất Excel (.csv)")}</button>
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr><th className="text-left p-3">{t("Tên khách")}</th><th className="text-left p-3">{t("SĐT")}</th><th className="text-left p-3">{t("Hotline")}</th><th className="text-left p-3">{t("Liên hệ cuối")}</th><th className="text-left p-3">{t("Tin nhắn cuối")}</th></tr>
          </thead>
          <tbody>
            {list.slice(0, 1000).map((r, i) => (
              <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="p-3 font-medium">{r.name || "—"}</td>
                <td className="p-3 tabular-nums">{r.phone || <span className="text-gray-300">—</span>}</td>
                <td className="p-3 text-xs">{r.hotline || "—"}</td>
                <td className="p-3 text-xs text-gray-500">{dmy(r.last_contact)}</td>
                <td className="p-3 text-xs text-gray-500 max-w-[280px] truncate">{r.last_message || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length > 1000 && <div className="p-2 text-center text-xs text-gray-400">{t("Hiện 1.000 dòng đầu — dùng tìm kiếm/lọc hoặc Xuất Excel để xem hết.")}</div>}
      </div>
    </div>
  );
}
