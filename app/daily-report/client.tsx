"use client";
import { useState, useTransition } from "react";
import { submitDailyReport, reviewDailyReport } from "./actions";
import { Send, CheckCircle2, AlertCircle, Smile, Frown, Meh, Battery, MessageSquare } from "lucide-react";
import { fmtVND, vnDateStr } from "@/lib/payroll";
import { metricsForDept, SALE_DEPT } from "@/lib/dept-report-templates";
import { useLang } from "@/components/lang-provider";

const MOODS = [
  { v: "great",    e: "", l: "Bùng nổ", c: "bg-green-100 text-green-700" },
  { v: "good",     e: "", l: "Tốt",     c: "bg-blue-100 text-blue-700" },
  { v: "ok",       e: "", l: "Bình thường", c: "bg-gray-100 text-gray-700" },
  { v: "tired",    e: "", l: "Mệt",     c: "bg-yellow-100 text-yellow-700" },
  { v: "stressed", e: "", l: "Stress",  c: "bg-red-100 text-red-700" }
];

export function DailyReportClient({ todayReport, myReports, teamReports, view, isManager, currentDate, myDept, saleAuto, returnTo }: any) {
  const { t } = useLang();
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-brand-600" /> {t("Daily Report")}
        </h1>
      </div>

      {isManager && (
        <div className="flex gap-1 border-b border-gray-200">
          <a href="/daily-report?view=mine" className={`px-4 py-2 text-sm font-medium border-b-2 ${view !== "team" ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500"}`}>{t("Của tôi")}</a>
          <a href={`/daily-report?view=team&d=${currentDate}`} className={`px-4 py-2 text-sm font-medium border-b-2 ${view === "team" ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500"}`}>{t("Toàn team")}</a>
        </div>
      )}

      {view !== "team" ? <SubmitForm existing={todayReport} reports={myReports} dept={myDept} saleAuto={saleAuto} returnTo={returnTo} /> : <TeamView reports={teamReports} currentDate={currentDate} />}
    </div>
  );
}

