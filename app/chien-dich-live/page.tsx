import { getT } from "@/lib/i18n-server";
import { loadLiveCampaign } from "@/lib/covan/state";
import { getServiceClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  cho: { label: "Chờ", cls: "bg-gray-100 text-gray-500 border-gray-200" },
  dang_lam: { label: "Đang làm", cls: "bg-amber-50 text-amber-700 border-amber-300" },
  xong: { label: "Xong", cls: "bg-emerald-50 text-emerald-700 border-emerald-300" },
  loi: { label: "Kẹt", cls: "bg-red-50 text-red-700 border-red-300" },
};

export default async function ChienDichLivePage() {
  const { t: tDich } = getT();
  const c = await loadLiveCampaign().catch(() => null);

  if (!c) {
    return (
      <div className="p-6 max-w-3xl">
        <h1 className="text-xl font-semibold mb-2">{tDich("Chiến dịch Live")}</h1>
        <p className="text-sm text-gray-500">
          {tDich("Chưa có chiến dịch nào chạy. Nhắn mục tiêu cho AI Cố vấn trên Telegram\n          (ví dụ: ốp doanh số, ra mắt sản phẩm) rồi /ok — sơ đồ sẽ sống ở đây.")}
        </p>
      </div>
    );
  }

  const total = c.items.length;
  const finished = c.items.filter((i) => i.status === "xong" || i.status === "loi").length;
  const pct = total ? Math.round((finished / total) * 100) : 0;

  const taskIds = c.items.filter((i) => i.task_id).map((i) => i.task_id as string);
  const taskState = new Map<string, { status: string; acknowledged: boolean | null; completed_at: string | null }>();
  if (taskIds.length) {
    try {
      const sb = getServiceClient();
      const { data } = await sb
        .from("tasks")
        .select("id,status,acknowledged,completed_at")
        .in("id", taskIds);
      for (const t of data || []) {
        taskState.set(String(t.id), {
          status: (t.status as string) || "todo",
          acknowledged: (t.acknowledged as boolean) ?? null,
          completed_at: (t.completed_at as string) || null,
        });
      }
    } catch {  }
  }
  const humanTotal = taskIds.length;
  const humanDone = taskIds.filter((id) => taskState.get(id)?.completed_at).length;
  const humanPct = humanTotal ? Math.round((humanDone / humanTotal) * 100) : null;

  const groups = new Map<string, typeof c.items>();
  for (const it of c.items) {
    if (!groups.has(it.phong_ban)) groups.set(it.phong_ban, []);
    groups.get(it.phong_ban)!.push(it);
  }

  return (
    <div className="p-6 space-y-6">
      {!c.done && (
        <script
          dangerouslySetInnerHTML={{ __html: "setTimeout(function(){location.reload()},8000);" }}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{tDich("Chiến dịch:")} {tDich(c.goal)}</h1>
        <span
          className={`text-xs px-2 py-1 rounded-full border ${c.done ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-amber-50 text-amber-700 border-amber-300"}`}
        >
          {c.done ? tDich("Hoàn tất") : tDich("Đang chạy — tự cập nhật 8s")}
        </span>
        <span className="text-xs text-gray-500">{tDich("Bắt đầu")} {c.started_at}</span>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{tDich("Máy chạy:")} {finished}/{total} {tDich("đầu việc ·")} {groups.size} {tDich("phòng ban")}</span>
            <span className="font-semibold text-gray-700">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        {humanPct !== null && (
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{tDich("Người thật hoàn thành:")} {humanDone}/{humanTotal} {tDich("việc đã giao")}</span>
              <span className="font-semibold text-gray-700">{humanPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full bg-sky-500 transition-all" style={{ width: `${humanPct}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[...groups.entries()].map(([pb, items]) => (
          <div key={pb} className="rounded-xl border bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium text-sm">P. {pb}</h2>
              <span className="text-xs text-gray-400">
                {items.filter((i) => i.status === "xong").length}/{items.length} xong
              </span>
            </div>
            <div className="space-y-2">
              {items.map((it) => {
                const st = STATUS_STYLE[it.status] || STATUS_STYLE.cho;
                return (
                  <div key={it.id} className={`rounded-lg border px-3 py-2 ${st.cls}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">
                        {it.id}. {tDich(it.title)}
                      </span>
                      <span className="text-xs shrink-0">
                        {tDich(st.label)}
                        {typeof it.score === "number" ? ` · ${it.score}/100` : ""}
                      </span>
                    </div>
                    <div className="text-xs opacity-70 mt-0.5">
                      {it.kind === "ai" ? tDich("AI làm") : tDich("Người thật")}
                      {tDich(it.note) ? ` · ${tDich(it.note)}` : ""}
                      {it.task_id && (() => {
                        const t = taskState.get(it.task_id);
                        if (!t) return null;
                        const st = t.completed_at
                          ? tDich("ĐÃ XONG THẬT")
                          : t.acknowledged
                            ? `đã nhận · ${t.status}`
                            : tDich("CHƯA nhận việc");
                        return ` · ${st}`;
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="font-medium text-sm mb-3">{tDich("Diễn biến trực tiếp")}</h2>
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {c.events.length === 0 && <p className="text-xs text-gray-400">{tDich("Chưa có diễn biến.")}</p>}
          {c.events.map((e, i) => (
            <div key={i} className="text-xs text-gray-600 flex gap-2">
              <span className="text-gray-400 shrink-0 tabular-nums">[{e.at}]</span>
              <span>{e.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
