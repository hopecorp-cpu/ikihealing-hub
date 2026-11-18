"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Copy, Check, ArrowLeft, Ban, Lightbulb, MessageCircle, Pencil, Plus, Trash2, X, Tag, Gift } from "lucide-react";
import { saveCloserCustom, type CloserStory } from "./actions";

const LETTER_COLOR: Record<string, string> = { C: "#64748B", L: "#3B82F6", O: "#8B5CF6", S: "#10B981", E: "#F59E0B", R: "#EC4899" };
const money = (n: number) => (Number(n) || 0).toLocaleString("vi-VN") + "đ";

function CopyBtn({ text }: { text: string }) {
  const { t: t } = useLang();
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200); }}
      className="shrink-0 text-gray-300 hover:text-emerald-600 transition p-1" title={t("Sao chép")}>
      {ok ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}
function Ask({ q }: { q: string }) {
  return (
    <li className="flex items-start gap-2">
      <span className="text-emerald-500 mt-1.5 shrink-0"></span>
      <span className="flex-1 text-[13.5px] text-gray-800 leading-relaxed">{q}</span>
      <CopyBtn text={q} />
    </li>
  );
}

function CustomEditor({ custom }: { custom: any }) {
  const { t: t } = useLang();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [stories, setStories] = useState<CloserStory[]>(custom.stories?.length ? custom.stories : [{ who: "", before: "", after: "" }]);
  const [gift, setGift] = useState(custom.gift || "");
  const [saved, setSaved] = useState(false);
  const upd = (i: number, k: keyof CloserStory, v: string) => setStories((s) => s.map((x, j) => j === i ? { ...x, [k]: v } : x));
  if (!open) return (
    <button onClick={() => setOpen(true)} className="w-full rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 p-3 text-[13px] text-emerald-700 font-semibold inline-flex items-center justify-center gap-2 hover:bg-emerald-50">
      <Pencil className="w-4 h-4" />{t("Điền case khách thật & quà tặng (bước S / E)")}
    </button>
  );
  return (
    <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
      <div className="text-[13px] font-bold text-gray-800">{t("Case khách thật (bước S) — kể cảm nhận, KHÔNG hứa chữa/trị")}</div>
      {stories.map((s, i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-gray-500">{t("Câu chuyện")} {i + 1}</span>
            <button onClick={() => setStories((x) => x.filter((_, j) => j !== i))} className="text-gray-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          <input value={s.who} onChange={(e) => upd(i, "who", e.target.value)} placeholder={t("Ai (VD: chị Lan, 42t, nhân viên văn phòng)")} className="w-full px-2 py-1.5 rounded border border-gray-200 text-[13px]" />
          <input value={s.before} onChange={(e) => upd(i, "before", e.target.value)} placeholder={t("Trước đây (hoàn cảnh/nỗi lo giống khách)")} className="w-full px-2 py-1.5 rounded border border-gray-200 text-[13px]" />
          <input value={s.after} onChange={(e) => upd(i, "after", e.target.value)} placeholder={t("Bây giờ (cảm nhận sau khi dùng — không cam kết tuyệt đối)")} className="w-full px-2 py-1.5 rounded border border-gray-200 text-[13px]" />
        </div>
      ))}
      {stories.length < 6 && <button onClick={() => setStories((s) => [...s, { who: "", before: "", after: "" }])} className="text-[12px] text-emerald-700 inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" />{t("Thêm câu chuyện")}</button>}
      <div>
        <div className="text-[13px] font-bold text-gray-800 mb-1">{t("Quà tặng chốt đơn (bước E) — thay cho chiết khấu")}</div>
        <textarea value={gift} onChange={(e) => setGift(e.target.value)} rows={2} placeholder={t("VD: Tặng hộp trà thảo mộc + cẩm nang ăn uống khi lấy combo 3 hộp…")} className="w-full px-2 py-1.5 rounded border border-gray-200 text-[13px]" />
      </div>
      <div className="flex gap-2 items-center">
        <button onClick={() => start(async () => { const r = await saveCloserCustom({ stories, gift }); if (r.ok) { setSaved(true); setTimeout(() => location.reload(), 700); } })}
          disabled={pending} className="text-[13px] px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-semibold inline-flex items-center gap-1 hover:bg-emerald-700 disabled:opacity-60"><Check className="w-4 h-4" />{pending ? t("Đang lưu…") : t("Lưu")}</button>
        <button onClick={() => setOpen(false)} className="text-[13px] px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg inline-flex items-center gap-1"><X className="w-4 h-4" />{t("Đóng")}</button>
        {saved && <span className="text-emerald-600 text-[12px]">{t("✓ đã lưu")}</span>}
      </div>
    </div>
  );
}

