"use client";
import { useState } from "react";
import { useLang } from "@/components/lang-provider";
import { CHECKLIST, sectionsForRole, valueOf, isMet, evalProgress, targetOf, type ChItem, type AutoVals, type Role } from "@/lib/sales-checklist-core";

const fmtMoney = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "tr" : (n || 0).toLocaleString("vi");

function Copy({ text, label }: { text: string; label: string }) {
  const { t } = useLang();
  const [ok, setOk] = useState(false);
  return <button type="button" onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}
    className={`text-[11px] px-2 py-1 rounded ${ok ? "bg-emerald-600 text-white" : "bg-blue-600 text-white"}`}>{ok ? t("✓ Đã copy") : label}</button>;
}

export default function ChecklistClient({ role, initialValues, initialLinks, auto, weekBase, overrides, confirmedAt: initConfirmed, today }:
  { role: Role; initialValues: Record<string, number>; initialLinks?: Record<string, string>; auto: AutoVals; weekBase: Record<string, number>; overrides?: Record<string, number>; confirmedAt: string | null; today: string }) {
  const { t } = useLang();
  const [values, setValues] = useState<Record<string, number>>(initialValues || {});
  const [links, setLinks] = useState<Record<string, string>>(initialLinks || {});
  const [confirmedAt, setConfirmedAt] = useState<string | null>(initConfirmed);
  const [busy, setBusy] = useState<"" | "save" | "confirm">("");
  const [msg, setMsg] = useState("");

  const sections = sectionsForRole(role);
  const prog = evalProgress(values, auto, weekBase, role, overrides, links);
  const met = (it: ChItem) => isMet(it, values, auto, weekBase, overrides, links);
  const setLink = (k: string, v: string) => setLinks(s => ({ ...s, [k]: v }));
  const setV = (k: string, v: number) => setValues(s => ({ ...s, [k]: Math.max(0, v) }));
  const dispVal = (it: ChItem) => valueOf(it, values, auto, weekBase);
  const tgt = (it: ChItem) => targetOf(it, overrides);
  const dispTarget = (it: ChItem) => it.money ? fmtMoney(tgt(it)) : tgt(it);
  const show = (it: ChItem) => it.money ? fmtMoney(dispVal(it)) : dispVal(it);

  async function send(confirm: boolean) {
    setBusy(confirm ? "confirm" : "save"); setMsg("");
    try {
      const r = await fetch("/api/sales-checklist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values, links, confirm }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "lỗi");
      if (j.confirmedAt) setConfirmedAt(j.confirmedAt);
      setMsg(confirm ? t("✓ Đã xác nhận hoàn thành!") : t("✓ Đã lưu"));
      setTimeout(() => setMsg(""), 2500);
    } catch (e: any) { setMsg(t("Lỗi: ") + e.message); }
    finally { setBusy(""); }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-1.5">
          <div className="font-bold">{t("Sơn độ (theo trọng số)")}: <span style={{ color: prog.pct >= 100 ? "#10B981" : prog.pct >= 70 ? "#F59E0B" : "#EF4444" }}>{prog.pct}%</span> <span className="text-sm font-normal text-gray-400">({prog.done}/{prog.total} {t("mục")})</span></div>
          {confirmedAt && <span className="text-xs text-emerald-600 font-medium">✓ {t("đã xác nhận")} {confirmedAt.slice(11, 16)}</span>}
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${prog.pct}%`, background: prog.pct >= 100 ? "#10B981" : prog.pct >= 70 ? "#F59E0B" : "#EF4444" }} /></div>
        <div className="text-[11px] text-gray-400 mt-1.5">{t("Lõi doanh thu nặng nhất — làm story/community nhiều không bù được nếu chưa GỌI–CHỐT–LEAD.")}</div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
        <div className="text-xs font-semibold text-blue-800 mb-1">{t("Mẫu mời Group / Zalo (bấm Copy)")}</div>
        <div className="text-[12px] text-gray-700 whitespace-pre-wrap leading-relaxed mb-2">{CHECKLIST.inviteMessage}</div>
        <div className="flex flex-wrap gap-1.5">
          <Copy text={CHECKLIST.inviteMessage} label={t("Copy lời mời")} />
          <Copy text={t(CHECKLIST.links.group)} label={t("Copy link Group")} />
          <Copy text={CHECKLIST.links.zalo} label={t("Copy link Zalo")} />
        </div>
      </div>

      {sections.map(sec => {
        const sd = sec.items.filter(it => met(it)).length;
        return (
          <section key={sec.key} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
            <div className="p-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-sm">{t(sec.title)}</h2>
              <span className={`text-xs ${sd === sec.items.length ? "text-emerald-600" : "text-gray-400"}`}>{sd}/{sec.items.length}</span>
            </div>
            <div className="divide-y divide-gray-100">
              {sec.items.map(it => {
                const ok = met(it);
                return (
                  <div key={it.key} className="p-3">
                   <div className="flex items-center gap-3">
                    <span className={`text-lg shrink-0 ${ok ? "text-emerald-500" : "text-gray-300"}`}>{ok ? "✓" : "○"}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm ${ok ? "text-gray-800" : "text-gray-600"}`}>{t(it.label)}
                        {it.kind === "auto" && <span className="ml-1.5 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full">{t("tự động")}</span>}
                        {it.period === "week" && <span className="ml-1.5 text-[10px] bg-violet-50 text-violet-700 border border-violet-200 px-1.5 py-0.5 rounded-full">{t("tuần")}</span>}
                      </div>
                      {it.kind === "auto" && <div className="text-[11px] text-gray-400">{t("Hệ thống ghi nhận:")} <b>{show(it)}</b>/{dispTarget(it)}</div>}
                      {it.period === "week" && it.kind !== "auto" && <div className="text-[11px] text-gray-400">{t("Tuần này:")} <b>{dispVal(it)}</b>/{it.target}</div>}
                      {it.help && <div className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{it.help}</div>}
                    </div>
                    {it.kind === "check" && (
                      <input type="checkbox" checked={(values[it.key] || 0) >= 1} onChange={e => setV(it.key, e.target.checked ? 1 : 0)} className="w-5 h-5 shrink-0" />
                    )}
                    {it.kind === "number" && (
                      <div className="flex items-center gap-1 shrink-0">
                        <input type="number" min={0} value={values[it.key] || ""} onFocus={e => e.target.select()} onChange={e => setV(it.key, e.target.value === "" ? 0 : +e.target.value)}
                          className="w-16 p-1.5 border border-gray-200 rounded-lg text-sm text-right" placeholder={it.period === "week" ? t("hôm nay") : ""} />
                        <span className="text-xs text-gray-400">/{it.target}</span>
                      </div>
                    )}
                    {it.kind === "auto" && (
                      <span className={`shrink-0 text-sm font-bold tabular-nums ${ok ? "text-emerald-600" : "text-gray-400"}`}>{show(it)}/{dispTarget(it)}</span>
                    )}
                   </div>
                   {it.proof && (
                     <div className="mt-2 pl-8">
                       <input value={links[it.key] || ""} onChange={e => setLink(it.key, e.target.value)} placeholder={t("Dán LINK bài đã đăng (bắt buộc để tính hoàn thành)")}
                         className={`w-full p-1.5 border rounded-lg text-xs ${(links[it.key] || "").trim() ? "border-emerald-300" : "border-red-200"}`} />
                       {!(links[it.key] || "").trim()
                         ? <div className="text-[10px] text-red-500 mt-0.5">{t("Chưa có link → CHƯA tính hoàn thành. MKT sẽ bấm link kiểm tra đúng/sai.")}</div>
                         : <a href={links[it.key]} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 underline mt-0.5 inline-block">{t("mở kiểm tra ↗")}</a>}
                     </div>
                   )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="sticky bottom-0 bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-3 flex flex-wrap items-center gap-2">
        <button onClick={() => send(false)} disabled={!!busy} className="text-sm px-4 py-2 rounded-lg bg-gray-900 text-white disabled:opacity-50">{busy === "save" ? "..." : t("Lưu")}</button>
        <button onClick={() => send(true)} disabled={!!busy} className="text-sm px-4 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-50">{busy === "confirm" ? "..." : t("Xác nhận hoàn thành checklist")}</button>
        {msg && <span className="text-sm text-emerald-700">{msg}</span>}
        <span className="ml-auto text-xs text-gray-400">{t("Chốt trước")} {CHECKLIST.deadline}</span>
      </div>
    </div>
  );
}
