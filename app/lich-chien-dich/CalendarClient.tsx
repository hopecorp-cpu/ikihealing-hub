"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useTransition } from "react";
import { CalendarRange, Loader2, Wand2, Play, Target, Zap, Gift, Clock, Layers } from "lucide-react";
import type { MonthPlan, QuarterRollup } from "@/lib/campaign-calendar";
import type { Funnel } from "@/lib/content-plan";
import type { SalesEvent } from "@/lib/sales-events";
import { EVENT_LABEL } from "@/lib/sales-events";
import { generateAction, runWeekAction, runEventAction } from "./actions";

type Head = {
  annualTarget: number; quarter: { q: number; label: string; target: number; actual: number; pct: number | null };
  monthTarget: number; monthActual: number; gap: number; pacePct: number; expectedPct: number; finLight: "green" | "yellow" | "red";
} | null;

const vnd = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n || 0)) + "đ";
const dot = (l?: string) => (l === "green" ? "bg-emerald-500" : l === "red" ? "bg-red-500" : "bg-amber-500");
const FUNNEL_CLS: Record<Funnel, string> = {
  TOFU: "bg-sky-100 text-sky-700 border-sky-200",
  MOFU: "bg-violet-100 text-violet-700 border-violet-200",
  BOFU: "bg-rose-100 text-rose-700 border-rose-200",
};

