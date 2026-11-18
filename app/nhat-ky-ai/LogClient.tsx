"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useMemo } from "react";
import Link from "next/link";
import { ScrollText, Download, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/kit";
import type { AppLogRow } from "@/lib/ai-apps";

const dong = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}đ`;

export default function LogClient({ log, cost }: {
  log: AppLogRow[];
  cost: { vnd: number; calls: number; ceiling: number; overPct: number | null };
}) {
  const { t: t } = useLang();
  const [q, setQ] = useState("");
  const [app, setApp] = useState("");

  const apps = useMemo(() => [...new Set(log.map((r) => r.app))].sort(), [log]);
  const rows = log.filter((r) =>
    (!app || r.app === app) &&
    (!q.trim() || `${r.user} ${r.app} ${r.q} ${r.a}`.toLowerCase().includes(q.toLowerCase().trim())));

  const exportCsv = () => {
    const esc = (s: string) => `"${String(s || "").replace(/"/g, '""')}"`;
    const csv = ["Thoi gian,Nguoi dung,App,Yeu cau,Tra loi"]
      .concat(rows.map((r) => [r.at, r.user, r.app, r.q, r.a].map(esc).join(",")))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `nhat-ky-ai-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const overTone = cost.overPct === null ? "" : cost.overPct >= 100 ? "text-rose-700 bg-rose-50" : cost.overPct >= 80 ? "text-amber-700 bg-amber-50" : "text-emerald-700 bg-emerald-50";

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <PageHeader
        title={t("Nhật ký AI")}
        subtitle={t("Ai đang dùng app nào, hỏi gì — và tháng này AI tiêu bao nhiêu tiền")}
        icon={ScrollText}
        actions={
          <Link href="/quan-tri-app-ai" className="text-[12px] px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-emerald-300">
            {t("Quản trị app")}
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
          <div className="text-[11px] uppercase tracking-wide text-gray-400">{t("Chi phí AI tháng này")}</div>
          <div className="text-2xl font-bold text-gray-800 tabular-nums">{dong(cost.vnd)}</div>
          <div className="text-[12px] text-gray-500">{cost.calls} {t("lượt gọi")}</div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
          <div className="text-[11px] uppercase tracking-wide text-gray-400">{t("Trần tháng")}</div>
          <div className="text-2xl font-bold text-gray-800 tabular-nums">{cost.ceiling ? dong(cost.ceiling) : t("chưa đặt")}</div>
          {cost.overPct !== null && (
            <div className={`inline-block mt-1 text-[12px] font-semibold px-2 py-0.5 rounded ${overTone}`}>
              {t("đã dùng")} {cost.overPct}%
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
          <div className="text-[11px] uppercase tracking-wide text-gray-400">{t("Lượt dùng app AI")}</div>
          <div className="text-2xl font-bold text-gray-800 tabular-nums">{log.length}</div>
          <div className="text-[12px] text-gray-500">{apps.length} {t("app được dùng")}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Tìm theo người dùng, nội dung...")}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm" />
        </div>
        <select value={app} onChange={(e) => setApp(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 text-sm">
          <option value="">{t("Tất cả app")}</option>
          {apps.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button onClick={exportCsv} disabled={!rows.length}
          className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-[13px] font-semibold inline-flex items-center gap-1 disabled:opacity-50">
          <Download className="w-4 h-4" />{t("Xuất CSV")}
        </button>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm divide-y divide-gray-50">
        {rows.map((r, i) => (
          <div key={i} className="p-3">
            <div className="text-[11.5px] text-gray-400">{r.at} · <b className="text-gray-600">{r.user || "?"}</b> · {r.app}</div>
            <div className="text-[13px] text-gray-800 mt-0.5">{r.q}</div>
            <div className="text-[12.5px] text-gray-500 mt-0.5 line-clamp-2">{r.a}</div>
          </div>
        ))}
        {rows.length === 0 && <div className="p-6 text-center text-[13px] text-gray-400">{t("Chưa có lượt dùng nào khớp bộ lọc.")}</div>}
      </div>

      <p className="text-[11px] text-gray-400">
        {t("Sổ chi phí tính từ token thật của mỗi lần gọi AI (không gồm máy viết blog chạy bot riêng).\n        Đặt trần tháng ở trang Quản trị app AI — chạm 80% máy nhắc trong bản tin sáng, vượt trần máy kêu to.")}
      </p>
    </div>
  );
}
