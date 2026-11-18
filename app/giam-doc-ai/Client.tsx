"use client";
import { useState, useTransition } from "react";
import { PageHeader, StatCard, Badge, Card } from "@/components/ui/kit";
import { Brain, Sparkles, AlertTriangle, ListChecks, TrendingUp, RefreshCw, Plus, Check, Radar } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { createTaskFromAI } from "@/app/tasks/actions";

function AssignBtn({ ac, canAssign }: { ac: any; canAssign: boolean }) {
  const { t: t } = useLang();
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  if (!canAssign) return null;
  if (done) return <span className="text-[11px] text-emerald-600 font-semibold inline-flex items-center gap-1"><Check className="w-3 h-3" />{t("Đã tạo task")}</span>;
  return (
    <button onClick={() => start(async () => { const r = await createTaskFromAI({ title: ac.task, area: ac.area, who: ac.who, impact: ac.impact }); if (r.success) setDone(true); })}
      disabled={pending}
      className="text-[11px] px-2.5 py-1 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-semibold inline-flex items-center gap-1 shrink-0 disabled:opacity-60 transition">
      <Plus className="w-3 h-3" />{pending ? t("Đang giao…") : t("Giao việc")}
    </button>
  );
}

const tr = (n: number) => Math.round((Number(n) || 0) / 1e6) + "tr";
const HEALTH: Record<string, { tone: any; label: string }> = {
  green: { tone: "green", label: "Khoẻ" }, yellow: { tone: "amber", label: "Cần chú ý" }, red: { tone: "red", label: "Báo động" },
};
const AREA_TONE: Record<string, any> = { Sale: "blue", MKT: "violet", Kho: "amber", "Tài chính": "green", "Doanh thu": "slate" };
const RISK_COLOR: Record<string, string> = { CRITICAL: "#DC2626", HIGH: "#F97316", MEDIUM: "#F59E0B", LOW: "#94A3B8" };
const RISK_LABEL: Record<string, string> = { CRITICAL: "Nguy cấp", HIGH: "Cao", MEDIUM: "Vừa", LOW: "Thấp" };