export default function CalendarClient({ month, head, plan, quy, events = [] }: { month: string; head: Head; plan: MonthPlan | null; quy?: QuarterRollup | null; events?: SalesEvent[] }) {
  const { t: t } = useLang();
  const [ppw, setPpw] = useState(plan?.postsPerWeek || 3);
  const [gen, startGen] = useTransition();
  const [runningWeek, setRunningWeek] = useState<number | null>(null);
  const [runningEvent, setRunningEvent] = useState<string | null>(null);
  const [, startRun] = useTransition();
  const [, startEvent] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function runEvent(e: SalesEvent) {
    setMsg(null); setRunningEvent(e.date);
    startEvent(async () => {
      const r = await runEventAction(e.name, e.hook);
      setRunningEvent(null);
      setMsg(r.ok ? { ok: true, text: `${e.name}: ${r.passed} bài đạt (đã đẩy duyệt Telegram), ${r.failed} trượt.` } : { ok: false, text: r.error || "Lỗi" });
    });
  }

  function generate() {
    setMsg(null);
    startGen(async () => {
  const { t: t } = useLang();
      const r = await generateAction(month, ppw);
      setMsg(r.ok ? { ok: true, text: t("Đã sinh lịch tháng. Tải lại để xem.") } : { ok: false, text: r.error || "Lỗi" });
      if (r.ok) location.reload();
    });
  }
  function runWeek(week: number) {
    setMsg(null); setRunningWeek(week);
    startRun(async () => {
      const r = await runWeekAction(month, week);
      setRunningWeek(null);
      setMsg(r.ok ? { ok: true, text: `Tuần ${week}: ${r.passed} bài đạt (đã đẩy duyệt Telegram), ${r.failed} trượt.` } : { ok: false, text: r.error || "Lỗi" });
    });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarRange className="w-6 h-6 text-brand-600" /> {t("Lịch chiến dịch")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("Từ mục tiêu doanh thu")} <b>{t("năm → quý → tháng")}</b>{t(", tự phân rã xuống")} <b>{t("tuần → ngày đăng")}</b> {t("bám tuyến bài. Chậm nhịp thì dồn chốt (BOFU) cuối tháng.")}</p>
      </div>

      {quy && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm font-semibold flex items-center gap-2"><Layers className="w-4 h-4 text-brand-600" /> {t("Tổng hợp")} {t(quy.label)}</div>
            <div className="text-xs text-gray-500 tabular-nums">{quy.daXep} {t("bài đã xếp ·")} {quy.daViet} {t("đã viết ·")} <b className="text-gray-700">{quy.daDang} {t("đã đăng")}</b></div>
          </div>

          <div className="mt-3 flex h-2.5 rounded-full overflow-hidden bg-gray-100">
            <div className="bg-sky-400" style={{ width: `${quy.tyLeTang.TOFU}%` }} title={`TOFU ${quy.tyLeTang.TOFU}%`} />
            <div className="bg-violet-400" style={{ width: `${quy.tyLeTang.MOFU}%` }} title={`MOFU ${quy.tyLeTang.MOFU}%`} />
            <div className="bg-rose-400" style={{ width: `${quy.tyLeTang.BOFU}%` }} title={`BOFU ${quy.tyLeTang.BOFU}%`} />
          </div>
          <div className="mt-1.5 flex gap-3 text-[11px] text-gray-500 tabular-nums">
            <span><i className="inline-block w-2 h-2 rounded-full bg-sky-400 mr-1" />{t("Nuôi")} {quy.tyLeTang.TOFU}%</span>
            <span><i className="inline-block w-2 h-2 rounded-full bg-violet-400 mr-1" />{t("Thuyết phục")} {quy.tyLeTang.MOFU}%</span>
            <span><i className="inline-block w-2 h-2 rounded-full bg-rose-400 mr-1" />{t("Chốt")} {quy.tyLeTang.BOFU}%</span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {quy.months.map((m) => (
              <div key={m.month} className={`rounded-lg border p-2.5 ${m.month === month ? "border-brand-300 bg-brand-50" : m.coLich ? "border-gray-200" : "border-dashed border-gray-300 bg-gray-50"}`}>
                <div className="text-xs font-semibold tabular-nums">{t("Tháng")} {Number(m.month.slice(5))}</div>
                {m.coLich ? (
                  <>
                    <div className="text-[11px] text-gray-600 mt-1 tabular-nums">{m.daDang}/{m.daXep} {t("đã đăng")}</div>
                    <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full bg-brand-500" style={{ width: `${m.daXep ? Math.round((m.daDang / m.daXep) * 100) : 0}%` }} />
                    </div>
                    {m.behind && <div className="text-[10px] text-red-600 mt-1">{t("chậm nhịp")}</div>}
                  </>
                ) : <div className="text-[11px] text-gray-400 mt-1">{t("chưa dựng lịch")}</div>}
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-600 mt-3">{quy.nhanXet}</p>
        </div>
      )}

      {head && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 flex items-center gap-1"><Target className="w-3.5 h-3.5" /> {t("Mục tiêu NĂM 2026")}</div>
            <div className="text-lg font-bold mt-1 tabular-nums">{vnd(head.annualTarget)}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500">{t(head.quarter.label)}</div>
            <div className="text-lg font-bold mt-1 tabular-nums">{vnd(head.quarter.actual)} <span className="text-sm font-normal text-gray-400">/ {vnd(head.quarter.target)}</span></div>
            <div className="text-xs text-gray-500 mt-0.5">{head.quarter.pct != null ? head.quarter.pct + "%" : "—"}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${dot(head.finLight)}`} /> {t("Tháng")} {month.slice(5)}</div>
            <div className="text-lg font-bold mt-1 tabular-nums">{vnd(head.monthActual)} <span className="text-sm font-normal text-gray-400">/ {vnd(head.monthTarget)}</span></div>
            <div className="text-xs text-gray-500 mt-0.5">{t("Nhịp")} {head.pacePct}{t("% (kỳ vọng")} {head.expectedPct}%){head.gap > 0 ? ` · còn thiếu ${vnd(head.gap)}` : ""}</div>
          </div>
        </div>
      )}

      {events.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-amber-500" strokeWidth={2} />
            <h2 className="font-semibold text-sm">{t("Sự kiện bán hàng đề xuất — tháng")} {month.slice(5)}</h2>
          </div>
          <p className="text-xs text-gray-500 mb-3">{t("Ngày đôi flash · dịp lễ · gói membership — kèm giờ vàng. Ưu đãi =")} <b>{t("TẶNG QUÀ")}</b> {t("(không chiết khấu %). Bấm \"Giao\" để Dispatch viết bài chốt.")}</p>
          <div className="space-y-2">
            {events.map((e) => (
              <div key={e.date} className="flex items-start gap-3 border border-gray-100 rounded-lg p-2.5 bg-gray-50/60">
                <div className="text-center shrink-0 w-12">
                  <div className="text-lg font-bold leading-none tabular-nums">{e.day}</div>
                  <div className="text-[10px] text-gray-400">/{month.slice(5)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-sm">{e.name}</span>
                    {e.big && <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200 font-semibold">{t("ĐỈNH")}</span>}
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">{EVENT_LABEL[e.type]}</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5 flex items-center gap-1"><Clock className="w-3 h-3 text-amber-500" /> {t("Giờ vàng")} {e.goldenHour}</div>
                  <div className="text-xs text-gray-500 mt-0.5 flex items-start gap-1"><Gift className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" /> {e.hook}</div>
                </div>
                <button onClick={() => runEvent(e)} disabled={runningEvent !== null}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 disabled:opacity-50">
                  {runningEvent === e.date ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  Giao
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <label className="text-sm">{t("Bài / tuần")}
          <select value={ppw} onChange={(e) => setPpw(Number(e.target.value))} className="ml-2 border border-gray-300 rounded px-2 py-1 text-sm bg-white">
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button onClick={generate} disabled={gen}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60">
          {gen ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          {plan ? t("Sinh lại lịch tháng") : t("Sinh lịch tháng từ mục tiêu")}
        </button>
        {msg && <span className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</span>}
      </div>

      {plan?.focus && (
        <div className="text-sm bg-brand-50 border border-brand-100 text-brand-800 rounded-lg px-4 py-2">
          <b>{t("Trọng tâm tháng:")}</b> {plan.focus}
        </div>
      )}

      {!plan ? (
        <p className="text-sm text-gray-400">{t("Chưa có lịch. Bấm \"Sinh lịch tháng từ mục tiêu\" để tạo.")}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {plan.weeks.map((w) => (
            <div key={w.week} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{t("Tuần")} {w.week}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${FUNNEL_CLS[w.funnel]}`}>{w.funnel}</span>
                </div>
                <span className="text-[11px] text-gray-400">{w.from.slice(8)}–{w.to.slice(8)}/{w.to.slice(5, 7)}</span>
              </div>
              <div className="text-xs text-gray-500 mb-2">{w.theme}</div>
              <div className="space-y-1 mb-3">
                {w.slots.map((s) => (
                  <div key={s.date} className="flex items-center gap-2 text-sm">
                    <span className="text-[11px] tabular-nums text-gray-400 w-16 shrink-0">{s.weekday} {s.date.slice(8)}/{s.date.slice(5, 7)}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 ${FUNNEL_CLS[s.funnel]}`}>{s.funnel}</span>
                    <span className="text-gray-600 text-xs truncate">{s.pillar}</span>
                  </div>
                ))}
                {w.slots.length === 0 && <div className="text-xs text-gray-400">{t("(Tuần không có ngày đăng)")}</div>}
              </div>
              <button onClick={() => runWeek(w.week)} disabled={runningWeek !== null || w.slots.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-brand-200 text-brand-700 bg-brand-50 hover:bg-brand-100 disabled:opacity-50">
                {runningWeek === w.week ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                {t("Chạy tuần này (")}{w.postsPlanned} {t("bài)")}
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400">{t("\"Chạy tuần này\" cho Dispatch viết đúng số bài + funnel của tuần, qua Cửa QA rồi đẩy anh duyệt trên Telegram. Ảnh + logo tự vẽ. Không tự đăng.")}</p>
    </div>
  );
}
