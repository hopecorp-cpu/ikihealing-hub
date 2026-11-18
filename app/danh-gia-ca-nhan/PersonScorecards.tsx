"use client";
import { useState, useTransition } from "react";
import { generatePersonAnalysis } from "./actions";
import { fmtVND } from "@/lib/payroll";
import { useLang } from "@/components/lang-provider";

type P = {
  id: string; name: string; position: string; dept: string; isSale: boolean;
  revenue: number; target: number; pct: number | null; orders: number; custs: number;
  chatScore: number | null; careMonth: number; callsMonth: number; chotMonth: number; reports: number; lastReport: string | null; energyAvg: number | null;
};

function mdToHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return md.split("\n").filter(l => l.trim()).map(l => {
    const t = l.trim();
    const inl = (x: string) => esc(x).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    if (/^[-*]\s/.test(t)) return `<li>${inl(t.replace(/^[-*]\s/, ""))}</li>`;
    return `<p class="my-1">${inl(t)}</p>`;
  }).join("").replace(/(<li>.*<\/li>)/s, '<ul class="list-disc pl-5 space-y-0.5">$1</ul>');
}

export default function PersonScorecards({ people, month, expectedPct, aiCache }: { people: P[]; month: string; expectedPct: number; aiCache: Record<string, string> }) {
  const depts = [...new Set(people.map(p => p.dept))];
  return (
    <div className="space-y-6">
      {depts.map(dept => (
        <div key={dept}>
          <div className="text-sm font-semibold text-gray-700 mb-2">{dept}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {people.filter(p => p.dept === dept).map(p => <Card key={p.id} p={p} month={month} expectedPct={expectedPct} cached={aiCache[p.id]} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function Card({ p, month, expectedPct, cached }: { p: P; month: string; expectedPct: number; cached?: string }) {
  const { t } = useLang();
  const [ai, setAi] = useState<string | null>(cached || null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const gen = () => { setErr(null); start(async () => {
    const r = await generatePersonAnalysis(p, month);
    if (r.ok && r.text) setAi(r.text); else setErr(r.error || t("Lỗi"));
  }); };

  const pctColor = p.pct == null ? "#9CA3AF" : p.pct >= 100 ? "#10B981" : p.pct >= expectedPct ? "#3B82F6" : "#EF4444";

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{p.name}</div>
          <div className="text-xs text-gray-400">{p.position || "—"}</div>
        </div>
        <button onClick={gen} disabled={pending} className="px-2.5 py-1 bg-violet-600 text-white rounded-lg text-xs disabled:opacity-50 flex-shrink-0">
          {pending ? "…" : ai ? "AI" : t("AI gợi ý")}
        </button>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
        {p.isSale ? (
          <>
            <span><b>{fmtVND(p.revenue)}</b></span>
            <span style={{ color: pctColor }} className="font-semibold">{p.pct == null ? "—" : p.pct + "% KPI"}</span>
            <span className="text-gray-500">{p.orders} {t("đơn")} · {p.custs} {t("khách")}</span>
            {p.chatScore != null && <span className="text-gray-600">{t("chat")} {p.chatScore}/10</span>}
            <span className={p.careMonth > 0 ? "text-emerald-600" : "text-gray-400"}>{t("chăm")} {p.careMonth}</span>
            <span className={p.callsMonth > 0 ? "text-blue-600" : "text-gray-400"}>{t("gọi")} {p.callsMonth}{p.chotMonth > 0 ? ` · ${p.chotMonth} ${t("chốt")}` : ""}</span>
          </>
        ) : (
          <span className="text-gray-500">{p.reports} {t("báo cáo ngày")}{p.energyAvg ? ` · ${t("NL")} ${p.energyAvg}/5` : ""}</span>
        )}
      </div>
      {p.isSale && <div className="text-xs text-gray-400 mt-1">{t("KPI tháng:")} {fmtVND(p.target)} · {p.reports} {t("báo cáo ngày")}</div>}

      {err && <div className="text-xs text-red-600 mt-2">{err}</div>}
      {ai && <div className="mt-2 pt-2 border-t border-gray-100 text-sm text-gray-700" dangerouslySetInnerHTML={{ __html: mdToHtml(ai) }} />}
    </div>
  );
}