function SignalRadar({ signals }: { signals: any[] }) {
  const { t: t } = useLang();
  if (!signals?.length) return null;
  return (
    <Card>
      <div className="font-bold text-gray-900 mb-3 flex items-center gap-2"><Radar className="w-4 h-4 text-violet-500" /> {t("Radar tín hiệu vận hành")} <span className="text-[11px] font-normal text-gray-400">{t("(chấm bằng luật số —")} {signals.length} {t("tín hiệu)")}</span></div>
      <div className="space-y-2">
        {signals.map((s: any, i: number) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-[132px] shrink-0 flex items-center gap-1.5">
              <Badge tone={AREA_TONE[s.area] || "slate"}>{s.area}</Badge>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] text-gray-800 font-medium truncate" title={s.detail}>{t(s.title)}</div>
              <div className="h-2 mt-1 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${s.impact}%`, backgroundColor: RISK_COLOR[s.risk] || "#94A3B8" }} />
              </div>
            </div>
            <div className="w-[92px] shrink-0 text-right">
              <span className="text-sm font-bold text-gray-700">{s.impact}</span>
              <span className="text-[11px] font-semibold ml-1.5" style={{ color: RISK_COLOR[s.risk] }}>{t(RISK_LABEL[s.risk]) || s.risk}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function GiamDocAIClient({ kpi, cached, canAssign = false }: { kpi: any; cached: any; canAssign?: boolean }) {
  const { t } = useLang();
  const [a, setA] = useState<any>(cached);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function analyze() {
    setLoading(true); setErr("");
    try {
      const r = await fetch("/api/giam-doc-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month: kpi.month }) });
      const j = await r.json();
      if (j.ok) setA(j.analysis); else setErr(j.reason === "no_api_key" ? "Thiếu ANTHROPIC_API_KEY" : "Lỗi phân tích: " + (j.reason || j.status || "?"));
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }

  const paceOk = kpi.pacePct >= kpi.expectedPct;
  const h = a?.health ? HEALTH[a.health] || HEALTH.yellow : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader title={t("Giám đốc Kinh doanh AI")} icon={Brain} iconColor="#8B5CF6"
        subtitle={`Phân tích xuyên suốt doanh thu → sale → combo → MKT → kho — tháng ${kpi.month}`}
        actions={<button onClick={analyze} disabled={loading}
          className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold inline-flex items-center gap-2 shadow-sm disabled:opacity-60 transition">
          {loading ? <><RefreshCw className="w-4 h-4 animate-spin" /> {t("Đang phân tích…")}</> : <><Sparkles className="w-4 h-4" /> {a ? t("Phân tích lại") : t("Phân tích ngay")}</>}
        </button>} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={t("DT / KPI tháng")} value={`${kpi.pacePct}%`} color={paceOk ? "#10B981" : "#EF4444"} icon={TrendingUp}
          hint={`${tr(kpi.monthActual)}/${tr(kpi.monthTarget)} · nhịp ${kpi.expectedPct}%`} />
        <StatCard label={t("% Chi phí MKT")} value={kpi.mktPct != null ? `${kpi.mktPct}%` : "—"} color={kpi.mktLight === "red" ? "#EF4444" : kpi.mktLight === "yellow" ? "#F59E0B" : "#10B981"} icon={Sparkles}
          hint={kpi.mktOverBudgetWarn ? t("vượt trần") : t("trong ngưỡng")} />
        <StatCard label={t("Sale tụt nhịp")} value={String(kpi.behind.length)} color={kpi.behind.length ? "#EF4444" : "#10B981"} icon={AlertTriangle}
          hint={kpi.behind.slice(0, 3).map((b: any) => b.name.split(" ").slice(-1)[0]).join(", ") || t("ổn")} />
        <StatCard label={t("Tồn kho cảnh báo")} value={`${kpi.lowCount}+${kpi.outCount}`} color={kpi.outCount ? "#EF4444" : kpi.lowCount ? "#F59E0B" : "#10B981"} icon={AlertTriangle}
          hint={`${kpi.lowCount} sắp hết · ${kpi.outCount} hết`} />
      </div>

      {err && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{err}</div>}

      {!a ? (
        <Card className="text-center py-12">
          <Brain className="w-12 h-12 text-violet-300 mx-auto mb-3" />
          <div className="font-semibold text-gray-700">{t("Chưa có phân tích cho tháng này")}</div>
          <div className="text-sm text-gray-400 mt-1">{t("Bấm")} <b>{t("\"Phân tích ngay\"")}</b> {t("để AI đọc toàn bộ số liệu và ra nhận định + việc cần làm.")}</div>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className={`rounded-2xl border p-5 ${a.health === "red" ? "border-red-200 bg-red-50/40" : a.health === "green" ? "border-emerald-200 bg-emerald-50/40" : "border-amber-200 bg-amber-50/40"}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold text-gray-700">{t("Sức khoẻ kinh doanh:")}</span>
              {h && <Badge tone={h.tone} dot>{t(h.label)}</Badge>}
              {a.generatedAt && <span className="ml-auto text-[11px] text-gray-400">{t("cập nhật")} {new Date(a.generatedAt).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}</span>}
            </div>
            <p className="text-[15px] text-gray-800 leading-relaxed">{a.summary}</p>
            {a.fallback && <div className="mt-2 text-[11px] text-amber-700 bg-amber-100/60 inline-flex items-center gap-1 px-2 py-1 rounded-lg">{t("Phân tích nhanh bằng luật số (AI tạm không khả dụng) — bấm \"Phân tích lại\" khi có mạng/API.")}</div>}
          </div>

          <SignalRadar signals={a.signals} />

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <div className="font-bold text-gray-900 mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" /> {t("Rủi ro lớn nhất")}</div>
              <div className="space-y-2.5">
                {(a.risks || []).map((r: any, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <Badge tone={AREA_TONE[r.area] || "slate"}>{r.area}</Badge>
                    <div className="text-sm text-gray-700 flex-1">{r.issue} {r.severity && <span className={`text-[11px] font-semibold ${r.severity === "cao" ? "text-red-600" : r.severity === "vừa" ? "text-amber-600" : "text-gray-400"}`}>· {r.severity}</span>}</div>
                  </div>
                ))}
                {!(a.risks || []).length && <div className="text-sm text-gray-400">{t("Không có rủi ro nổi bật.")}</div>}
              </div>
            </Card>

            <Card>
              <div className="font-bold text-gray-900 mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-500" /> {t("Cơ hội tăng doanh thu")}</div>
              <ul className="space-y-2">
                {(a.opportunities || []).map((o: string, i: number) => (
                  <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-emerald-500 shrink-0">▸</span><span>{o}</span></li>
                ))}
                {!(a.opportunities || []).length && <li className="text-sm text-gray-400">—</li>}
              </ul>
            </Card>
          </div>

          <Card>
            <div className="font-bold text-gray-900 mb-3 flex items-center gap-2"><ListChecks className="w-4 h-4 text-violet-500" /> {t("Việc cần làm hôm nay (ưu tiên)")}</div>
            <div className="space-y-2">
              {(a.actions || []).map((ac: any, i: number) => (
                <div key={i} className="flex items-start gap-3 p-2.5 rounded-xl border border-gray-100 hover:bg-gray-50 transition">
                  <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <div className="flex-1">
                    <div className="text-sm text-gray-800 font-medium">{ac.task}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                      <Badge tone={AREA_TONE[ac.area] || "slate"}>{ac.area}</Badge>
                      {ac.who && <span>{ac.who}</span>}
                      {ac.impact && <span className="text-emerald-600">→ {ac.impact}</span>}
                    </div>
                  </div>
                  <AssignBtn ac={ac} canAssign={canAssign} />
                </div>
              ))}
              {!(a.actions || []).length && <div className="text-sm text-gray-400">—</div>}
            </div>
          </Card>

          <p className="text-[11px] text-gray-400">{t("AI đọc số liệu thật (doanh thu MISA, sale, %MKT, kênh, tồn kho, lãi vay) và gợi ý theo nguyên tắc ACME (thực phẩm bổ sung · tặng quà không chiết khấu · ưu tiên SP biên cao). Là trợ lý ra quyết định — người vẫn chốt cuối.")}</p>
        </div>
      )}
    </div>
  );
}
