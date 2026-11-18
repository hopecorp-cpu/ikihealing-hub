"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, X, Plus, UserRound } from "lucide-react";
import { PageHeader, Badge } from "@/components/ui/kit";
import type { Consultation, StaffLite, ShowRate } from "@/lib/consultations";
import { bookAction, statusAction, walkInAction } from "./actions";

const STATUS: Record<string, { label: string; cls: string }> = {
  dat: { label: "Đã đặt", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  den: { label: "Đã đến", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  vang: { label: "Vắng", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  huy: { label: "Huỷ", cls: "bg-gray-100 text-gray-500 border-gray-200" },
};

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export default function ConsultClient({ date, today, days, slots, staff, rows, rate }: {
  date: string; today: string; days: string[]; slots: string[];
  staff: StaffLite[]; rows: Consultation[]; rate: ShowRate;
}) {
  const { t: tDich } = useLang();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState<{ time: string; staff: StaffLite } | null>(null);
  const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [source, setSource] = useState("quyen-loi-the"); const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  const at = (time: string, staffId: string) => rows.find((r) => r.slot_time === time && r.staff_id === staffId && r.status !== "huy");

  const submit = () => {
    if (!form) return;
    setErr("");
    start(async () => {
      const r = await bookAction({
        slot_date: date, slot_time: form.time, staff_id: form.staff.id, staff_name: form.staff.full_name,
        customer_name: name, customer_phone: phone, source, note,
      });
      if (!r.ok) { setErr(r.error || "Không đặt được"); return; }
      setForm(null); setName(""); setPhone(""); setNote("");
      router.refresh();
    });
  };

  const [walk, setWalk] = useState(false);
  const submitWalk = () => {
    if (!staff.length) return;
    setErr("");
    start(async () => {
      const r = await walkInAction({
        slot_date: date, staff_id: staff[0].id, staff_name: staff[0].full_name,
        customer_name: name, customer_phone: phone, note,
      });
      if (!r.ok) { setErr(r.error || "Không ghi được"); return; }
      setWalk(false); setName(""); setPhone(""); setNote("");
      router.refresh();
    });
  };

  const mark = (id: string, status: "den" | "vang" | "huy") =>
    start(async () => { await statusAction(id, status); router.refresh(); });

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <PageHeader
        title={tDich("Lịch tư vấn 1-1")}
        subtitle={tDich("Buổi 30 phút — quyền lợi thẻ thành viên và combo lớn")}
        icon={CalendarClock}
        actions={
          <div className="px-3 py-1.5 rounded-xl text-sm font-bold bg-emerald-50 text-emerald-700">
            {tDich("Tỷ lệ đến 7 ngày:")} {rate.ratePct === null ? tDich("chưa có") : `${rate.ratePct}%`}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <Badge tone="green" dot>{rate.den} {tDich("đã đến")}</Badge>
        <Badge tone="red" dot>{rate.vang} {tDich("vắng")}</Badge>
        <Badge tone="gray" dot>{rate.huy} {tDich("huỷ")}</Badge>
        <span className="text-gray-400">· {rate.cho} {tDich("buổi đang chờ")}</span>
      </div>

      <button onClick={() => { setWalk(true); setErr(""); }}
        className="text-[12px] px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-gray-600 hover:border-emerald-400 hover:text-emerald-700 inline-flex items-center gap-1 transition">
        <Plus className="w-3.5 h-3.5" />{tDich("Khách vãng lai (tư vấn ngay, không đặt trước)")}
      </button>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {days.map((d) => (
          <button key={d} onClick={() => router.push(`/lich-tu-van?ngay=${d}`)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold whitespace-nowrap border transition ${d === date ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-600 border-gray-200 hover:border-emerald-300"}`}>
            {d === today ? tDich("Hôm nay") : dm(d)}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-[13px] min-w-[640px]">
          <thead>
            <tr>
              <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">{tDich("Giờ")}</th>
              {staff.map((s) => (
                <th key={s.id} className="text-left px-3 py-2 text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <span className="inline-flex items-center gap-1"><UserRound className="w-3 h-3" />{s.full_name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map((t) => (
              <tr key={t}>
                <td className="px-3 py-1.5 font-semibold text-gray-500 tabular-nums border-b border-gray-50">{t}</td>
                {staff.map((s) => {
  const { t: tDich } = useLang();
                  const c = at(t, s.id);
                  return (
                    <td key={s.id} className="px-2 py-1.5 border-b border-gray-50">
                      {c ? (
                        <div className={`rounded-lg border px-2 py-1.5 ${STATUS[c.status]?.cls || STATUS.dat.cls}`}>
                          <div className="font-semibold truncate">{c.customer_name}</div>
                          <div className="text-[11px] opacity-70 truncate">{c.customer_phone || ""}{c.source ? ` · ${c.source}` : ""}</div>
                          {c.status === "dat" && (
                            <div className="flex gap-1 mt-1">
                              <button onClick={() => mark(c.id, "den")} disabled={pending} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-600 text-white inline-flex items-center gap-0.5"><Check className="w-2.5 h-2.5" />{tDich("Đến")}</button>
                              <button onClick={() => mark(c.id, "vang")} disabled={pending} className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">{tDich("Vắng")}</button>
                              <button onClick={() => mark(c.id, "huy")} disabled={pending} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{tDich("Huỷ")}</button>
                            </div>
                          )}
                          {c.status !== "dat" && <div className="text-[10px] mt-0.5">{tDich(STATUS[c.status]?.label)}</div>}
                        </div>
                      ) : (
                        <button onClick={() => { setForm({ time: t, staff: s }); setErr(""); }}
                          className="w-full text-[11px] text-gray-300 hover:text-emerald-600 border border-dashed border-gray-200 hover:border-emerald-300 rounded-lg py-1.5 inline-flex items-center justify-center gap-1 transition">
                          <Plus className="w-3 h-3" />{tDich("Đặt khách")}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-gray-400">
        {tDich("Máy tự nhắn nhắc khách vào 19:30 hôm trước. Buổi khách không dự nhớ bấm &quot;Vắng&quot; — tỷ lệ đến là số để cải tiến, không phải để đẹp sổ.")}
      </p>

      {walk && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50" onClick={() => setWalk(false)}>
          <div className="bg-white rounded-2xl p-4 w-full max-w-sm space-y-2.5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-gray-800">{tDich("Khách vãng lai")}</div>
              <button onClick={() => setWalk(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="text-[12px] text-gray-500">{tDich("Ghi nhận buổi tư vấn đang diễn ra — máy tự lấy khung giờ hiện tại và đánh dấu đã đến.")}</div>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={tDich("Tên khách")}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={tDich("Số điện thoại")} inputMode="numeric"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={tDich("Khách hỏi gì, quan tâm sản phẩm nào")}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            {err && <div className="text-[12px] text-rose-600">{err}</div>}
            <button onClick={submitWalk} disabled={pending}
              className="w-full py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60">
              {pending ? tDich("Đang lưu...") : tDich("Ghi nhận buổi tư vấn")}
            </button>
          </div>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50" onClick={() => setForm(null)}>
          <div className="bg-white rounded-2xl p-4 w-full max-w-sm space-y-2.5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-gray-800">{tDich("Đặt buổi tư vấn 30 phút")}</div>
              <button onClick={() => setForm(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="text-[12px] text-gray-500">{dm(date)} · {form.time} · {form.staff.full_name}</div>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={tDich("Tên khách")}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={tDich("Số điện thoại")} inputMode="numeric"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            <select value={source} onChange={(e) => setSource(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
              <option value="quyen-loi-the">{tDich("Quyền lợi thẻ thành viên")}</option>
              <option value="combo">{tDich("Quà kèm combo lớn")}</option>
              <option value="quiz">{tDich("Từ quiz / nội dung")}</option>
              <option value="khach-moi">{tDich("Khách mới quan tâm")}</option>
              <option value="khach-cu">{tDich("Khách cũ quay lại")}</option>
            </select>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={tDich("Ghi chú (nhu cầu, sản phẩm đang dùng...)")}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            {err && <div className="text-[12px] text-rose-600">{err}</div>}
            <button onClick={submit} disabled={pending}
              className="w-full py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60">
              {pending ? tDich("Đang lưu...") : tDich("Đặt lịch")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
