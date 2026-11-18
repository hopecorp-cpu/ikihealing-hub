"use client";
import { useLang } from "@/components/lang-provider";
import { useMemo, useState } from "react";

const fmt = (n: number) => (n || 0).toLocaleString("vi-VN") + "đ";

export default function GanDonClient({ orders: initial, saleNames, month }: { orders: any[]; saleNames: string[]; month: string }) {
  const { t: t } = useLang();
  const [orders, setOrders] = useState(initial);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "unassigned" | "notsale" | "reassigned">("all");
  const [saving, setSaving] = useState<string>("");

  const normSet = useMemo(() => new Set(saleNames.map(s => (s || "").toLowerCase().replace(/\s+/g, " ").trim())), [saleNames]);
  const isSale = (name: string) => normSet.has((name || "").toLowerCase().replace(/\s+/g, " ").trim());

  const rows = useMemo(() => {
    const kw = q.toLowerCase().trim();
    return orders.filter(o => {
      if (filter === "unassigned" && (o.saleRaw || "").trim()) return false;
      if (filter === "notsale" && isSale(o.effective)) return false;
      if (filter === "reassigned" && !o.assigned) return false;
      if (kw && !`${o.customer} ${o.phone} ${o.code} ${o.saleRaw} ${o.prod}`.toLowerCase().includes(kw)) return false;
      return true;
    });
  }, [orders, q, filter, normSet]);

  async function reassign(code: string, sale: string) {
  const { t: t } = useLang();
    setSaving(code);
    try {
      const res = await fetch("/api/order-reassign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_code: code, sale }) });
      if (!res.ok) { alert("Lưu thất bại (" + res.status + ")"); return; }
      setOrders(prev => prev.map(o => o.code === code ? { ...o, assigned: sale, effective: sale || o.saleRaw } : o));
    } catch { alert(t("Lỗi mạng")); } finally { setSaving(""); }
  }

  const monthNav = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };

  const counts = {
    all: orders.length,
    unassigned: orders.filter(o => !(o.saleRaw || "").trim()).length,
    notsale: orders.filter(o => !isSale(o.effective)).length,
    reassigned: orders.filter(o => o.assigned).length,
  };

  return (
    <div className="max-w-4xl mx-auto p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-800">{t("Gán đơn cho sale")}</h1>
        <div className="flex items-center gap-2 text-sm">
          <a href={`/gan-don?m=${monthNav(-1)}`} className="px-2 py-1 rounded bg-gray-100">←</a>
          <span className="font-medium">{month}</span>
          <a href={`/gan-don?m=${monthNav(1)}`} className="px-2 py-1 rounded bg-gray-100">→</a>
        </div>
      </div>
      <p className="text-xs text-gray-500">{t("Đơn trong sổ Telegram bóc nhầm tên / \"chưa rõ\" → gán về đúng sale. Doanh thu tháng &amp; hoa hồng sẽ chạy về người được gán (không cần sửa lại tin trong nhóm).")}</p>

      <div className="flex flex-wrap gap-1.5 text-xs">
        {([["all", t("Tất cả")], ["unassigned", t("Chưa có tên (rỗng)")], ["notsale", t("Không phải sale")], ["reassigned", t("Đã gán lại")]] as const).map(([k, lbl]) => (
          <button key={k} onClick={() => setFilter(k)} className={`px-2.5 py-1 rounded-md border ${filter === k ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}>
            {lbl} <span className="opacity-70">({(counts as any)[k]})</span>
          </button>
        ))}
      </div>

      <input value={q} onChange={e => setQ(e.target.value)} placeholder={t("Tìm khách / SĐT / mã đơn / sale…")} className="w-full p-2 border border-gray-200 rounded text-sm" />

      <div className="space-y-2">
        {rows.map(o => (
          <div key={o.code} className={`border rounded-lg p-2.5 ${o.excluded ? "border-red-200 bg-red-50/40" : o.assigned ? "border-emerald-200 bg-emerald-50/40" : "border-gray-200 bg-white"}`}>
            <div className="flex justify-between gap-2 text-[13px]">
              <span className="font-semibold text-gray-800 truncate">{o.customer || o.code}{o.phone ? <span className="font-normal text-gray-400"> · {o.phone}</span> : null}</span>
              <span className="font-semibold text-emerald-700 shrink-0">{fmt(o.gross)}</span>
            </div>
            {o.prod && <div className="text-[11px] text-gray-500 truncate mt-0.5">{o.prod}</div>}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-[11px]">
              <span className="text-gray-400">{o.date} · {o.code}</span>
              <span className="text-gray-500">{t("Sổ ghi:")} <b className={(o.saleRaw || "").trim() ? "text-gray-700" : "text-red-500"}>{o.saleRaw || t("(rỗng)")}</b></span>
              {o.assigned && <span className="text-emerald-700">{t("→ gán:")} <b>{o.assigned}</b></span>}
              {o.excluded && <span className="text-red-500">{t("(đã loại khỏi doanh số)")}</span>}
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-[11px] text-gray-500 shrink-0">{t("Gán cho:")}</span>
              <select
                value={o.assigned || ""}
                disabled={saving === o.code}
                onChange={e => reassign(o.code, e.target.value)}
                className="flex-1 p-1.5 border border-gray-300 rounded text-sm bg-white">
                <option value="">{t("— Giữ gốc sổ (")}{o.saleRaw || t("rỗng")}) —</option>
                {saleNames.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {saving === o.code && <span className="text-[11px] text-gray-400">{t("Đang lưu…")}</span>}
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="text-center text-sm text-gray-400 py-8">{t("Không có đơn khớp bộ lọc.")}</div>}
      </div>
    </div>
  );
}
