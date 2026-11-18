import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { getCronHealth, scheduleLabel } from "@/lib/cron-health";
import { Activity, AlertTriangle, CheckCircle2, Clock, Radar, ServerCog, TrendingDown } from "lucide-react";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Sức Khỏe Cron | ACME Ops Hub") };
}

export default async function SucKhoeCronPage() {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(user.role === "admin" || user.role === "ceo" || isManagerOrAbove(user.role))) redirect("/");

  const h = await getCronHealth();

  const groups = new Map<string, typeof h.crons>();
  for (const c of h.crons) {
    if (!groups.has(c.group)) groups.set(c.group, []);
    groups.get(c.group)!.push(c);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <ServerCog className="h-7 w-7 text-indigo-500" />
        <div>
          <h1 className="text-2xl font-semibold">{t("Sức Khỏe Cron &amp; Nguồn Dữ Liệu")}</h1>
          <p className="text-sm text-neutral-500">
            {h.cronCount} {t("cron theo lịch trên Vercel ·")} {h.sourceOk} {t("nguồn khỏe ·")} {h.sourceBad} {t("nguồn cần xem")}
          </p>
        </div>
      </div>

      {h.anomalies.length > 0 && (
        <div className="mb-6 rounded-xl border border-rose-300 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-950/40">
          <div className="mb-2 flex items-center gap-2 font-medium text-rose-700 dark:text-rose-300">
            <TrendingDown className="h-5 w-5" /> {h.anomalies.length} {t("bất thường số liệu — cần đối chiếu")}
          </div>
          <ul className="space-y-2 text-sm">
            {h.anomalies.map((a) => (
              <li key={a.key} className="rounded-lg bg-white/60 p-2 dark:bg-black/20">
                <div className="font-medium">{t(a.label)}</div>
                <div className="text-neutral-600 dark:text-neutral-400">{t(a.note)}</div>
                <div className="mt-1 text-xs text-rose-700 dark:text-rose-400">{a.fix}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {h.bad.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
          <div className="mb-2 flex items-center gap-2 font-medium text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-5 w-5" /> {h.bad.length} {t("nguồn đang ngủ/chết — cần xử lý")}
          </div>
          <ul className="space-y-2 text-sm">
            {h.bad.map((s) => (
              <li key={s.key} className="rounded-lg bg-white/60 p-2 dark:bg-black/20">
                <div className="font-medium">{t(s.label)}</div>
                <div className="text-neutral-600 dark:text-neutral-400">{t(s.note)}</div>
                <div className="mt-1 text-xs text-amber-700 dark:text-amber-400">{t("Cách chữa:")} {s.fix}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-medium">
          <Radar className="h-5 w-5 text-neutral-400" /> {t("Nguồn dữ liệu sống (")}{h.sources.length})
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {h.sources.map((s) => (
            <div
              key={s.key}
              className="flex items-start gap-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
            >
              {s.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{t(s.label)}</div>
                <div className="truncate text-xs text-neutral-500">{t(s.note)}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-medium">
          <Activity className="h-5 w-5 text-neutral-400" /> {t("Cron theo lịch (")}{h.cronCount})
        </h2>
        <div className="space-y-5">
          {[...groups.entries()].map(([group, rows]) => (
            <div key={group}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                {group} ({rows.length})
              </div>
              <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                {rows.map((c, i) => (
                  <div key={c.path + i} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="truncate tabular-nums text-xs text-neutral-700 dark:text-neutral-300">{c.name}</span>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-neutral-500">
                      <Clock className="h-3.5 w-3.5" /> {scheduleLabel(c.schedule)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-8 text-xs text-neutral-400">
        {t("Nguồn sống lấy từ AI Canh Gác (watchdog). Cron lấy trực tiếp từ vercel.json — trang chỉ đọc, không đụng vào cron.")}
      </p>
    </div>
  );
}
