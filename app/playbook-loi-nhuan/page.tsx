import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { PLAYS, LEVERS, buildProfitSnapshot, evaluatePlays, getActivePlays, type Lever } from "@/lib/profit-playbook";
import { TrendingUp, CircleDot, CheckCircle2, XCircle, HelpCircle } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profit Playbook | ACME Ops Hub" };

const STATUS_UI: Record<string, { label: string; cls: string }> = {
  "dang-do": { label: "Đang đo", cls: "bg-blue-100 text-blue-700" },
  thang: { label: "THẮNG", cls: "bg-emerald-100 text-emerald-700" },
  thua: { label: "THUA", cls: "bg-red-100 text-red-700" },
  "chua-ro": { label: "Chưa rõ", cls: "bg-gray-100 text-gray-600" },
};

export default async function Page() {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove(user.role)) redirect("/dashboard");

  const S = await buildProfitSnapshot();
  const scored = evaluatePlays(S);
  const active = await getActivePlays();
  const scoreById = new Map(scored.map(x => [x.play.id, x]));
  const activeById = new Map(active.filter(a => a.status === "dang-do").map(a => [a.id, a]));
  const doneById = new Map(active.filter(a => a.status !== "dang-do").map(a => [a.id, a]));
  const levers = Object.keys(LEVERS) as Lever[];

  return (
    <div className="mx-auto max-w-6xl p-4 space-y-5">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-6 w-6 text-emerald-700" />
        <div>
          <h1 className="text-xl font-bold">Profit Playbook — {PLAYS.length} {t("nước đi tăng lợi nhuận")}</h1>
          <p className="text-sm text-gray-500">
            {t("Máy soi số thật mỗi sáng, tự đề xuất TOP 3 qua Telegram (nút Giao việc), tự đo lại sau kỳ đo.\n            Đang KÍCH HOẠT theo số hôm nay:")} <b>{scored.length}</b> {t("· đang đo:")} <b>{activeById.size}</b> {t("· đã có kết quả:")} <b>{doneById.size}</b>.
          </p>
        </div>
      </div>

      {levers.map(lv => {
        const plays = PLAYS.filter(p => p.lever === lv);
        return (
          <div key={lv} className="rounded-xl border bg-white p-4">
            <h2 className="mb-2 font-semibold">{LEVERS[lv]} <span className="text-sm font-normal text-gray-400">({plays.length} {t("nước)")}</span></h2>
            <div className="divide-y">
              {plays.map(p => {
  const { t: t } = getT();
                const sc = scoreById.get(p.id);
                const act = activeById.get(p.id);
                const done = doneById.get(p.id);
                return (
                  <div key={p.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-start sm:gap-3">
                    <div className="flex w-28 shrink-0 items-center gap-1 tabular-nums text-xs text-gray-500">
                      <CircleDot className={`h-3 w-3 ${sc ? "text-emerald-500" : "text-gray-300"}`} />{p.id}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{t(p.ten)}</span>
                        {sc && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700">{t("đang kích hoạt · điểm")} {Math.round(sc.score)}</span>}
                        {act && <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_UI["dang-do"].cls}`}>{t(STATUS_UI["dang-do"].label)} {t("tới")} {act.measureAfter}</span>}
                        {done && (
                          <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${STATUS_UI[done.status]?.cls || ""}`}>
                            {done.status === "thang" ? <CheckCircle2 className="h-3 w-3" /> : done.status === "thua" ? <XCircle className="h-3 w-3" /> : <HelpCircle className="h-3 w-3" />}
                            {t(STATUS_UI[done.status]?.label)} {done.resultNote ? `— ${done.resultNote}` : ""}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">{p.viec}</div>
                      {sc && <div className="text-xs text-amber-700">{t("Vì sao bây giờ:")} {sc.evidence}</div>}
                      <div className="text-xs text-gray-400">{t("Đo:")} {p.kpi} ({p.kpiDir === "up" ? t("tăng") : t("giảm")} {t("là thắng) sau")} {p.doSauNgay} {t("ngày")}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
