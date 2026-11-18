"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fmtVND } from "@/lib/payroll";
import { Phone, Search, RotateCcw, Crown, Sprout, TrendingUp, Gift, Download, UserPlus, UserCheck, Scale } from "lucide-react";
import type { SaleSuggestions, SaleCustomer } from "@/lib/sale-suggestions";
import { assignCustomers, autoAssignBalanced } from "./actions";
import { useLang } from "@/components/lang-provider";

function exportCSV(rows: SaleCustomer[], tabLabel: string, t: (s: string) => string) {
  const headers = [t("Tên KH"), t("SĐT"), t("Phụ trách"), t("Đã chi (đ)"), t("Số đơn"), t("Ngày trước (mua cuối)"), t("SP đã mua"), t("Nên bán"), t("Combo gợi ý"), t("Chiết khấu"), t("Lý do chăm")];
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map(c => [
    c.name, c.phone, c.assignedToName || "", c.spend, c.orders, c.daysSince,
    c.products.join(" / "), c.nextBest.join(" / "), c.combo, c.discount, c.reason,
  ].map(esc).join(","));
  const csv = "﻿" + [headers.map(esc).join(","), ...lines].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `DanhSachGoi_${tabLabel.replace(/[^a-zA-Z0-9]/g, "")}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

const TABS = [
  { key: "winback", label: "Cần chăm lại", icon: RotateCcw, color: "#EF4444", desc: "Lâu không mua — gọi/nhắn ngay" },
  { key: "vip", label: "VIP / mua nhiều", icon: Crown, color: "#F59E0B", desc: "Giữ chân + upsell" },
  { key: "potential", label: "Tiềm năng đơn 2", icon: Sprout, color: "#10B981", desc: "Mới mua — đẩy đơn 2" },
  { key: "loyal", label: "Loyal → VIP", icon: TrendingUp, color: "#8B5CF6", desc: "Mua 2-4 đơn, đẩy lên VIP" },
] as const;

export function SaleAssistantClient({ data }: { data: SaleSuggestions }) {
  const { t: tDich } = useLang();
  const { t } = useLang();

  const saleOnly = data.saleUsers.filter(u => u.isSale);
  const pickList = saleOnly.length ? saleOnly : data.saleUsers;

  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("winback");
  const [q, setQ] = useState("");
  const [visible, setVisible] = useState(100);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saleId, setSaleId] = useState("");

  const [divideSales, setDivideSales] = useState<Set<string>>(() => new Set(pickList.map(u => u.id)));
  const toggleDivide = (id: string) => setDivideSales(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const [pending, start] = useTransition();
  const router = useRouter();

  const list: SaleCustomer[] = (data as any)[tab] || [];
  const filtered = q.trim()
    ? list.filter(c => (c.name + " " + c.phone).toLowerCase().includes(q.toLowerCase().trim()))
    : list;
  const paged = filtered.slice(0, visible);
  const cap = (data.counts as any)[tab];

  const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allPagedSelected = paged.length > 0 && paged.every(c => selected.has(c.id));
  const toggleAll = () => setSelected(prev => {
    const n = new Set(prev);
    if (allPagedSelected) paged.forEach(c => n.delete(c.id));
    else paged.forEach(c => n.add(c.id));
    return n;
  });
  const clearSel = () => setSelected(new Set());

  const doAssign = (sid: string | null) => {
    const ids = [...selected];
    if (ids.length === 0) return;
    start(async () => {
      const res = await assignCustomers(ids, sid);
      if (res.success) { clearSel(); setSaleId(""); router.refresh(); }
      else alert(res.error);
    });
  };

  const doAutoAssign = () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    const pool = [...divideSales];
    if (pool.length === 0) { alert(t("Chọn ít nhất 1 sale để chia (ở dòng 'Chia giữa')")); return; }
    start(async () => {
      const res = await autoAssignBalanced(ids, pool);
      if (res.success) {
        alert(`${t("Đã chia đều")} ${res.assigned} ${t("khách cho")} ${res.sales} ${t("sale")}` + (res.skipped ? ` · ${t("giữ nguyên")} ${res.skipped} ${t("khách đã có người chăm")}` : ""));
        clearSel(); router.refresh();
      } else alert(res.error);
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {TABS.map(tb => {
          const active = tab === tb.key;
          const Icon = tb.icon;
          const count = (data.counts as any)[tb.key];
          return (
            <button key={tb.key} onClick={() => { setTab(tb.key); setQ(""); setVisible(100); }}
              className={`text-left border rounded-xl p-3 transition ${active ? "ring-2 shadow-sm" : "hover:border-gray-300"}`}
              style={active ? { borderColor: tb.color, boxShadow: `0 0 0 1px ${tb.color}` } : { borderColor: "#e5e7eb" }}>
              <div className="flex items-center justify-between">
                <Icon className="w-4 h-4" style={{ color: tb.color }} />
                <span className="text-xl font-bold" style={{ color: tb.color }}>{count}</span>
              </div>
              <div className="font-semibold text-sm mt-1">{t(tb.label)}</div>
              <div className="text-[11px] text-gray-500">{t(tb.desc)}</div>
            </button>
          );
        })}
      </div>

      <div className="bg-gradient-to-r from-amber-50 to-white border border-amber-200 rounded-xl p-3">
        <div className="flex items-center gap-2 text-sm font-semibold mb-1"><Gift className="w-4 h-4 text-amber-600" /> {t("Combo bán chạy (KH hay mua cùng)")}</div>
        <div className="flex flex-wrap gap-2">
          {data.topCombos.slice(0, 6).map((c, i) => (
            <span key={i} className="text-xs bg-white border border-amber-200 rounded-full px-2.5 py-1">
              {c.pair} <b className="text-amber-700">· {c.customers} {t("KH")}</b>
            </span>
          ))}
        </div>
      </div>

      {tab === "vip" && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800">
          <b>{t("VIP mua lại: KHÔNG giảm giá — tặng quà + upsell combo.")}</b> {t("Quà theo giá trị đơn:")}
          <span className="ml-1">{t("≥1.5tr → Kem đánh răng/Muối tre · ≥3tr → Trà Mẫu A + Hạt nêm · ≥6tr → Dầu dừa + giao nhanh + thiệp.")}</span>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-gray-500">
          {t("Đang xem")} <b>{Math.min(paged.length, filtered.length)}</b> / {filtered.length} {t("khách")}
          {filtered.length !== cap && <span className="text-gray-400"> ({t("tệp này có")} {cap})</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-gray-400" />
            <input value={q} onChange={e => { setQ(e.target.value); setVisible(100); }} placeholder={t("Tìm tên / SĐT...")}
              className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-60" />
          </div>
          <button onClick={() => exportCSV(filtered, tDich(TABS.find(tb => tb.key === tab)?.label) || tab, t)}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-40">
            <Download className="w-4 h-4" /> {t("Xuất danh sách gọi")}
          </button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="sticky top-2 z-10 bg-indigo-600 text-white rounded-xl px-4 py-2.5 shadow space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-sm flex items-center gap-1.5"><UserPlus className="w-4 h-4" /> {t("Đã chọn")} {selected.size} {t("khách")}</span>
            <select value={saleId} onChange={e => setSaleId(e.target.value)}
              className="text-sm text-gray-800 rounded-lg px-2 py-1.5 border-0">
              <option value="">{t("— Chọn sale để giao —")}</option>
              {pickList.map(u => <option key={u.id} value={u.id}>{u.name} ({u.assignedCount} {t("khách")})</option>)}
            </select>
            <button onClick={() => doAssign(saleId)} disabled={!saleId || pending}
              className="text-sm bg-white text-indigo-700 font-semibold rounded-lg px-3 py-1.5 disabled:opacity-50">
              {pending ? t("Đang giao...") : t("Giao cho sale")}
            </button>
            <button onClick={() => doAssign(null)} disabled={pending}
              className="text-sm bg-indigo-500 rounded-lg px-3 py-1.5 hover:bg-indigo-400">{t("Bỏ giao")}</button>
            <button onClick={doAutoAssign} disabled={pending} title={t("Chia đều khách CHƯA có người chăm cho các sale, cân theo số đang giữ")}
              className="text-sm bg-amber-400 text-amber-900 font-semibold rounded-lg px-3 py-1.5 hover:bg-amber-300 inline-flex items-center gap-1">
              <Scale className="w-3.5 h-3.5" /> {t("Chia đều cho sale")}
            </button>
            <button onClick={clearSel} className="text-sm underline ml-auto">{t("Bỏ chọn")}</button>
          </div>
          <div className="border-t border-indigo-400/40 pt-2">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] text-indigo-100 font-medium">{t("Chia đều cho các sale đã tích:")}</span>
              <button onClick={() => setDivideSales(new Set(pickList.map(u => u.id)))} className="text-[10px] underline text-indigo-100">{t("Tích hết")}</button>
              <button onClick={() => setDivideSales(new Set())} className="text-[10px] underline text-indigo-100">{t("Bỏ hết")}</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
              {[...pickList].sort((a, b) => a.name.localeCompare(b.name)).map(u => {
                const on = divideSales.has(u.id);
                return (
                  <label key={u.id}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer text-xs ${on ? "bg-white text-indigo-800" : "bg-indigo-500/40 text-indigo-50"}`}>
                    <input type="checkbox" checked={on} onChange={() => toggleDivide(u.id)} className="shrink-0" />
                    <span className="truncate flex-1">{u.name}</span>
                    <b className="opacity-70 shrink-0">{u.assignedCount}</b>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-3 py-2.5 w-8"><input type="checkbox" checked={allPagedSelected} onChange={toggleAll} /></th>
              <th className="text-left px-3 py-2.5">{t("Khách hàng")}</th>
              <th className="text-left px-3 py-2.5">{t("Phụ trách")}</th>
              <th className="text-right px-3 py-2.5">{t("Đã chi")}</th>
              <th className="text-center px-3 py-2.5">{t("Đơn")}</th>
              <th className="text-center px-3 py-2.5">{t("Mua cuối")}</th>
              <th className="text-left px-3 py-2.5">{t("Đã mua")}</th>
              <th className="text-left px-3 py-2.5">{t("Nên bán")}</th>
              <th className="text-left px-3 py-2.5">{t("Ưu đãi / Quà")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paged.map(c => (
              <tr key={c.id} className={`hover:bg-gray-50/60 align-top ${selected.has(c.id) ? "bg-indigo-50/50" : ""}`}>
                <td className="px-3 py-2.5"><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} /></td>
                <td className="px-3 py-2.5">
                  <div className="font-medium">{c.name}</div>
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="text-xs text-blue-600 inline-flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {c.phone}
                    </a>
                  )}
                  <div className="text-[11px] text-gray-400 mt-0.5">{c.reason}</div>
                </td>
                <td className="px-3 py-2.5">
                  {c.assignedToName
                    ? <span className="text-[11px] inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-1.5 py-0.5"><UserCheck className="w-3 h-3" />{c.assignedToName}</span>
                    : <span className="text-[11px] text-gray-300">{t("chưa giao")}</span>}
                </td>
                <td className="px-3 py-2.5 text-right font-medium whitespace-nowrap">{fmtVND(c.spend)}</td>
                <td className="px-3 py-2.5 text-center">{c.orders}</td>
                <td className="px-3 py-2.5 text-center whitespace-nowrap text-xs">
                  <span className={c.daysSince > 90 ? "text-red-600 font-medium" : "text-gray-600"}>{c.daysSince}{t("d trước")}</span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1 max-w-[180px]">
                    {c.products.length ? c.products.map(p => (
                      <span key={p} className="text-[10px] bg-gray-100 rounded px-1.5 py-0.5">{p}</span>
                    )) : <span className="text-[11px] text-gray-400 italic">{t("chưa rõ SP")}</span>}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1 max-w-[170px]">
                    {c.nextBest.map(p => (
                      <span key={p} className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-1.5 py-0.5 font-medium">{p}</span>
                    ))}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1">{t("Combo:")} {c.combo}</div>
                </td>
                <td className="px-3 py-2.5">
                  <span className="text-[11px] bg-blue-50 text-blue-700 rounded px-1.5 py-0.5 font-medium whitespace-nowrap">{c.discount}</span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="text-center py-10 text-gray-400">{t("Không có khách trong tệp này")}</td></tr>
            )}
          </tbody>
        </table>
        {filtered.length > paged.length && (
          <div className="flex items-center justify-center gap-3 p-3 border-t border-gray-100 bg-gray-50/50">
            <span className="text-xs text-gray-500">{t("Còn")} {filtered.length - paged.length} {t("khách chưa hiện")}</span>
            <button onClick={() => setVisible(v => v + 100)}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-white font-medium">
              {t("Xem thêm 100")}
            </button>
            <button onClick={() => setVisible(filtered.length)}
              className="text-sm px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 font-medium">
              {t("Xem tất cả")} ({filtered.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
