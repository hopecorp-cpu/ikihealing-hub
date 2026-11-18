"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fmtVND } from "@/lib/payroll";
import { Phone, Search, Download, Pencil, Check, X, MessageSquarePlus } from "lucide-react";
import type { SaleCustomer } from "@/lib/sale-suggestions";
import { setCareStatus, updateCustomerField } from "./actions";
import { useLang } from "@/components/lang-provider";

function exportCSV(rows: SaleCustomer[], t: (s: string) => string) {
  const headers = [t("Tên KH"), t("SĐT"), t("Đã chi (đ)"), t("Số đơn"), t("Đơn gần nhất (đ)"), t("Ngày trước (mua cuối)"), t("SP đã mua"), t("Nên bán"), t("Chiết khấu"), t("Đã chăm sóc"), t("Ghi chú chăm sóc")];
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map(c => [c.name, c.phone, c.spend, c.orders, c.lastOrderValue, c.daysSince, c.products.join(" / "), c.nextBest.join(" / "), c.discount, c.careDone ? t("Đã chăm") : t("Chưa"), c.careNote || ""].map(esc).join(","));
  const csv = "﻿" + [headers.map(esc).join(","), ...lines].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `KhachCuaToi_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function MyCustomersClient({ customers }: { customers: SaleCustomer[] }) {
  const { t: tDich } = useLang();
  const { t } = useLang();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "todo" | "done">("all");
  const [editId, setEditId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftPhone, setDraftPhone] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  let list = customers;
  if (tab === "todo") list = list.filter(c => !c.careDone);
  if (tab === "done") list = list.filter(c => c.careDone);
  const filtered = q.trim() ? list.filter(c => (c.name + " " + c.phone).toLowerCase().includes(q.toLowerCase().trim())) : list;

  const doneCount = customers.filter(c => c.careDone).length;

  const startEdit = (c: SaleCustomer) => { setEditId(c.id); setDraftName(c.name); setDraftPhone(c.phone); };
  const saveEdit = (id: string) => start(async () => {
    const res = await updateCustomerField(id, { full_name: draftName, phone: draftPhone });
    if (res.success) { setEditId(null); router.refresh(); } else alert(res.error);
  });
  const toggleCare = (c: SaleCustomer) => start(async () => {
    const res = await setCareStatus(c.id, !c.careDone, c.careNote || "");
    if (!res.success) alert(res.error); else router.refresh();
  });
  const editNote = (c: SaleCustomer) => {
    const note = window.prompt(t("Ghi chú chăm sóc (phản hồi của khách):"), c.careNote || "");
    if (note === null) return;
    start(async () => {
      const res = await setCareStatus(c.id, c.careDone, note);
      if (!res.success) alert(res.error); else router.refresh();
    });
  };

  if (customers.length === 0) {
    return <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-12 text-center text-gray-400">{t("Chưa có khách được giao. Khi quản lý phân bổ, danh sách sẽ hiện ở đây.")}</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {([["all", `${t("Tất cả")} (${customers.length})`], ["todo", `${t("Chưa chăm")} (${customers.length - doneCount})`], ["done", `${t("Đã chăm")} (${doneCount})`]] as const).map(([k, lb]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === k ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}>{lb}</button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-gray-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={t("Tìm tên / SĐT...")} className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-56" />
          </div>
          <button onClick={() => exportCSV(filtered, t)} className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700">
            <Download className="w-4 h-4" /> {t("Xuất")}
          </button>
        </div>
      </div>

      <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-[11px] text-rose-800">
        <b>{t("Khách VIP: KHÔNG giảm giá — tặng quà + upsell.")}</b> {t("Quà theo đơn: ≥1.5tr → Kem đánh răng/Muối tre · ≥3tr → Trà Mẫu A + Hạt nêm · ≥6tr → Dầu dừa + giao nhanh.")}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-x-auto">
        <div className="sm:hidden divide-y divide-gray-100">
          {filtered.map(c => (
            <div key={c.id} className={`p-3 ${c.careDone ? "bg-emerald-50/40" : ""}`}>
              {editId === c.id ? (
                <div className="space-y-1.5">
                  <input value={draftName} onChange={e => setDraftName(e.target.value)} placeholder={t("Tên KH")} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                  <input value={draftPhone} onChange={e => setDraftPhone(e.target.value)} placeholder={t("SĐT")} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(c.id)} disabled={pending} className="flex-1 py-1.5 bg-emerald-600 text-white rounded text-sm font-medium">{t("Lưu")}</button>
                    <button onClick={() => setEditId(null)} className="px-4 py-1.5 border border-gray-200 rounded text-gray-500 text-sm">{t("Huỷ")}</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold flex items-center gap-1.5">
                        {c.name}
                        <button onClick={() => startEdit(c)} className="text-gray-400"><Pencil className="w-3.5 h-3.5" /></button>
                      </div>
                      {c.phone
                        ? <a href={`tel:${c.phone}`} className="text-sm text-blue-600 inline-flex items-center gap-1 mt-0.5"><Phone className="w-3.5 h-3.5" /> {c.phone}</a>
                        : <button onClick={() => startEdit(c)} className="text-xs text-amber-600 underline mt-0.5">{t("+ Thêm SĐT")}</button>}
                    </div>
                    <button onClick={() => toggleCare(c)} disabled={pending}
                      className={`shrink-0 text-xs px-2.5 py-1.5 rounded-lg font-medium inline-flex items-center gap-1 ${c.careDone ? "bg-emerald-600 text-white" : "border border-gray-300 text-gray-600"}`}>
                      <Check className="w-3.5 h-3.5" /> {c.careDone ? t("Đã chăm") : t("Chăm sóc")}
                    </button>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <div className="text-gray-500">{t("Đã chi:")} <b className="text-gray-900">{c.spend ? fmtVND(c.spend) : "—"}</b></div>
                    <div className="text-gray-500">{t("Số đơn:")} <b className="text-gray-900">{c.orders || 0}</b></div>
                    <div className="text-gray-500">{t("Đơn gần nhất:")} <b className="text-gray-900">{c.lastOrderValue ? fmtVND(c.lastOrderValue) : "—"}</b></div>
                    <div className="text-gray-500">{t("Mua cuối:")} <b className={c.orders && c.daysSince > 90 ? "text-red-600" : "text-gray-900"}>{c.orders ? c.daysSince + " " + t("ngày") : "—"}</b></div>
                  </div>

                  {c.nextBest.length > 0 && (
                    <div className="mt-2">
                      <div className="text-[11px] text-gray-500 mb-0.5">{t("Nên bán:")}</div>
                      <div className="flex flex-wrap gap-1">
                        {c.nextBest.map(p => <span key={p} className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-1.5 py-0.5 font-medium">{p}</span>)}
                      </div>
                      {c.discount && <div className="text-[10px] text-gray-500 mt-0.5">{c.discount}</div>}
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-2">
                    <button onClick={() => editNote(c)} className="text-xs text-indigo-600 inline-flex items-center gap-1"><MessageSquarePlus className="w-3.5 h-3.5" /> {t("Ghi chú")}</button>
                    {c.careNote && <span className="text-[11px] text-gray-500 truncate">“{c.careNote}”</span>}
                  </div>
                </>
              )}
            </div>
          ))}
          {filtered.length === 0 && <div className="text-center py-10 text-gray-400">{t("Không có khách phù hợp")}</div>}
        </div>

        <table className="w-full text-sm hidden sm:table">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2.5">{t("Khách hàng")}</th>
              <th className="text-right px-3 py-2.5">{t("Tổng đã chi")}</th>
              <th className="text-center px-3 py-2.5">{t("Đơn")}</th>
              <th className="text-right px-3 py-2.5">{t("Đơn gần nhất")}</th>
              <th className="text-center px-3 py-2.5">{t("Mua cuối")}</th>
              <th className="text-left px-3 py-2.5">{t("Nên bán")}</th>
              <th className="text-center px-3 py-2.5">{t("Chăm sóc")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(c => (
              <tr key={c.id} className={`align-top ${c.careDone ? "bg-emerald-50/40" : "hover:bg-gray-50/60"}`}>
                <td className="px-3 py-2.5">
                  {editId === c.id ? (
                    <div className="space-y-1">
                      <input value={draftName} onChange={e => setDraftName(e.target.value)} placeholder={t("Tên KH")} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                      <input value={draftPhone} onChange={e => setDraftPhone(e.target.value)} placeholder={t("SĐT")} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                      <div className="flex gap-1">
                        <button onClick={() => saveEdit(c.id)} disabled={pending} className="p-1 bg-emerald-600 text-white rounded"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditId(null)} className="p-1 border border-gray-200 rounded text-gray-500"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ) : (
                    <div className="group">
                      <div className="font-medium flex items-center gap-1">
                        {c.name}
                        <button onClick={() => startEdit(c)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700" title={t("Sửa tên / SĐT")}><Pencil className="w-3 h-3" /></button>
                      </div>
                      {c.phone
                        ? <a href={`tel:${c.phone}`} className="text-xs text-blue-600 inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</a>
                        : <button onClick={() => startEdit(c)} className="text-xs text-amber-600 underline">{tDich("+ Thêm SĐT")}</button>}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right font-medium whitespace-nowrap">{c.spend ? fmtVND(c.spend) : <span className="text-gray-300">—</span>}</td>
                <td className="px-3 py-2.5 text-center">{c.orders || <span className="text-gray-300">0</span>}</td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">{c.lastOrderValue ? fmtVND(c.lastOrderValue) : <span className="text-gray-300">—</span>}</td>
                <td className="px-3 py-2.5 text-center text-xs whitespace-nowrap">
                  <span className={c.orders && c.daysSince > 90 ? "text-red-600 font-medium" : "text-gray-600"}>{c.orders ? c.daysSince + "d" : "—"}</span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1 max-w-[160px]">
                    {c.nextBest.map(p => <span key={p} className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-1.5 py-0.5 font-medium">{p}</span>)}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{c.discount}</div>
                </td>
                <td className="px-3 py-2.5 text-center whitespace-nowrap">
                  <button onClick={() => toggleCare(c)} disabled={pending}
                    className={`text-xs px-2 py-1 rounded-lg font-medium inline-flex items-center gap-1 ${c.careDone ? "bg-emerald-600 text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                    <Check className="w-3 h-3" /> {c.careDone ? t("Đã chăm") : t("Chưa")}
                  </button>
                  <button onClick={() => editNote(c)} className="ml-1 text-gray-400 hover:text-indigo-600" title={t("Ghi chú phản hồi")}><MessageSquarePlus className="w-4 h-4 inline" /></button>
                  {c.careNote && <div className="text-[10px] text-gray-500 mt-0.5 max-w-[140px] truncate" title={c.careNote}>“{c.careNote}”</div>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-gray-400">{t("Không có khách phù hợp")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
