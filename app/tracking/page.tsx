import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { FUNNELS, getFunnel } from "@/lib/funnel";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Phễu mua hàng | ACME Ops Hub") };
}

function pct(a: number, b: number) { return b > 0 ? Math.round((a / b) * 100) : 0; }

export default async function TrackingPage({ searchParams }: { searchParams: { d?: string } }) {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isAdmin = user.role === "admin" || user.role === "ceo";
  if (!isAdmin && !isManagerOrAbove(user.role)) redirect("/");

  const days = [7, 30, 90].includes(Number(searchParams.d)) ? Number(searchParams.d) : 7;
  const data = await getFunnel(days);

  const totalAll = Object.values(FUNNELS).reduce((s, f) => s + ((data[keyOf(f)] || {})["view"] || 0), 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-xl font-bold text-gray-900">{t("Phễu mua hàng — khách rớt ở bước nào")}</h1>
        <div className="flex gap-1.5 text-sm">
          {[7, 30, 90].map((d) => (
            <a key={d} href={`/tracking?d=${d}`}
              className={`px-3 py-1.5 rounded-lg border ${d === days ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-600 border-gray-200"}`}>{d} {t("ngày")}</a>
          ))}
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-4">{t("Đếm lượt theo từng bước trên mỗi trang (gộp")} {days} {t("ngày gần nhất). Bước tụt mạnh nhất được tô đỏ — đó là chỗ cần cải thiện.")}</p>

      {totalAll === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-[13.5px] text-amber-800">
          {t("Chưa có lượt nào được ghi trong")} {days} {t("ngày. Beacon vừa gắn — dữ liệu sẽ hiện khi có khách vào các trang. (Hiện đã gắn: Quiz. Các trang khác đang triển khai.)")}
        </div>
      )}

      <div className="space-y-5">
        {Object.entries(FUNNELS).map(([pk, f]) => {
  const { t: t } = getT();
          const rec = data[pk] || {};
          const top = rec[f.steps[0].key] || 0;

          let worstIdx = -1, worstDrop = 0;
          for (let i = 1; i < f.steps.length; i++) {
            const prev = rec[f.steps[i - 1].key] || 0;
            const cur = rec[f.steps[i].key] || 0;
            const drop = prev > 0 ? (prev - cur) / prev : 0;
            if (prev > 0 && drop > worstDrop) { worstDrop = drop; worstIdx = i; }
          }
          return (
            <div key={pk} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="font-bold text-gray-900">{t(f.label)}</div>
                <div className="text-sm text-gray-500">{top.toLocaleString("vi-VN")} {t("lượt vào · chốt")} {pct((rec[f.steps[f.steps.length - 1].key] || 0), top)}%</div>
              </div>
              <div className="space-y-1.5">
                {f.steps.map((s, i) => {
                  const cur = rec[s.key] || 0;
                  const prev = i > 0 ? (rec[f.steps[i - 1].key] || 0) : cur;
                  const width = pct(cur, top);
                  const dropPrev = i > 0 && prev > 0 ? Math.round(((prev - cur) / prev) * 100) : 0;
                  const worst = i === worstIdx;
                  return (
                    <div key={s.key} className="flex items-center gap-3">
                      <div className="w-40 shrink-0 text-[13px] text-gray-700">{i + 1}. {t(s.label)}</div>
                      <div className="flex-1 h-6 bg-gray-100 rounded-md overflow-hidden relative">
                        <div className={`h-full ${worst ? "bg-rose-400" : "bg-emerald-400"}`} style={{ width: `${width}%` }} />
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-gray-800">{cur.toLocaleString("vi-VN")} · {width}%</span>
                      </div>
                      <div className="w-24 shrink-0 text-right text-[12px]">
                        {i > 0 && (dropPrev > 0
                          ? <span className={worst ? "text-rose-600 font-bold" : "text-gray-400"}>−{dropPrev}{t("% rớt")}</span>
                          : <span className="text-emerald-600">{t("giữ")}</span>)}
                      </div>
                    </div>
                  );
                })}
              </div>
              {worstIdx > 0 && worstDrop >= 0.3 && (
                <div className="mt-3 text-[13px] text-rose-700 bg-rose-50 rounded-lg px-3 py-2">
                  {t("Rớt mạnh nhất ở bước")} <b>{t(f.steps[worstIdx].label)}</b> (−{Math.round(worstDrop * 100)}{t("%). Đây là chỗ nên ưu tiên cải thiện.")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function keyOf(f: any) { return Object.keys(FUNNELS).find((k) => (FUNNELS as any)[k] === f) || ""; }
