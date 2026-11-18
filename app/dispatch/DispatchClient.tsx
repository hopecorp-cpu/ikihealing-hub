"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useTransition } from "react";
import { Network, Loader2, Play, ShieldCheck, ShieldX, Clock, Brain, Wand2 } from "lucide-react";
import { FUNNELS, FUNNEL_LABEL, type Funnel } from "@/lib/content-plan";
import type { DispatchBrief, BriefStatus, BriefType } from "@/lib/dispatch";
import type { CampaignFail } from "@/lib/campaign-memory";
import { runCampaignAction, suggestCampaignAction } from "./actions";

const STATUS: Record<BriefStatus, { label: string; cls: string }> = {
  passed: { label: "Đạt QA", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  failed: { label: "Trượt QA", cls: "bg-red-100 text-red-700 border-red-200" },
  waiting: { label: "Chờ agent", cls: "bg-gray-100 text-gray-500 border-gray-200" },
  qa: { label: "Đang QA", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  briefed: { label: "Đã giao", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  published: { label: "Đã đăng", cls: "bg-blue-100 text-blue-700 border-blue-200" },
};
const TYPE_LABEL: Record<BriefType, string> = { content: "Content", design: "Design", performance: "Performance" };

export default function DispatchClient({ briefs, fails = [] }: { briefs: DispatchBrief[]; fails?: CampaignFail[] }) {
  const { t: t } = useLang();
  const [campaign, setCampaign] = useState("");
  const [goal, setGoal] = useState("");
  const [channel, setChannel] = useState("Facebook");
  const [funnel, setFunnel] = useState<"" | Funnel>("");
  const [nContent, setNContent] = useState(2);
  const [pending, start] = useTransition();
  const [suggesting, startSuggest] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [rationale, setRationale] = useState<string | null>(null);

  function suggest() {
    setMsg(null); setRationale(null);
    startSuggest(async () => {
      const r = await suggestCampaignAction();
      if (r.ok && r.input) {
        setCampaign(r.input.campaign); setGoal(r.input.goal);
        setChannel(r.input.channel || "Facebook"); setFunnel(r.input.funnel || "");
        setNContent(r.input.nContent || 3);
        setRationale(r.rationale || null);
      } else setMsg({ ok: false, text: r.error || "Không đề xuất được" });
    });
  }

  function run() {
    setMsg(null);
    start(async () => {
      const r = await runCampaignAction({ campaign, goal, channel, funnel: funnel || undefined, nContent });
      setMsg(r.ok
        ? { ok: true, text: `Xong: ${r.passed} bài ĐẠT cửa QA (đã đẩy đi duyệt Telegram), ${r.failed} trượt (ghi Campaign Memory).` }
        : { ok: false, text: r.error || "Chạy lỗi" });
    });
  }

  const byCampaign: { campaign: string; at: string; items: DispatchBrief[] }[] = [];
  for (const b of briefs) {
    let g = byCampaign.find((x) => x.campaign === b.campaign);
    if (!g) { g = { campaign: b.campaign, at: b.createdAt, items: [] }; byCampaign.push(g); }
    g.items.push(b);
    if (b.createdAt > g.at) g.at = b.createdAt;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Network className="w-6 h-6 text-brand-600" /> {t("Dispatch — Hub điều phối")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("Giao brief chiến dịch → Dispatch phân rã, cho Content viết, đưa qua")} <b>{t("Cửa QA")}</b> {t("(đúng luật + brand) → bài đạt đẩy đi duyệt trên Telegram, bài trượt ghi Campaign Memory. Design & Performance là spoke chờ agent (đợt sau).")}
        </p>
      </div>

      <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-sm">{t("Giao chiến dịch mới")}</h2>
          <button onClick={suggest} disabled={suggesting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-brand-200 text-brand-700 bg-brand-50 hover:bg-brand-100 disabled:opacity-60">
            {suggesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            {t("Đề xuất từ doanh thu")}
          </button>
        </div>
        {rationale && (
          <div className="text-xs text-brand-800 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2 leading-relaxed">
            <b>{t("Bám số:")}</b> {rationale}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm">{t("Tên chiến dịch")}
            <input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder={t("VD: Đẩy đơn cuối tháng 7")}
              className="mt-1 w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm" />
          </label>
          <label className="text-sm">{t("Kênh")}
            <select value={channel} onChange={(e) => setChannel(e.target.value)} className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white">
              {["Facebook", "TikTok", "Zalo", "YouTube"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="text-sm sm:col-span-2">{t("Mục tiêu chiến dịch")}
            <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder={t("VD: nhắc khách cũ quay lại, tặng quà đơn ≥ 1 triệu")}
              className="mt-1 w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm" />
          </label>
          <label className="text-sm">{t("Tầng phễu")}
            <select value={funnel} onChange={(e) => setFunnel(e.target.value as any)} className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white">
              <option value="">{t("Tự chia theo tuyến bài")}</option>
              {FUNNELS.map((f) => <option key={f} value={f}>{FUNNEL_LABEL[f]}</option>)}
            </select>
          </label>
          <label className="text-sm">{t("Số bài")}
            <input type="number" min={1} max={5} value={nContent} onChange={(e) => setNContent(Math.min(5, Math.max(1, Number(e.target.value) || 1)))}
              className="mt-1 w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm" />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={run} disabled={pending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60">
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {pending ? t("Đang chạy (viết + QA ~30s)…") : t("Chạy chiến dịch")}
          </button>
          {msg && <span className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</span>}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-sm text-gray-600">{t("Sổ điều phối")}</h2>
        {byCampaign.length === 0 && <p className="text-sm text-gray-400">{t("Chưa có chiến dịch nào. Giao một cái ở trên để bắt đầu.")}</p>}
        {byCampaign.map((g) => (
          <div key={g.campaign + g.at} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">{g.campaign}</h3>
              <span className="text-[11px] text-gray-400">{g.at.slice(0, 10)}</span>
            </div>
            <div className="space-y-1.5">
              {g.items.map((b) => {
                const s = STATUS[b.status];
                const Icon = b.status === "passed" ? ShieldCheck : b.status === "failed" ? ShieldX : Clock;
                return (
                  <div key={b.id} className="flex items-start gap-2 text-sm">
                    <span className="text-[11px] tabular-nums text-gray-400 w-24 shrink-0 pt-0.5">{TYPE_LABEL[b.type]}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 inline-flex items-center gap-1 ${s.cls}`}>
                      <Icon className="w-3 h-3" /> {t(s.label)}
                    </span>
                    <span className="text-gray-500 text-xs leading-snug">{b.qaNotes || t(b.goal)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Brain className="w-5 h-5 text-purple-600" strokeWidth={1.75} />
          <h2 className="font-semibold text-sm">Campaign Memory — {fails.length} {t("bài đang tránh lặp")}</h2>
        </div>
        <p className="text-xs text-gray-500 mb-3">{t("Bài bị bỏ khi duyệt hoặc dính từ cấm được ghi lại — Nhà máy Content đọc để KHÔNG viết lại kiểu này.")}</p>
        {fails.length === 0 ? (
          <p className="text-sm text-gray-400">{t("Chưa ghi bài fail nào.")}</p>
        ) : (
          <div className="space-y-1.5">
            {fails.slice(0, 12).map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="text-[11px] text-gray-400 w-20 shrink-0 pt-0.5">{String(f.at || "").slice(0, 10)}</span>
                <span className="font-medium text-gray-700 shrink-0 max-w-[45%] truncate">{t(f.title)}</span>
                <span className="text-gray-500 text-xs leading-snug">{f.reason}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-gray-400">
        {t("Nguyên tắc Hub-and-Spoke: agents không nói thẳng với nhau — mọi bài qua Dispatch + Cửa QA mới ra ngoài. Spoke Content + Design (ảnh & logo) đã sống; Performance chờ cắm token quảng cáo.")}
      </p>
    </div>
  );
}
