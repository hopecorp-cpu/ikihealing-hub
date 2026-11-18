"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Award, Save, Loader2, Trash2, Plus, CalendarClock, Info, Eye, Power } from "lucide-react";
import { DEPT_COMP_RATIO, DEPT_KPI_TEMPLATES, kpiCompletion, kpiLowerBetter, isMeasured } from "@/lib/dept-comp";
import { seedKpiTemplate, updateKpi, deleteKpi, saveChuyenCan, setDeptCompActive } from "./actions";

export type PersonComp = {
  id: string; name: string; position: string; dept: string; contract: string;
  maxBonus: number;
  kpis: { id: string; title: string; metric_unit: string; target_value: number; current_value: number | null; weight_percent: number; is_lower_better?: boolean | null }[];
  completion: number; bandLabel: string; kpiBonus: number;
  chuyenCan: number; chuyenCanReason: string; lateDays: number;
};

const vnd = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n || 0)) + "đ";
const TPL_KEYS = Object.keys(DEPT_KPI_TEMPLATES);

function bandColor(completion: number, hasKpi: boolean) {
  if (!hasKpi) return "bg-gray-100 text-gray-500 border-gray-200";
  if (completion >= 100) return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (completion >= 90) return "bg-blue-100 text-blue-700 border-blue-200";
  if (completion >= 70) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-red-100 text-red-700 border-red-200";
}

