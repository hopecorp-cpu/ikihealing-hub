import { requireUser } from "@/lib/auth-server";
import { getServiceClient } from "@/lib/supabase-server";
import { BookOpenCheck, Star, Search } from "lucide-react";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

const STAGES = [
  { v: "intro",        l: "Mở đầu", c: "bg-gray-100 text-gray-700" },
  { v: "discovery",    l: "Discovery", c: "bg-blue-100 text-blue-700" },
  { v: "presentation", l: "Trình bày", c: "bg-purple-100 text-purple-700" },
  { v: "objection",    l: "Xử lý phản đối", c: "bg-orange-100 text-orange-700" },
  { v: "closing",      l: "Chốt đơn", c: "bg-green-100 text-green-700" },
  { v: "followup",     l: "Follow-up", c: "bg-indigo-100 text-indigo-700" },
  { v: "referral",     l: "Giới thiệu", c: "bg-yellow-100 text-yellow-700" }
];

export default async function PlaybookPage({ searchParams }: { searchParams: { stage?: string; q?: string } }) {
  const { t } = getT();
  await requireUser();
  const sb = getServiceClient();
  const stage = searchParams.stage || "";
  const search = searchParams.q?.trim() || "";

  let q = sb.from("playbook_items").select("*").eq("active", true);
  if (stage) q = q.eq("stage", stage);
  if (search) q = q.or(`scenario.ilike.%${search}%,script_text.ilike.%${search}%`);

  const { data: items } = await q.order("use_count", { ascending: false }).limit(100);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpenCheck className="w-6 h-6 text-brand-600" /> Sales Playbook
        </h1>
        <p className="text-sm text-gray-500 mt-1">{t("Scripts chuẩn ACME — dùng để chốt đơn nhất quán toàn team")}</p>
      </div>

      <a href="/playbook/closer" className="block rounded-2xl border border-emerald-200 bg-emerald-50 p-4 hover:bg-emerald-100/70 transition">
        <div className="flex items-center gap-3">
          <span className="text-2xl"></span>
          <div className="flex-1">
            <div className="font-bold text-gray-900">{t("Kịch bản CLOSER (Hormozi) — 6 bước bằng câu hỏi")}</div>
            <div className="text-[13px] text-gray-600">{t("Câu hỏi gợi ý sẵn cho từng bước C·L·O·S·E·R + mẫu nhắn Zalo. Mở ra dùng trước mỗi cuộc →")}</div>
          </div>
        </div>
      </a>

      <form className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" name="q" defaultValue={search}
            placeholder={t("VD: 'giá cao', 'so sánh', 'không thấy hiệu quả'")}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm" />
        </div>
        {stage && <input type="hidden" name="stage" value={stage} />}
        <button className="px-4 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-semibold">{t("Tìm")}</button>
      </form>

      <div className="flex gap-1 flex-wrap">
        <a href="/playbook" className={`px-3 py-1.5 rounded-md text-xs font-semibold ${!stage ? "bg-brand-600 text-white" : "bg-white border border-gray-200"}`}>
          {t("Tất cả")} ({items?.length || 0})
        </a>
        {STAGES.map(s => (
          <a key={s.v} href={`/playbook?stage=${s.v}`}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold ${stage === s.v ? "bg-brand-600 text-white" : "bg-white border border-gray-200"}`}>
            {t(s.l)}
          </a>
        ))}
      </div>

      <div className="space-y-4">
        {(items ?? []).map((it: any) => {
  const { t: t } = getT();
          const stageInfo = STAGES.find(s => s.v === t(it.stage));
          return (
            <div key={it.id} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
              <div className="flex justify-between items-start gap-3 mb-3">
                <div>
                  <span className={`text-xs px-2 py-0.5 rounded font-semibold ${stageInfo?.c}`}>{stageInfo ? t(stageInfo.l) : ""}</span>
                  {it.tonality && <span className="text-xs ml-2 text-gray-500">{t("tone:")} {it.tonality}</span>}
                  <h3 className="font-bold mt-2">{it.scenario}</h3>
                </div>
                <div className="text-right">
                  {it.effectiveness_rating && (
                    <div className="flex items-center gap-1 text-yellow-500">
                      <Star className="w-3 h-3 fill-yellow-500" />
                      <span className="text-xs">{it.effectiveness_rating}/5</span>
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mt-1">{t("Dùng")} {it.use_count} {t("lần")}</div>
                </div>
              </div>

              <div className="bg-emerald-50 border-l-4 border-emerald-400 p-3 rounded text-sm whitespace-pre-wrap mb-3">
                {it.script_text}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {it.key_points && it.key_points.length > 0 && (
                  <div className="bg-blue-50 p-3 rounded">
                    <div className="text-xs font-semibold text-blue-800 mb-1">Key Points</div>
                    <ul className="text-xs space-y-1">
                      {it.key_points.map((k: string, i: number) => <li key={i}>• {k}</li>)}
                    </ul>
                  </div>
                )}
                {(it.do_say || it.dont_say) && (
                  <div className="grid grid-cols-2 gap-2">
                    {it.do_say && (
                      <div className="bg-green-50 p-2 rounded text-xs">
                        <b className="text-green-800">{t("Nói:")}</b>
                        <ul className="mt-1 space-y-0.5">
                          {it.do_say.map((d: string, i: number) => <li key={i}>· {d}</li>)}
                        </ul>
                      </div>
                    )}
                    {it.dont_say && (
                      <div className="bg-red-50 p-2 rounded text-xs">
                        <b className="text-red-800">{t("Không nói:")}</b>
                        <ul className="mt-1 space-y-0.5">
                          {it.dont_say.map((d: string, i: number) => <li key={i}>· {d}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {(!items || items.length === 0) && (
          <div className="text-center py-12 text-gray-400">{t("Chưa có script nào")}</div>
        )}
      </div>
    </div>
  );
}