function SubmitForm({ existing, reports, dept, saleAuto, returnTo }: any) {
  const { t } = useLang();
  const today = vnDateStr();
  const isSale = !dept || dept === SALE_DEPT;
  const tmpl = metricsForDept(dept);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [form, setForm] = useState({
    report_date: today,
    yesterday_done: existing?.yesterday_done || "",
    today_plan: existing?.today_plan || "",
    blockers: existing?.blockers || "",
    mood: (existing?.mood as any) || "good",
    energy_level: existing?.energy_level || 4,

    customer_interactions: existing?.customer_interactions || 0,
    calls_made: saleAuto ? (saleAuto.calls || 0) : (existing?.calls_made || 0),
    orders_closed: saleAuto ? (saleAuto.orders || 0) : (existing?.orders_closed || 0),
    revenue_today: saleAuto ? (saleAuto.revenueGross || saleAuto.revenue || 0) : (existing?.revenue_today || 0),
    hours_worked: existing?.hours_worked || 8,
    highlights: existing?.highlights || "",
    learnings: existing?.learnings || "",
    fields: (existing?.fields as Record<string, any>) || {}
  });
  const setField = (k: string, v: number) => setForm({ ...form, fields: { ...form.fields, [k]: v } });
  const [hiddenOrders, setHiddenOrders] = useState<string[]>([]);
  async function excludeOrder(code: string) {
    setHiddenOrders(h => [...h, code]);
    try { await fetch("/api/order-exclude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_code: code, exclude: true }) }); } catch { }
  }

  const ckList: { kh?: string; coc?: number; tong?: number }[] = Array.isArray((form.fields as any).ck_deposits) ? (form.fields as any).ck_deposits : [];
  const setCk = (list: any[]) => setForm({ ...form, fields: { ...form.fields, ck_deposits: list } as any });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await submitDailyReport(form);
      if (res.success) {

        if (returnTo === "cham-cong") {
          setMsg({ text: t("Đã nộp báo cáo. Đang quay lại trang chấm công..."), type: "ok" });
          setTimeout(() => { window.location.href = "/cham-cong"; }, 1200);
        } else {
          setMsg({ text: t("Đã gửi báo cáo. Manager sẽ review."), type: "ok" });
          setTimeout(() => setMsg(null), 4000);
        }
      } else {
        setMsg({ text: "" + res.error, type: "err" });
        setTimeout(() => setMsg(null), 4000);
      }
    });
  };

  return (
    <div className="space-y-4">
      {returnTo === "cham-cong" && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex items-center gap-3">
          <div className="text-2xl">⏰</div>
          <div className="flex-1">
            <div className="font-bold text-amber-900">{t("Bắt buộc nộp báo cáo trước khi check-out")}</div>
            <div className="text-xs text-amber-700 mt-0.5">
              {t('Sau khi bấm "Gửi báo cáo", hệ thống sẽ tự đưa bạn quay lại trang chấm công để hoàn tất check-out.')}
            </div>
          </div>
        </div>
      )}

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <form onSubmit={submit} className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="font-bold">{t("Báo cáo cuối ngày —")} {today}</h2>
          {existing && existing.status === "reviewed" && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{t("✓ Manager đã review")}</span>
          )}
        </div>

        <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600">{t("Tâm trạng hôm nay")}</label>
            <div className="flex gap-1 mt-1 flex-wrap">
              {MOODS.map(m => (
                <button type="button" key={m.v}
                  onClick={() => setForm({...form, mood: m.v as any})}
                  className={`px-2 py-1 rounded text-xs ${form.mood === m.v ? m.c + " ring-2 ring-offset-1" : "bg-white border"}`}>
                  {m.e} {t(m.l)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">{t("Năng lượng (1-5)")}</label>
            <div className="flex gap-1 mt-1">
              {[1,2,3,4,5].map(n => (
                <button type="button" key={n} onClick={() => setForm({...form, energy_level: n})}
                  className={`w-9 h-9 rounded text-sm font-bold ${form.energy_level >= n ? "bg-emerald-500 text-white" : "bg-gray-200 text-gray-400"}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold">{t("Hôm nay đã làm được gì? *")}</label>
          <textarea required value={form.yesterday_done} onChange={e => setForm({...form, yesterday_done: e.target.value})}
            rows={3} placeholder={t("VD: 1) Gọi 15 KH inbox, chốt 2 đơn 1.5tr · 2) Reply 30 comment FB · 3) Học xong playbook objection")}
            className="mt-1 w-full p-2 border border-gray-200 rounded text-sm" />
        </div>

        <div>
          <label className="text-sm font-semibold">{t("Ngày mai plan gì? *")}</label>
          <textarea required value={form.today_plan} onChange={e => setForm({...form, today_plan: e.target.value})}
            rows={3} placeholder={t("VD: 1) Follow-up 5 KH hứa cuối tuần · 2) Live FB 1 hour · 3) Họp team 9am")}
            className="mt-1 w-full p-2 border border-gray-200 rounded text-sm" />
        </div>

        <div>
          <label className="text-sm font-semibold">{t("Vướng mắc gì? (Manager sẽ hỗ trợ)")}</label>
          <textarea value={form.blockers} onChange={e => setForm({...form, blockers: e.target.value})}
            rows={2} placeholder={t("VD: Kho hết hàng combo VIP, KH chờ — cần SET cấp tốc")}
            className="mt-1 w-full p-2 border border-gray-200 rounded text-sm" />
        </div>

        {isSale && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
          <div className="text-xs font-semibold text-blue-900">{t("Số liệu Sale hôm nay")} <span className="text-[10px] font-normal bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">{t("tự động")}</span></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-white border border-blue-100 rounded p-2 text-center"><div className="text-lg font-bold text-gray-800">{saleAuto?.calls ?? 0}</div><div className="text-[10px] text-gray-500">{t("Cuộc gọi")}</div></div>
            <div className="bg-white border border-blue-100 rounded p-2 text-center"><div className="text-lg font-bold text-gray-800">{saleAuto?.care ?? 0}</div><div className="text-[10px] text-gray-500">{t("Chăm khách")}</div></div>
            <div className="bg-white border border-blue-100 rounded p-2 text-center"><div className="text-lg font-bold text-gray-800">{saleAuto?.orders ?? 0}</div><div className="text-[10px] text-gray-500">{t("Đơn chốt")}</div></div>
            <div className="bg-white border border-blue-100 rounded p-2 text-center"><div className="text-base font-bold text-emerald-700">{fmtVND(saleAuto?.revenueGross ?? saleAuto?.revenue ?? 0)}</div><div className="text-[10px] text-gray-500">{t("Doanh thu")}</div></div>
          </div>
          <div className="text-[11px] text-gray-500">{t("Gọi/chăm lấy từ")} <a href="/cham-soc-kh" className="text-blue-600 underline">{t("Chăm sóc khách")}</a> · {t("đơn/doanh thu từ MISA (cào lại lúc ~17h chốt ca) — số là giá KHÁCH TRẢ (gồm VAT).")}</div>
          {Array.isArray(saleAuto?.orderList) && saleAuto.orderList.length > 0 && (
            <div className="bg-white border border-blue-100 rounded p-2">
              <div className="text-[11px] font-medium text-blue-900 mb-1.5">{t("Doanh thu MISA ghi nhận hôm nay (có thể gồm đơn cũ vừa giao COD) — đối chiếu kho:")}</div>
              <div className="space-y-1.5">
                {saleAuto.orderList.filter((o: any) => !hiddenOrders.includes(o.code)).map((o: any, i: number) => (
                  <div key={i} className="border border-gray-100 rounded p-1.5">
                    <div className="flex justify-between gap-2 text-[12px]">
                      <span className="font-medium text-gray-800 truncate">{o.customer || o.code}{o.phone ? <span className="text-gray-400 font-normal"> · {o.phone}</span> : null}</span>
                      <span className="font-semibold text-emerald-700 shrink-0">{fmtVND(o.gross ?? o.net)}</span>
                    </div>
                    {Array.isArray(o.items) && o.items.length > 0 && (
                      <ul className="mt-0.5 text-[11px] text-gray-600 space-y-0.5">
                        {o.items.map((it: any, j: number) => <li key={j} className="flex justify-between gap-2"><span className="truncate">• {it.name}</span><span className="text-gray-400 shrink-0">×{it.qty}</span></li>)}
                      </ul>
                    )}
                    <button type="button" onClick={() => { if (confirm(t("Loại đơn này khỏi doanh số của bạn? (đơn không phải bạn chốt)"))) excludeOrder(o.code); }}
                      className="mt-1 text-[10px] text-red-500 hover:underline">✕ {t("Không phải đơn của tôi")}</button>
                  </div>
                ))}
                {hiddenOrders.length > 0 && <div className="text-[10px] text-amber-600">{t("Đã loại")} {hiddenOrders.length} {t("đơn — số Đơn chốt/Doanh thu sẽ cập nhật khi tải lại trang.")}</div>}
              </div>
              <div className="text-[10px] text-gray-400 mt-1">{t("Kiểm tra tên khách · sản phẩm · số lượng khớp đơn bạn chốt không. Sai → báo kho sửa. Đơn chưa thấy → khai 'Đơn CK' / 'Ghi chú bổ sung'.")}</div>
            </div>
          )}

          <div className="border-t border-blue-200 pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 items-start">
            <div>
              <label className="text-[11px] font-medium text-blue-900">{t("KH đã tương tác hôm nay")}</label>
              <input type="number" min={0} inputMode="numeric" placeholder="0"
                value={form.customer_interactions || ""}
                onFocus={e => e.target.select()}
                onChange={e => setForm({ ...form, customer_interactions: e.target.value === "" ? 0 : +e.target.value })}
                className="mt-1 w-full p-1.5 border border-gray-200 rounded text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[11px] font-medium text-blue-900">{t("Ghi chú bổ sung (đơn/việc hệ thống chưa cào)")}</label>
              <input type="text"
                value={(form.fields as any)?.sale_note || ""}
                onChange={e => setForm({ ...form, fields: { ...form.fields, sale_note: e.target.value } as any })}
                placeholder={t("VD: Chốt 2 đơn KH Cúc chưa lên MISA · gọi thêm 3 khách ngoài DS")}
                className="mt-1 w-full p-1.5 border border-gray-200 rounded text-sm" />
            </div>
          </div>

          <div className="border-t border-blue-200 pt-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-medium text-blue-900">{t("Đơn CK đặc biệt (cọc trước / CK đủ chưa giao)")}</label>
              <button type="button" onClick={() => setCk([...ckList, { kh: "", coc: 0, tong: 0, st: "coc", note: "" }])} className="text-[11px] px-2 py-0.5 rounded bg-blue-600 text-white shrink-0">+ {t("Thêm đơn")}</button>
            </div>
            {ckList.length === 0 && <div className="text-[10px] text-gray-400 mt-1">{t("VD: Vũ Văn Khang · cọc 2.000.000 · tổng 5.344.000 · 'Cọc trước — còn COD'. Hoặc khách CK đủ nhưng CHƯA gửi hàng → chọn 'GIỮ HÀNG' để kho biết chưa giao.")}</div>}
            <div className="space-y-2 mt-1.5">
              {ckList.map((row, i) => (
                <div key={i} className="border border-blue-100 rounded-lg p-2 bg-white space-y-1.5">
                  <div className="grid grid-cols-12 gap-1.5 items-center">
                    <input value={row.kh || ""} onChange={e => { const l = [...ckList]; l[i] = { ...l[i], kh: e.target.value }; setCk(l); }} placeholder={t("Tên KH")} className="col-span-5 p-1.5 border border-gray-200 rounded text-sm" />
                    <input inputMode="numeric" value={(row as any).coc ? (row as any).coc.toLocaleString("vi-VN") : ""} onFocus={e => e.target.select()} onChange={e => { const d = e.target.value.replace(/[^\d]/g, ""); const l = [...ckList]; l[i] = { ...l[i], coc: d === "" ? 0 : parseInt(d, 10) }; setCk(l); }} placeholder={t("Đã CK")} className="col-span-3 p-1.5 border border-gray-200 rounded text-sm text-right" />
                    <input inputMode="numeric" value={row.tong ? row.tong.toLocaleString("vi-VN") : ""} onFocus={e => e.target.select()} onChange={e => { const d = e.target.value.replace(/[^\d]/g, ""); const l = [...ckList]; l[i] = { ...l[i], tong: d === "" ? 0 : parseInt(d, 10) }; setCk(l); }} placeholder={t("Tổng đơn")} className="col-span-3 p-1.5 border border-gray-200 rounded text-sm text-right" />
                    <button type="button" onClick={() => setCk(ckList.filter((_, j) => j !== i))} className="col-span-1 text-red-500 text-sm" title={t("Xoá dòng")}>✕</button>
                  </div>
                  <div className="grid grid-cols-12 gap-1.5 items-center">
                    <select value={(row as any).st || "coc"} onChange={e => { const l = [...ckList]; (l[i] as any) = { ...l[i], st: e.target.value }; setCk(l); }} className="col-span-5 p-1.5 border border-gray-200 rounded text-xs">
                      <option value="coc">{t("Cọc trước — còn COD")}</option>
                      <option value="paid">{t("CK đủ — giao luôn")}</option>
                      <option value="hold">{t("CK đủ — GIỮ HÀNG (chưa giao)")}</option>
                    </select>
                    <input value={t((row as any).note) || ""} onChange={e => { const l = [...ckList]; (l[i] as any) = { ...l[i], note: e.target.value }; setCk(l); }} placeholder={t("Ghi chú cho kho (địa chỉ / lý do giữ / khi nào giao)")} className="col-span-7 p-1.5 border border-gray-200 rounded text-xs" />
                  </div>
                </div>
              ))}
            </div>
            {ckList.some((r: any) => r.st === "hold") && <div className="text-[10px] text-amber-700 bg-amber-50 rounded px-2 py-1 mt-1">{t("Đơn 'GIỮ HÀNG' sẽ hiện cho Kho để KHÔNG gửi hàng cho tới khi bạn báo giao.")}</div>}
          </div>
        </div>
        )}

        {!isSale && tmpl.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-3">
          <div className="text-xs font-semibold text-indigo-900">{t("Chỉ số")} {dept} {t("hôm nay")}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {tmpl.map(m => (
              <div key={m.key}>
                <label className="text-xs">{t(m.label)}{m.money ? t(" (đ)") : ""}</label>
                <input type="text" inputMode="numeric" placeholder="0"
                  value={form.fields[m.key] ? form.fields[m.key].toLocaleString("vi-VN") : ""}
                  onFocus={e => e.target.select()}
                  onChange={e => { const d = e.target.value.replace(/[^\d]/g, ""); setField(m.key, d === "" ? 0 : parseInt(d, 10)); }}
                  className="w-full p-1.5 border border-gray-200 rounded text-sm text-right" />
              </div>
            ))}
          </div>
        </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold">{t("Điều tự hào nhất hôm nay")}</label>
              <span className="text-[10px] text-gray-400">{(form.highlights || "").length}/500</span>
            </div>
            <textarea
              value={form.highlights}
              onChange={e => setForm({...form, highlights: e.target.value.slice(0, 500)})}
              placeholder={t("VD: Chốt deal 50tr với KH Anh Nam sau 3 lần follow-up...")}
              rows={4}
              maxLength={500}
              className="mt-1 w-full p-2 border border-gray-200 rounded text-sm resize-y min-h-[80px]"
            />
          </div>
          <div>
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold">{t("Học được gì mới")}</label>
              <span className="text-[10px] text-gray-400">{(form.learnings || "").length}/500</span>
            </div>
            <textarea
              value={form.learnings}
              onChange={e => setForm({...form, learnings: e.target.value.slice(0, 500)})}
              placeholder={t("VD: Khách hàng cần phải chăm sóc 7 ngày rồi mới ra quan điểm dứt khoát...")}
              rows={4}
              maxLength={500}
              className="mt-1 w-full p-2 border border-gray-200 rounded text-sm resize-y min-h-[80px]"
            />
          </div>
        </div>

        {msg && <div className={`p-2 rounded text-sm ${msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg.text}</div>}

        {existing?.manager_comment && (
          <div className="bg-purple-50 border border-purple-200 rounded p-3">
            <div className="text-xs font-semibold text-purple-800">{t("Comment từ Manager:")}</div>
            <div className="text-sm mt-1">{existing.manager_comment}</div>
          </div>
        )}

        <button type="submit" disabled={pending}
          className="w-full py-3 bg-brand-600 text-white rounded-lg font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
          <Send className="w-4 h-4" /> {pending ? t("Đang gửi...") : existing ? t("CẬP NHẬT BÁO CÁO") : t("GỬI BÁO CÁO")}
        </button>
      </form>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
        <h3 className="font-semibold mb-3">{t("14 ngày gần đây")}</h3>
        <div className="space-y-1">
          {reports.map((r: any) => {
            const mood = MOODS.find(m => m.v === r.mood);
            return (
              <div key={r.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded text-xs">
                <div className="flex items-center gap-2">
                  <span>{mood?.e || ""}</span>
                  <span>{r.report_date}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  {r.orders_closed > 0 && <span>{r.orders_closed}</span>}
                  {r.manager_seen && <span className="text-blue-600">✓</span>}
                </div>
              </div>
            );
          })}
          {reports.length === 0 && <div className="text-center py-4 text-gray-400 text-xs">{t("Chưa có báo cáo")}</div>}
        </div>
      </div>
    </div>
    </div>
  );
}

function TeamView({ reports, currentDate }: any) {
  const { t } = useLang();
  const [pending, startTransition] = useTransition();
  const [comment, setComment] = useState<Record<string, string>>({});

  const submitComment = (id: string) => {
    if (!comment[id]?.trim()) return;
    startTransition(async () => {
      await reviewDailyReport(id, comment[id]);
      setComment({...comment, [id]: ""});
    });
  };

  return (
    <div>
      <form className="flex items-center gap-2 mb-4">
        <label className="text-sm">{t("Ngày:")}</label>
        <input type="date" name="d" defaultValue={currentDate} className="p-2 border border-gray-200 rounded text-sm" />
        <input type="hidden" name="view" value="team" />
        <button className="px-3 py-1.5 bg-gray-900 text-white rounded text-sm">{t("Xem")}</button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((r: any) => {
          const mood = MOODS.find(m => m.v === r.mood);
          return (
            <div key={r.id} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-bold">{r.users?.full_name}</div>
                  <div className="text-xs text-gray-500">{r.users?.position}</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs ${mood?.c}`}>{mood?.e} {mood ? t(mood.l) : ""}</span>
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <div className="text-xs font-semibold text-emerald-700">{t("Hôm nay:")}</div>
                  <div className="whitespace-pre-wrap">{r.yesterday_done}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-blue-700">{t("Ngày mai:")}</div>
                  <div className="whitespace-pre-wrap">{r.today_plan}</div>
                </div>
                {r.blockers && (
                  <div className="bg-yellow-50 p-2 rounded text-xs">
                    <b className="text-yellow-800">{t("Vướng:")}</b> {r.blockers}
                  </div>
                )}
              </div>

              {(() => {
  const { t: t } = useLang();
                const rdept = r.users?.departments?.name;
                const rIsSale = !rdept || rdept === SALE_DEPT;
                const rtmpl = metricsForDept(rdept);
                if (rIsSale) return (
                  <div className="grid grid-cols-4 gap-1 mt-2 pt-2 border-t border-gray-100 text-center text-xs">
                    <div><b>{r.customer_interactions}</b><br/><span className="text-gray-500">{t("KH")}</span></div>
                    <div><b>{r.calls_made}</b><br/><span className="text-gray-500">{t("Calls")}</span></div>
                    <div><b>{r.orders_closed}</b><br/><span className="text-gray-500">{t("Đơn")}</span></div>
                    <div><b>{r.revenue_today > 0 ? fmtVND(r.revenue_today) : "—"}</b><br/><span className="text-gray-500">{t("DT")}</span></div>
                  </div>
                );
                if (rtmpl.length === 0) return null;
                return (
                  <div className="grid grid-cols-3 gap-1 mt-2 pt-2 border-t border-gray-100 text-center text-xs">
                    {rtmpl.map(m => (
                      <div key={m.key}><b>{m.money ? ((r.fields?.[m.key] || 0) > 0 ? fmtVND(r.fields[m.key]) : "—") : (r.fields?.[m.key] || 0)}</b><br/><span className="text-gray-500">{t(m.label)}</span></div>
                    ))}
                  </div>
                );
              })()}

              {Array.isArray(r.fields?.ck_deposits) && r.fields.ck_deposits.filter((d: any) => (d.coc || 0) > 0 || (d.tong || 0) > 0 || d.kh).length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100 bg-blue-50 rounded p-2 text-xs space-y-0.5">
                  <div className="font-semibold text-blue-800">{t("Đơn CK cần đối soát / xử lý")}:</div>
                  {r.fields.ck_deposits.filter((d: any) => (d.coc || 0) > 0 || (d.tong || 0) > 0 || d.kh).map((d: any, i: number) => {
  const { t: t } = useLang();
                    const st = d.st === "hold" ? { l: "GIỮ HÀNG", c: "text-red-600" } : d.st === "paid" ? { l: "CK đủ - giao luôn", c: "text-emerald-600" } : { l: "Cọc - còn COD", c: "text-amber-600" };
                    return <div key={i} className="text-gray-700">• {d.kh || "?"} — {t("đã CK")} <b>{fmtVND(d.coc || 0)}</b>/{fmtVND(d.tong || 0)} · <span className={st.c + " font-medium"}>{t(st.l)}</span>{t(d.note) ? ` · ${t(d.note)}` : ""}</div>;
                  })}
                </div>
              )}

              {r.manager_comment ? (
                <div className="bg-purple-50 p-2 rounded mt-2 text-xs">
                  <b>{t("Comment:")}</b> {r.manager_comment}
                </div>
              ) : (
                <div className="flex gap-1 mt-2">
                  <input value={comment[r.id] || ""} onChange={e => setComment({...comment, [r.id]: e.target.value})}
                    placeholder={t("Reply nhanh...")}
                    className="flex-1 p-1.5 border border-gray-200 rounded text-xs" />
                  <button onClick={() => submitComment(r.id)} disabled={pending}
                    className="px-3 py-1.5 bg-brand-600 text-white rounded text-xs">{t("Gửi")}</button>
                </div>
              )}
            </div>
          );
        })}
        {reports.length === 0 && (
          <div className="md:col-span-2 text-center py-12 text-gray-400">{t("Chưa có báo cáo nào trong ngày")} {currentDate}</div>
        )}
      </div>
    </div>
  );
}