export default function CompClient({ cycles, selectedCycle, month, people, chuyenCanAmount, active }: {
  cycles: { id: string; name: string; status: string }[];
  selectedCycle: string; month: string; people: PersonComp[]; chuyenCanAmount: number; active: boolean;
}) {
  const { t: t } = useLang();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cc, setCc] = useState(chuyenCanAmount);
  const [msg, setMsg] = useState<string | null>(null);

  const totalKpiBonus = people.reduce((s, p) => s + p.kpiBonus, 0);
  const totalCc = people.reduce((s, p) => s + p.chuyenCan, 0);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => {
    setMsg(null);
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? okMsg : (r.error || "Lỗi"));
      if (r.ok) router.refresh();
      setTimeout(() => setMsg(null), 3000);
    });
  };

  const byDept = people.reduce((m, p) => { (m[p.dept] ||= []).push(p); return m; }, {} as Record<string, PersonComp[]>);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Award className="w-6 h-6 text-brand-600" /> {t("Cơ chế thưởng phòng ban")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("Thưởng hiệu suất non-sale theo")} <b>{t("thang 70–30–100% (trần 150%)")}</b> {t("trên quỹ thưởng từng người, cộng")} <b>{t("chuyên cần")}</b> {t("hợp pháp. Chốt số ở đây → tự vào Bảng lương.")}</p>
      </div>

      <div className={`rounded-xl border p-4 flex flex-wrap items-center gap-3 ${active ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
        {active ? <Power className="w-5 h-5 text-emerald-600 shrink-0" /> : <Eye className="w-5 h-5 text-amber-600 shrink-0" />}
        <div className="flex-1 min-w-[220px]">
          <div className={`font-semibold text-sm ${active ? "text-emerald-800" : "text-amber-800"}`}>
            {active ? t("ĐANG ÁP vào lương thật") : t("Chế độ XEM TRƯỚC — chưa áp vào lương")}
          </div>
          <div className="text-xs text-gray-600 mt-0.5">
            {active
              ? t("Thưởng KPI + chuyên cần đang được cộng vào Bảng lương khi chốt lương.")
              : t("Số tính ở đây chỉ để tham khảo/chuẩn bị. Bảng lương KHÔNG cộng thưởng KPI/chuyên cần cho tới khi anh bật.")}
          </div>
        </div>
        <button
          onClick={() => { if (!active && !confirm(t("Bật áp cơ chế vào LƯƠNG THẬT? Lần chốt lương tới sẽ cộng thưởng KPI + chuyên cần cho non-sale."))) return; act(() => setDeptCompActive(!active), active ? t("Đã TẮT (về xem trước)") : t("Đã BẬT áp vào lương")); }}
          disabled={pending}
          className={`px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60 ${active ? "bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-100" : "bg-amber-600 text-white hover:bg-amber-700"}`}>
          {active ? t("Tắt (về xem trước)") : t("Bật áp vào lương")}
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-gray-400" />
          <select value={selectedCycle} onChange={e => router.push(`/co-che-thuong?cycle=${e.target.value}`)}
            className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm">
            {cycles.map(c => <option key={c.id} value={c.id}>{c.name}{c.status === "active" ? t(" (đang mở)") : ""}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{t("Mức chuyên cần/tháng")}</span>
          <input type="number" value={cc} onChange={e => setCc(Math.max(0, Number(e.target.value) || 0))}
            className="w-28 border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-right" />
          <span className="text-sm text-gray-400">đ</span>
          <button onClick={() => act(() => saveChuyenCan(cc), t("Đã lưu mức chuyên cần"))} disabled={pending}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60">
            <Save className="w-3.5 h-3.5" /> {t("Lưu")}
          </button>
        </div>
        <div className="ml-auto flex items-center gap-4 text-sm">
          <span className="text-gray-500">{t("Thưởng KPI kỳ:")} <b className="text-gray-800">{vnd(totalKpiBonus)}</b></span>
          <span className="text-gray-500">{t("Chuyên cần:")} <b className="text-gray-800">{vnd(totalCc)}</b></span>
        </div>
        {msg && <span className={`text-sm w-full ${msg.includes("Đã") ? "text-green-600" : "text-red-600"}`}>{msg}</span>}
      </div>

      <div className="flex items-start gap-2 text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        <Info className="w-4 h-4 shrink-0 text-amber-600" />
        <span>{t("Chỉ số \"thấp tốt hơn\" (đơn hoàn, lỗi, CPO/CPL…) tự đảo chiều — đạt khi thực tế ≤ mục tiêu. Chuyên cần: mất nếu nghỉ không lương, muộn ≥15′, hoặc &gt;2 lần muộn/tháng (không trừ lương — đúng Điều 127).")}</span>
      </div>

      {Object.entries(byDept).map(([dept, list]) => {
        const ratio = DEPT_COMP_RATIO[dept];
        return (
          <section key={dept} className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-gray-800">{dept}</h2>
              {ratio && <span className="text-xs text-gray-500">{t("Cứng/Mềm đề xuất:")} <b>{ratio.fixed}/{ratio.variable}</b></span>}
            </div>

            {list.map(p => (
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900">{p.name}</div>
                    <div className="text-xs text-gray-500">{p.position} · {p.contract}</div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded border font-medium ${bandColor(p.completion, p.kpis.length > 0)}`}>
                    {p.kpis.length ? `KPI ${p.completion}% · ${p.bandLabel}` : t("Chưa có KPI")}
                  </span>
                  <div className="text-right">
                    <div className="text-xs text-gray-400">{t("Thưởng KPI")}</div>
                    <div className="font-semibold text-brand-700">{vnd(p.kpiBonus)}</div>
                    <div className="text-[11px] text-gray-400">{t("quỹ")} {vnd(p.maxBonus)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400">{t("Chuyên cần")}</div>
                    <div className={`font-semibold ${p.chuyenCan > 0 ? "text-emerald-600" : "text-gray-400"}`}>{p.chuyenCan > 0 ? vnd(p.chuyenCan) : "0"}</div>
                    <div className="text-[11px] text-gray-400 max-w-[160px] truncate" title={p.chuyenCanReason}>{p.chuyenCanReason}</div>
                  </div>
                </div>

                <div className="p-4">
                  {p.kpis.length === 0 ? (
                    <SeedRow personId={p.id} cycleId={selectedCycle} onAct={act} pending={pending} />
                  ) : (
                    <div className="space-y-2">
                      {p.kpis.map(k => {
  const { t: t } = useLang();
                        const comp = Math.round(kpiCompletion(k as any));
                        return (
                          <div key={k.id} className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="flex-1 min-w-[160px] text-gray-700">{t(k.title)}</span>
                            <select value={kpiLowerBetter(k as any) ? "low" : "high"} onChange={e => act(() => updateKpi(k.id, { is_lower_better: e.target.value === "low" }), t("Đã lưu chiều"))}
                              className="text-[11px] border border-gray-200 rounded px-1 py-1 text-gray-500" title={t("Chiều KPI")}>
                              <option value="high">{t("cao tốt hơn")}</option>
                              <option value="low">{t("thấp tốt hơn")}</option>
                            </select>
                            <span className="text-xs text-gray-400">MT</span>
                            <NumCell value={k.target_value} onSave={v => act(() => updateKpi(k.id, { target_value: v ?? 0 }), t("Đã lưu"))} />
                            <span className="text-xs text-gray-400">TT</span>
                            <NumCell value={k.current_value} nullable onSave={v => act(() => updateKpi(k.id, { current_value: v }), t("Đã lưu"))} />
                            <span className="text-xs text-gray-400">{k.metric_unit}</span>
                            <span className="text-xs text-gray-400 w-14">w{k.weight_percent}%</span>
                            {isMeasured(k as any)
                              ? <span className={`text-xs px-1.5 py-0.5 rounded ${comp >= 100 ? "bg-emerald-50 text-emerald-600" : comp >= 70 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"}`}>{comp}%</span>
                              : <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">{t("chưa đo")}</span>}
                            <button onClick={() => act(() => deleteKpi(k.id), t("Đã xoá KPI"))} disabled={pending} className="text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </section>
        );
      })}

      {people.length === 0 && <div className="text-center text-gray-400 py-10">{t("Không có nhân sự non-sale đang hoạt động.")}</div>}
    </div>
  );
}

function NumCell({ value, onSave, nullable }: { value: number | null; onSave: (v: number | null) => void; nullable?: boolean }) {
  const { t: t } = useLang();
  const [v, setV] = useState<string>(value == null ? "" : String(value));
  const commit = () => {
    const parsed = v.trim() === "" ? (nullable ? null : 0) : Number(v) || 0;
    if (parsed !== value) onSave(parsed);
  };
  return (
    <input type="number" value={v}
      placeholder={nullable ? t("chưa đo") : ""}
      onChange={e => setV(e.target.value)}
      onBlur={commit}
      className="w-24 border border-gray-300 rounded px-2 py-1 text-sm text-right" />
  );
}

function SeedRow({ personId, cycleId, onAct, pending }: {
  personId: string; cycleId: string; pending: boolean;
  onAct: (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => void;
}) {
  const { t: t } = useLang();
  const [tpl, setTpl] = useState(TPL_KEYS[0]);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-gray-500">{t("Áp KPI mẫu:")}</span>
      <select value={tpl} onChange={e => setTpl(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
        {TPL_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
      </select>
      <button onClick={() => onAct(() => seedKpiTemplate(personId, cycleId, tpl), t("Đã áp KPI mẫu"))} disabled={pending || !cycleId}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60">
        {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} {t("Áp mẫu")}
      </button>
    </div>
  );
}
