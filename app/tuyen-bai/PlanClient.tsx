"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useTransition } from "react";
import { Route, Plus, Trash2, Save, Loader2 } from "lucide-react";
import { FUNNELS, FUNNEL_LABEL, type ContentPlan, type Funnel, type Pillar } from "@/lib/content-plan";
import { saveTuyenBai } from "./actions";

const FUNNEL_HINT: Record<Funnel, string> = {
  TOFU: "Thu hút người lạ — kiến thức, nỗi đau lối sống, KHÔNG bán",
  MOFU: "Nuôi dưỡng niềm tin — câu chuyện, hậu trường, cảm nhận khách",
  BOFU: "Chốt bán — giải pháp + ưu đãi tặng quà (không chiết khấu %)",
};

export default function PlanClient({ plan }: { plan: ContentPlan }) {
  const { t: t } = useLang();
  const [ratio, setRatio] = useState<Record<Funnel, number>>({ ...plan.funnelRatio });
  const [pillars, setPillars] = useState<Pillar[]>(plan.pillars.length ? plan.pillars : [{ name: "", funnel: "TOFU" }]);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const total = FUNNELS.reduce((s, f) => s + (Number(ratio[f]) || 0), 0);
  const countByFunnel = (f: Funnel) => pillars.filter((p) => p.funnel === f).length;

  function save() {
    setMsg(null);
    start(async () => {
  const { t: t } = useLang();
      const clean = pillars.map((p) => ({ ...p, name: p.name.trim() })).filter((p) => p.name);
      if (!clean.length) { setMsg({ ok: false, text: t("Cần ít nhất 1 trụ nội dung có tên.") }); return; }
      const r = await saveTuyenBai({ funnelRatio: ratio, pillars: clean });
      setMsg(r.ok ? { ok: true, text: t("Đã lưu. Nhà máy Content sẽ viết bám tuyến này từ mẻ tới.") } : { ok: false, text: r.error || "Lưu lỗi" });
    });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Route className="w-6 h-6 text-brand-600" /> {t("Tuyến bài")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("Trụ nội dung + tỉ lệ phễu TOFU/MOFU/BOFU. Nhà máy Content viết bám bảng này thay vì tự nghĩ chủ đề — mỗi bài gắn đúng trụ + tầng phễu.")}
        </p>
      </div>

      <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <h2 className="font-semibold text-sm">{t("Tỉ lệ số bài theo tầng phễu")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {FUNNELS.map((f) => (
            <div key={f} className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{FUNNEL_LABEL[f]}</span>
                <div className="flex items-center gap-1">
                  <input type="number" min={0} value={ratio[f] ?? 0}
                    onChange={(e) => setRatio({ ...ratio, [f]: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-16 text-right border border-gray-300 rounded px-2 py-1 text-sm" />
                  <span className="text-gray-400 text-sm">%</span>
                </div>
              </div>
              <p className="text-[11px] text-gray-500 mt-1.5 leading-snug">{t(FUNNEL_HINT[f])}</p>
              <p className="text-[11px] text-gray-400 mt-1">{countByFunnel(f)} {t("trụ")}</p>
            </div>
          ))}
        </div>
        <p className={`text-xs ${total === 100 ? "text-gray-400" : "text-amber-600"}`}>
          {t("Tổng:")} {total}% {total !== 100 ? t("— nên bằng 100% (hệ vẫn tự chuẩn hoá nếu lệch).") : ""}
        </p>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">{t("Trụ nội dung")}</h2>
          <button onClick={() => setPillars([...pillars, { name: "", funnel: "TOFU" }])}
            className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700">
            <Plus className="w-3.5 h-3.5" /> {t("Thêm trụ")}
          </button>
        </div>
        <div className="space-y-2">
          {pillars.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={p.name} placeholder={t("Tên trụ (vd Câu chuyện khách hàng)")}
                onChange={(e) => setPillars(pillars.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                className="flex-1 border border-gray-300 rounded px-2.5 py-1.5 text-sm" />
              <select value={p.funnel}
                onChange={(e) => setPillars(pillars.map((x, j) => j === i ? { ...x, funnel: e.target.value as Funnel } : x))}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white">
                {FUNNELS.map((f) => <option key={f} value={f}>{FUNNEL_LABEL[f]}</option>)}
              </select>
              <button onClick={() => setPillars(pillars.filter((_, j) => j !== i))}
                className="text-gray-400 hover:text-red-500 p-1" aria-label={t("Xoá trụ")}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={pending}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60">
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {pending ? t("Đang lưu…") : t("Lưu tuyến bài")}
        </button>
        {msg && <span className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
