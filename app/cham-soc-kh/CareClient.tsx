"use client";
import { useState } from "react";
import { useLang } from "@/components/lang-provider";

type C = {
  phone: string; name: string; sale: string; lastDate: string; lastProduct: string; spent: number;
  daysSince: number; reorder: boolean; stopped?: boolean;
  flow_type: string; current_day: number | null; last_contact: string | null; next_due: string | null; status: string; note: string; due: boolean;
};

const flowDays = (flows: Record<string, Flow[]>, flow: string): number[] => {
  const ds = [...new Set((flows[flow] || []).map(x => parseInt(x.day)).filter(Number.isFinite))].sort((a, b) => a - b);
  return ds.length ? ds : [0];
};
const fmtVND = (n: number) => (n || 0).toLocaleString("vi") + "đ";
const dmy = (s: string | null) => s ? `${s.slice(8)}/${s.slice(5, 7)}` : "—";
type Flow = { day: string; goal: string; message: string; huongDan?: string; neuKhach?: { khach: string; dap: string }[] };

function CopyMsg({ text }: { text: string }) {
  const { t } = useLang();
  const [ok, setOk] = useState(false);
  return <button type="button" onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}
    className={`text-[11px] px-2 py-1 rounded ${ok ? "bg-emerald-600 text-white" : "bg-blue-600 text-white"}`}>{ok ? t("✓ Đã copy") : t("Copy gửi khách")}</button>;
}