function PriceTable({ products }: { products: any[] }) {
  const { t: t } = useLang();
  const byCat: Record<string, any[]> = {};
  for (const p of products) (byCat[p.category || "Khác"] ??= []).push(p);
  if (!products.length) return null;
  return (
    <div className="rounded-xl bg-white border border-gray-200 p-3">
      <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1"><Tag className="w-3.5 h-3.5" />{t("Bảng giá thật (tham khảo khi khách hỏi giá)")}</div>
      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3">
        {Object.entries(byCat).map(([cat, list]) => (
          <div key={cat}>
            <div className="text-[12px] font-semibold text-gray-700 mb-1">{cat}</div>
            <ul className="space-y-0.5">
              {list.slice(0, 8).map((p, i) => (
                <li key={i} className="flex justify-between text-[12.5px] text-gray-600 gap-2">
                  <span className="truncate">{p.name}</span><span className="font-semibold text-gray-800 shrink-0">{money(p.unit_price)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CloserClient({ data, products, custom, canEdit }: { data: any; products: any[]; custom: any; canEdit: boolean }) {
  const { t: t } = useLang();
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <Link href="/playbook" className="text-[13px] text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-2"><ArrowLeft className="w-3.5 h-3.5" />Sales Playbook</Link>
        <h1 className="text-2xl font-bold text-gray-900">{t("Kịch bản CLOSER")}</h1>
        <p className="text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 mt-2 leading-relaxed">{t(data.intro)}</p>
      </div>

      {canEdit && <CustomEditor custom={custom} />}

      {data.steps.map((s: any) => (
        <div key={s.key} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-50" style={{ background: `${LETTER_COLOR[s.letter]}0D` }}>
            <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0" style={{ background: LETTER_COLOR[s.letter] }}>{s.letter}</span>
            <div>
              <div className="text-[15px] font-bold text-gray-800">{t(s.title)}</div>
              <div className="text-[12px] text-gray-500">{t(s.goal)}</div>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {s.ask && <div><div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">{t("Câu hỏi gợi ý")}</div><ul className="space-y-1.5">{s.ask.map((q: string, i: number) => <Ask key={i} q={q} />)}</ul></div>}

            {s.key === "sell" && custom.stories?.length > 0 && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 space-y-2">
                <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wide">{t("Câu chuyện khách thật ACME")}</div>
                {custom.stories.map((st: any, i: number) => {
                  const line = `${st.who ? st.who + ": " : ""}${st.before ? t("trước đây ") + st.before + ". " : ""}${st.after ? t("giờ ") + st.after + "." : ""}`;
                  return (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-emerald-500 mt-0.5"></span>
                      <span className="flex-1 text-[13.5px] text-gray-800 leading-relaxed">{line}</span>
                      <CopyBtn text={line} />
                    </div>
                  );
                })}
              </div>
            )}

            {s.objections && (
              <div className="space-y-3">
                {s.objections.map((o: any, i: number) => (
                  <div key={i} className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
                    <div className="text-[13px] font-bold text-gray-800 mb-1.5">{o.type}</div>
                    <ul className="space-y-1.5">{o.ask.map((q: string, j: number) => <Ask key={j} q={q} />)}</ul>
                    {t(o.note) && <div className="mt-2 text-[12px] text-gray-500 italic">{t(o.note)}</div>}
                  </div>
                ))}
              </div>
            )}

            {s.key === "explain" && <PriceTable products={products} />}
            {s.key === "explain" && custom.gift && (
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wide mb-1 flex items-center gap-1"><Gift className="w-3.5 h-3.5" />{t("Quà tặng chốt đơn (thay chiết khấu)")}</div>
                <p className="text-[13.5px] text-gray-800 leading-relaxed">{custom.gift}</p>
              </div>
            )}

            {s.zalo && (
              <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-blue-500 uppercase tracking-wide flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" />{t("Mẫu nhắn Zalo")}</div>
                  <CopyBtn text={s.zalo} />
                </div>
                <p className="text-[13.5px] text-gray-800 mt-1 leading-relaxed">{s.zalo}</p>
              </div>
            )}
            {s.avoid && (
              <div className="rounded-xl bg-rose-50/60 border border-rose-100 p-3">
                <div className="text-[11px] font-bold text-rose-500 uppercase tracking-wide mb-1 flex items-center gap-1"><Ban className="w-3.5 h-3.5" />{t("Tránh nói")}</div>
                <ul className="space-y-1">{s.avoid.map((a: string, i: number) => <li key={i} className="text-[13px] text-gray-700 flex gap-1.5"><span className="text-rose-400">✕</span>{a}</li>)}</ul>
              </div>
            )}
            {s.tip && <div className="text-[13px] text-emerald-800 bg-emerald-50 rounded-xl p-2.5 flex gap-2"><Lightbulb className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" /><span>{s.tip}</span></div>}
          </div>
        </div>
      ))}
    </div>
  );
}