function Card({ c, canSeeSale, flows, cared, onCared }: { c: C; canSeeSale: boolean; flows: Record<string, Flow[]>; cared?: boolean; onCared?: () => void }) {
  const { t } = useLang();

  const initialFlow = c.reorder && c.flow_type !== "notBought" ? "reorder" : c.flow_type;
  const [flow, setFlow] = useState(initialFlow);
  const [day, setDay] = useState<number>(c.current_day ?? -1);
  const [note, setNote] = useState(c.note || "");
  const [sent, setSent] = useState("");
  const [callRes, setCallRes] = useState("tuvan");
  const [stopped, setStopped] = useState(!!c.stopped);
  const [state, setState] = useState<{ saving: boolean; next?: string | null; done?: boolean; err?: string }>({ saving: false });
  const dirty = flow !== initialFlow || day !== (c.current_day ?? -1) || note !== (c.note || "");

  async function save() {
    setState({ saving: true });
    try {
      const r = await fetch("/api/care", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: c.phone, name: c.name, sale_name: c.sale, flow_type: flow, current_day: day < 0 ? 0 : day, note }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "lỗi");
      setState({ saving: false, next: j.next_due, done: j.status === "done" });
      onCared?.();
    } catch (e: any) { setState({ saving: false, err: e.message }); }
  }

  async function setStop(stop: boolean, reason?: string) {
    setState({ saving: true });
    try {
      const r = await fetch("/api/care", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: c.phone, name: c.name, sale_name: c.sale, [stop ? "stop" : "resume"]: true, reason: reason ?? note }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "lỗi");
      setStopped(stop);
      setState({ saving: false });
    } catch (e: any) { setState({ saving: false, err: e.message }); }
  }

  const days = flowDays(flows, flow);
  const sug = day >= 0 ? day : (flow === "reorder" ? 0 : (days.filter(d => d <= c.daysSince).slice(-1)[0] ?? days[0]));
  const m = (flows[flow] || []).find(x => parseInt(x.day) === sug);
  const nextLabel = state.next !== undefined ? (state.done ? t("✓ xong") : dmy(state.next || null)) : (c.status === "done" ? t("✓ xong") : dmy(c.next_due));

  return (
    <div className={`bg-white border rounded-xl p-3 sm:p-4 transition-opacity ${cared ? "opacity-60 border-gray-200" : c.reorder ? "border-orange-200 bg-orange-50/30" : c.due ? "border-amber-200 bg-amber-50/30" : "border-gray-200"}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <div className="font-medium text-sm flex items-center flex-wrap gap-1.5">
            <span>{c.name}</span>
            {c.reorder && <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full whitespace-nowrap">{t("nhắc tái mua")}</span>}
            {c.due && !c.reorder && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full whitespace-nowrap">{t("cần chăm")}</span>}
            {cared && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full whitespace-nowrap">{t("✓ đã chăm hôm nay")}</span>}
            {stopped && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full whitespace-nowrap">{t("ngừng chăm")}</span>}
          </div>
          <div className="text-[11px] text-gray-400">{c.phone}{canSeeSale && c.sale ? ` · ${c.sale}` : ""}</div>
        </div>
        <div className="text-[11px] text-gray-500 sm:text-right min-w-0">
          <div className="truncate max-w-[220px]">{c.lastProduct}</div>
          <div className="text-gray-400">{dmy(c.lastDate)} · {fmtVND(c.spent)} · <span className={c.reorder ? "text-orange-600 font-medium" : ""}>{c.daysSince}{t("n trước")}</span></div>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <select value={stopped ? "stop" : flow} disabled={state.saving} onChange={e => {
          const v = e.target.value;
          if (v === "stop") {
            const why = window.prompt(t("Lý do ngừng chăm khách này? (bom hàng, khách xin đừng nhắn…)"), note || t("bom hàng"));
            if (why == null) return;
            setNote(why); setStop(true, why); return;
          }
          setFlow(v); setDay(-1);
          if (stopped) setStop(false);
        }} className={`text-xs border rounded-lg p-1.5 ${stopped ? "border-red-300 bg-red-50 text-red-700" : "border-gray-200"}`}>
          <option value="bought">{t("Đã mua")}</option>
          <option value="reorder">{t("Chăm lại (tái mua)")}</option>
          <option value="notBought">{t("Chưa mua")}</option>
          <option value="stop">{t("Ngừng chăm (bom hàng)")}</option>
        </select>
        <select value={day} onChange={e => setDay(Number(e.target.value))} className="text-xs border border-gray-200 rounded-lg p-1.5">
          <option value={-1}>{t("— tự gợi ý —")}</option>
          {days.map(d => <option key={d} value={d}>{t("Ngày")} {d}</option>)}
        </select>
        <div className="ml-auto text-[11px] text-gray-500 flex items-center gap-2 whitespace-nowrap">
          <span>{t("Lần cuối:")} {dmy(c.last_contact)}</span>
          <span className={c.due ? "text-red-600 font-medium" : ""}>{t("Hẹn kế:")} {nextLabel}</span>
        </div>
      </div>

      {stopped && (
        <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-2.5 flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-red-700 font-medium">{t("Đã ngừng chăm sóc")}{note ? ` — ${note}` : ""}</span>
          <button type="button" disabled={state.saving} onClick={() => setStop(false)}
            className="ml-auto text-[11px] px-2 py-1 rounded bg-white border border-red-200 text-red-700">
            {state.saving ? "..." : t("Chăm lại")}
          </button>
        </div>
      )}

      {!stopped && m && (
        <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg p-2.5">
          <div className="text-[11px] text-blue-700 font-semibold mb-1">{t("Ngày")} {sug} — {t(m.goal)}</div>
          {m.huongDan && <div className="text-[11px] text-gray-500 italic mb-1.5">{m.huongDan}</div>}
          <div className="text-[12px] text-gray-700 mb-2 whitespace-pre-wrap leading-relaxed">{m.message}</div>
          {!!m.neuKhach?.length && (
            <details className="mb-2">
              <summary className="text-[11px] text-blue-700 cursor-pointer select-none">{t("Kịch bản chi tiết — khách nói gì, đáp gì")} ({m.neuKhach.length})</summary>
              <div className="mt-1.5 space-y-1.5">
                {m.neuKhach.map((n, i) => (
                  <div key={i} className="bg-white border border-blue-100 rounded p-2">
                    <div className="text-[11px] font-medium text-gray-600 mb-1">{n.khach}</div>
                    <div className="text-[12px] text-gray-700 whitespace-pre-wrap leading-relaxed mb-1.5">{n.dap}</div>
                    <CopyMsg text={n.dap} />
                  </div>
                ))}
              </div>
            </details>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <CopyMsg text={m.message} />
            <button type="button" onClick={async () => {
              setSent("...");
              try { await fetch("/api/care", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: c.phone, name: c.name, sale_name: c.sale, flow_type: flow, current_day: sug, note }) }); setSent(t("✓ đã ghi")); onCared?.(); setTimeout(() => setSent(""), 2000); }
              catch { setSent(t("lỗi")); }
            }} className="text-[11px] px-2 py-1 rounded bg-emerald-600 text-white">{t("Đã gửi")}</button>
            <select value={callRes} onChange={e => setCallRes(e.target.value)} title={t("Kết quả cuộc gọi")} className="text-[11px] border border-gray-200 rounded px-1.5 py-1">
              <option value="tuvan">{t("đang tư vấn")}</option>
              <option value="chot">{t("chốt")}</option>
              <option value="hen">{t("hẹn lại")}</option>
              <option value="miss">{t("không nghe")}</option>
            </select>
            <button type="button" title={t("Tệp nóng nên GỌI, đừng chỉ nhắn")} onClick={async () => {
              setSent("...");
              try { await fetch("/api/care", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: c.phone, name: c.name, sale_name: c.sale, flow_type: flow, current_day: sug, note, channel: "call", callOutcome: callRes }) }); setSent(t("✓ đã gọi")); onCared?.(); setTimeout(() => setSent(""), 2000); }
              catch { setSent(t("lỗi")); }
            }} className="text-[11px] px-2 py-1 rounded bg-blue-600 text-white">{t("Đã gọi")}</button>
            <button type="button" title={t("Tặng quà sau khi khách thanh toán (cẩm nang/quà qua Zalo)")} onClick={async () => {
              setSent("...");
              try { await fetch("/api/care", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: c.phone, name: c.name, sale_name: c.sale, flow_type: flow, current_day: sug, note, gift: true }) }); setSent(t("✓ đã tặng quà")); onCared?.(); setTimeout(() => setSent(""), 2000); }
              catch { setSent(t("lỗi")); }
            }} className="text-[11px] px-2 py-1 rounded bg-amber-500 text-white">{t("Đã tặng quà")}</button>
            {sent && <span className="text-[10px] text-emerald-700">{sent}</span>}
          </div>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input value={note} onChange={e => setNote(e.target.value)} placeholder={t("ghi chú…")} className="text-xs border border-gray-200 rounded-lg p-1.5 flex-1 min-w-[140px]" />
        {dirty && (
          <button onClick={save} disabled={state.saving}
            className="text-xs px-3 py-1.5 rounded-lg shrink-0 bg-gray-700 text-white">
            {state.saving ? "..." : state.err ? t("Lỗi!") : t("Lưu ghi chú")}
          </button>
        )}
        {!cared && !stopped && (
          <button type="button" disabled={state.saving} onClick={async () => {
  const { t: t } = useLang();
            setState({ saving: true });
            try {
              const r = await fetch("/api/care", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: c.phone, name: c.name, sale_name: c.sale, flow_type: flow, current_day: sug, note }) });
              if (!r.ok) throw new Error((await r.json()).error || t("lỗi"));
              onCared?.();
              setState({ saving: false });
            } catch (e: any) { setState({ saving: false, err: e.message }); }
          }} className="text-xs px-3 py-1.5 rounded-lg shrink-0 bg-emerald-600 text-white font-medium">
            {state.saving ? "..." : t("✓ Đã chăm hôm nay")}
          </button>
        )}
        {cared && <span className="text-xs px-3 py-1.5 rounded-lg shrink-0 bg-emerald-50 text-emerald-600 font-medium">{t("✓ Đã chăm")}</span>}
      </div>
    </div>
  );
}

function AddCaredForm({ saleName, onAdded }: { saleName: string; onAdded: () => void }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [called, setCalled] = useState(false);
  const [outcome, setOutcome] = useState("tuvan");
  const [gift, setGift] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    if (!phone.trim()) { setMsg(t("Cần số điện thoại")); return; }
    setBusy(true); setMsg("");
    try {
      const body: any = { phone: phone.trim(), name: name.trim() || phone.trim(), sale_name: saleName, flow_type: "bought", current_day: 0, note: note.trim() };
      if (called) { body.channel = "call"; body.callOutcome = outcome; }
      if (gift) body.gift = true;
      const r = await fetch("/api/care", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json()).error || "lỗi");
      setMsg(t("✓ Đã ghi nhận"));
      setName(""); setPhone(""); setNote(""); setCalled(false); setGift(false);
      onAdded();
      setTimeout(() => setMsg(""), 2000);
    } catch (e: any) { setMsg(t("Lỗi: ") + e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
      <button type="button" onClick={() => setOpen(o => !o)} className="text-sm font-semibold text-emerald-800 flex items-center gap-1">
        {t("Thêm khách đã chăm (ngoài danh sách)")} <span className="text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <div className="text-[11px] text-emerald-700">{t("Khách bạn chăm/gọi mà chưa có trong danh sách tự cào — ghi vào đây để không bị sót (tính vào KPI chăm sóc).")}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input value={name} onChange={e => setName(e.target.value)} placeholder={t("Tên khách")} className="p-2 border border-gray-200 rounded-lg text-sm" />
            <input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" placeholder={t("Số điện thoại *")} className="p-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder={t("Ghi chú (nỗi đau / nội dung đã trao đổi)")} className="w-full p-2 border border-gray-200 rounded-lg text-sm" />
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={called} onChange={e => setCalled(e.target.checked)} /> {t("Đã gọi")}</label>
            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={gift} onChange={e => setGift(e.target.checked)} /> {t("Đã tặng quà")}</label>
            {called && (
              <select value={outcome} onChange={e => setOutcome(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
                <option value="tuvan">{t("đang tư vấn")}</option>
                <option value="chot">{t("chốt")}</option>
                <option value="hen">{t("hẹn lại")}</option>
                <option value="miss">{t("không nghe")}</option>
              </select>
            )}
            <button type="button" onClick={save} disabled={busy} className="text-sm px-3 py-1.5 rounded-lg bg-emerald-600 text-white disabled:opacity-50 ml-auto">{busy ? "..." : t("Lưu khách đã chăm")}</button>
            {msg && <span className="text-xs text-emerald-700">{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

type StageKey = "due" | "reorder" | "flow" | "cared" | "idle";
const STAGES: { key: StageKey; label: string; color: string }[] = [
  { key: "due", label: "Cần chăm hôm nay", color: "#EF4444" },
  { key: "reorder", label: "Sắp tái mua", color: "#F97316" },
  { key: "flow", label: "Đang chăm", color: "#3B82F6" },
  { key: "cared", label: "Đã chăm hôm nay", color: "#10B981" },
  { key: "idle", label: "Tạm dừng / Xong", color: "#9CA3AF" },
];
function stageOf(c: C, cared: boolean): StageKey {
  if (c.stopped) return "idle";
  if (cared) return "cared";
  if (c.status === "paused" || c.status === "done") return "idle";
  if (c.due) return "due";
  if (c.reorder) return "reorder";
  return "flow";
}

export default function CareClient({ customers, canSeeSale, defaultSale, meName, today, flows }: { customers: C[]; canSeeSale: boolean; defaultSale: string; meName?: string; today?: string; flows: Record<string, Flow[]> }) {
  const { t } = useLang();
  const [q, setQ] = useState("");
  const [addedExtra, setAddedExtra] = useState(0);
  const [view, setView] = useState<"pipeline" | "list">("pipeline");
  const [selected, setSelected] = useState<C | null>(null);
  const [onlyDue, setOnlyDue] = useState(false);
  const [onlyReorder, setOnlyReorder] = useState(false);
  const [onlyCared, setOnlyCared] = useState(false);
  const [hideCared, setHideCared] = useState(true);
  const [quickBusy, setQuickBusy] = useState("");

  const [caredNow, setCaredNow] = useState<Set<string>>(new Set());
  const isCared = (c: C) => caredNow.has(c.phone) || (!!today && c.last_contact === today);
  const markCared = (phone: string) => setCaredNow(s => new Set(s).add(phone));

  const list = customers.filter(c =>
    (!onlyDue || c.due) &&
    (!onlyReorder || c.reorder) &&
    (!onlyCared || isCared(c)) &&
    (!hideCared || !isCared(c)) &&
    (!q || c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q))
  ).sort((a, b) =>

    (Number(isCared(a)) - Number(isCared(b))) ||
    (Number(b.due) - Number(a.due)) ||
    (Number(b.reorder) - Number(a.reorder)) ||
    (b.lastDate < a.lastDate ? -1 : 1)
  );
  const caredCount = customers.filter(isCared).length;
  const pendingCount = list.filter(c => !isCared(c)).length;

  const pipeCustomers = customers.filter(c => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q));
  const byStage: Record<StageKey, C[]> = { due: [], reorder: [], flow: [], cared: [], idle: [] };
  for (const c of pipeCustomers) byStage[stageOf(c, isCared(c))].push(c);

  async function quickCare(c: C) {
    setQuickBusy(c.phone);
    try {
      const flow = c.reorder && c.flow_type !== "notBought" ? "reorder" : c.flow_type;
      const qd = flowDays(flows, flow);
      const sug = c.current_day ?? (flow === "reorder" ? 0 : (qd.filter(d => d <= c.daysSince).slice(-1)[0] ?? qd[0]));
      const r = await fetch("/api/care", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: c.phone, name: c.name, sale_name: c.sale, flow_type: flow, current_day: sug, note: c.note || "" }) });
      if (!r.ok) throw new Error((await r.json()).error || "lỗi");
      markCared(c.phone);
    } catch { alert(t("Lỗi ghi nhận — thử lại")); }
    finally { setQuickBusy(""); }
  }

  return (
    <div className="space-y-3">
      <AddCaredForm saleName={meName || defaultSale || ""} onAdded={() => setAddedExtra(n => n + 1)} />
      {addedExtra > 0 && <div className="text-xs text-emerald-700">✓ {t("Đã ghi thêm")} {addedExtra} {t("khách chăm ngoài danh sách hôm nay.")}</div>}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          <button type="button" onClick={() => setView("pipeline")} className={`px-3 py-1 rounded-md text-xs font-medium ${view === "pipeline" ? "bg-white shadow-sm text-gray-800" : "text-gray-500"}`}>{t("Pipeline")}</button>
          <button type="button" onClick={() => setView("list")} className={`px-3 py-1 rounded-md text-xs font-medium ${view === "list" ? "bg-white shadow-sm text-gray-800" : "text-gray-500"}`}>{t("Danh sách")}</button>
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={t("Tìm tên / SĐT…")} className="p-2 border border-gray-200 rounded-lg text-sm flex-1 min-w-[160px]" />
        {view === "list" && (<>
          <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={onlyReorder} onChange={e => setOnlyReorder(e.target.checked)} /> {t("Nên nhắc tái mua")}</label>
          <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={onlyDue} onChange={e => setOnlyDue(e.target.checked)} /> {t("Cần chăm")}</label>
          <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={onlyCared} onChange={e => { setOnlyCared(e.target.checked); if (e.target.checked) setHideCared(false); }} /> {t("Đã chăm hôm nay")} <span className="text-emerald-600 font-medium">({caredCount})</span></label>
          <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={hideCared} onChange={e => { setHideCared(e.target.checked); if (e.target.checked) setOnlyCared(false); }} /> {t("Ẩn đã chăm")}</label>
        </>)}
        <span className="text-xs text-gray-400"><b className="text-gray-600">{pendingCount}</b> {t("chưa chăm")} / {view === "pipeline" ? pipeCustomers.length : list.length} {t("khách")}</span>
      </div>

      {view === "pipeline" && (
        <div className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1 snap-x">
          {STAGES.map(st => {
            const cs = byStage[st.key];
            const total = cs.reduce((s, c) => s + (c.spent || 0), 0);
            return (
              <section key={st.key} className="snap-start w-[262px] shrink-0 rounded-2xl border border-gray-200/80 bg-gray-50/70 flex flex-col max-h-[70vh]">
                <div className="flex items-center gap-2 px-3.5 pt-3.5 pb-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: st.color }} />
                  <h3 className="text-[12px] font-bold tracking-wide text-gray-700 uppercase">{t(st.label)}</h3>
                  <span className="ml-auto text-[11px] font-bold text-gray-500 bg-white border border-gray-200 rounded-full px-1.5 py-0.5">{cs.length}{total > 0 && <span className="sensitive font-normal"> · {Math.round(total / 1e6 * 10) / 10}tr</span>}</span>
                </div>
                <div className="h-px mx-3.5 mb-1" style={{ background: `linear-gradient(90deg, ${st.color}33, transparent)` }} />
                <div className="px-2.5 pb-3 pt-1 space-y-2 overflow-y-auto">
                  {cs.slice(0, 60).map(c => (
                    <div key={c.phone} className="border border-gray-200 rounded-xl p-2.5 bg-white hover:shadow-md transition cursor-pointer" onClick={() => setSelected(c)}>
                      <div className="text-[12px] font-medium text-gray-800 truncate">
                        {c.name}
                        {c.stopped && <span className="ml-1 text-[9px] bg-red-100 text-red-700 px-1 py-0.5 rounded-full align-middle">{t("ngừng")}</span>}
                      </div>
                      <div className="text-[10px] text-gray-400 flex items-center gap-1 flex-wrap">
                        <a href={`tel:${c.phone}`} onClick={e => e.stopPropagation()} className="text-blue-600">{c.phone}</a>
                        {canSeeSale && c.sale && <span>· {c.sale.split(/\s+/).slice(-1)[0]}</span>}
                        <span>· {c.daysSince}{t("n")}</span>
                      </div>
                      <div className="text-[10px] text-gray-400 truncate">{c.lastProduct}</div>
                      <div className="flex justify-between items-center mt-1" onClick={e => e.stopPropagation()}>
                        <span className="text-[10px] text-gray-400 sensitive">{Math.round((c.spent || 0) / 1e3)}k</span>
                        {st.key !== "cared" && st.key !== "idle" && (
                          <button type="button" disabled={quickBusy === c.phone} onClick={() => quickCare(c)}
                            className="text-[10px] px-2 py-0.5 rounded bg-emerald-600 text-white disabled:opacity-50">{quickBusy === c.phone ? "..." : t("✓ Đã chăm")}</button>
                        )}
                      </div>
                    </div>
                  ))}
                  {cs.length > 60 && <div className="text-[10px] text-gray-400 text-center">… {t("và")} {cs.length - 60} {t("khách nữa (dùng tìm kiếm)")}</div>}
                  {!cs.length && <div className="text-[11px] text-gray-300 text-center py-4">{t("Trống")}</div>}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {view === "list" && (
      <div className="space-y-2.5">
        {list.map(c => <Card key={c.phone} c={c} canSeeSale={canSeeSale} flows={flows} cared={isCared(c)} onCared={() => markCared(c.phone)} />)}
        {list.length === 0 && <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-8 text-center text-gray-400">{t("Không có khách phù hợp.")}</div>}
      </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3" onClick={() => setSelected(null)}>
          <div className="w-full max-w-xl max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <Card c={selected} canSeeSale={canSeeSale} flows={flows} cared={isCared(selected)} onCared={() => { markCared(selected.phone); }} />
            <button type="button" onClick={() => setSelected(null)} className="mt-2 w-full py-2 rounded-xl bg-white/90 text-gray-600 text-sm font-medium">{t("Đóng")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
