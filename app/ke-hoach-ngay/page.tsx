import { getT } from "@/lib/i18n-server";
import Link from "next/link";
import { requireUser } from "@/lib/auth-server";
import { isManagerOrAbove } from "@/lib/auth";
import { buildDayPlan, SLOTS, type PlanTask } from "@/lib/day-plan";
import { getConfigValue } from "@/lib/app-config";
import { Panel } from "@/components/dashboard-ui";
import { CalendarClock, Clock, AlertTriangle, Eraser, ListTodo, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function KeHoachNgayPage({ searchParams }: { searchParams: { view?: string } }) {
  const { t: tDich } = getT();
  const user = await requireUser();
  const isManager = isManagerOrAbove(user.role);
  const team = isManager && searchParams.view === "team";

  const plan = await buildDayPlan(team ? null : user.id);

  let expired: any = null;
  try {
    const raw = await getConfigValue("day_plan_expired_last");
    const j = raw ? JSON.parse(raw) : null;
    if (j?.expired > 0) expired = j;
  } catch {  }

  const today = plan.days[0];

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5 text-gray-900">
            <CalendarClock className="w-6 h-6 text-emerald-600" />
            {tDich("Kế hoạch ngày")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {team ? tDich("Toàn công ty") : tDich("Việc của bạn")} {tDich("— xếp theo khung giờ, trần")} {plan.cap} {tDich("việc/ngày. Việc dư tự đẩy sang ngày sau.")}
          </p>
        </div>
        {isManager && (
          <Link
            href={team ? "/ke-hoach-ngay" : "/ke-hoach-ngay?view=team"}
            className="text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 font-medium text-gray-700"
          >
            {team ? tDich("Xem việc của tôi") : tDich("Xem toàn công ty")}
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label={tDich("Hôm nay")} value={`${today?.count ?? 0}/${plan.cap}`} />
        <Stat label={tDich("Đang mở")} value={String(plan.totalOpen)} />
        <Stat label={tDich("Quá hạn")} value={String(plan.overdue)} warn={plan.overdue > 0} />
        <Stat label={tDich("Không còn chỗ")} value={String(plan.overload.length)} warn={plan.overload.length > 0} />
      </div>

      {expired && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-sm text-emerald-900 flex gap-3">
          <Eraser className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <b>{tDich("Đã dọn")} {expired.expired} {tDich("việc hết hiệu lực")}</b> {tDich("(ngày")} {expired.date}{tDich(") — việc máy sinh theo ngày, qua ngày là hết nghĩa.")}
            {expired.missedCalls > 0 && (
              <> {tDich("Tương ứng")} <b>{expired.missedCalls} {tDich("lượt gọi")}</b> {tDich("đã trôi qua không ai gọi.")}</>
            )}
            <div className="text-emerald-800/80 mt-1">
              {tDich("Khách chưa gọi không mất — vẫn nằm ở")} <Link href="/cham-soc-kh" className="underline">{tDich("Chăm sóc khách hàng")}</Link>.
            </div>
          </div>
        </div>
      )}

      {today && (
        <Panel title={`Hôm nay — ${today.date}`} icon={Clock}>
          <div className="space-y-3">
            {SLOTS.map((slot) => {
              const s = today.slots.find((x) => x.slot.key === slot.key);
              const tasks = s?.tasks ?? [];
              return (
                <div key={slot.key} className={`rounded-xl border p-3 ${tasks.length ? "border-gray-200 bg-white" : "border-dashed border-gray-200 bg-gray-50/60"}`}>
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <div className="font-semibold text-gray-800 text-sm">
                      {slot.from}–{slot.to} · {tDich(slot.label)}
                    </div>
                    <div className="text-[12px] text-gray-400">{tDich(slot.hint)}</div>
                  </div>
                  {tasks.length ? (
                    <ul className="mt-2 space-y-1.5">
                      {tasks.map((t) => <TaskRow key={t.id} t={t} showWho={team} />)}
                    </ul>
                  ) : (
                    <div className="mt-1 text-[13px] text-gray-400">{tDich("Trống")}</div>
                  )}
                </div>
              );
            })}
            {today.count === 0 && (
              <div className="text-sm text-gray-500">{tDich("Hôm nay không có việc nào đến hạn. Vào")} <Link href="/tasks" className="underline">{tDich("Công việc")}</Link> {tDich("để nhận thêm.")}</div>
            )}
          </div>
        </Panel>
      )}

      {plan.days.slice(1).some((d) => d.count > 0) && (
        <Panel title={tDich("Đã đẩy sang ngày sau (để hôm nay không quá tải)")} icon={ArrowRight}>
          <div className="space-y-3">
            {plan.days.slice(1).filter((d) => d.count > 0).map((d) => (
              <div key={d.date}>
                <div className="font-semibold text-gray-800 text-sm mb-1.5">{tDich(d.label)} — {d.date} ({d.count} {tDich("việc)")}</div>
                <ul className="space-y-1.5">
                  {d.slots.flatMap((s) => s.tasks).map((t) => <TaskRow key={t.id} t={t} showWho={team} />)}
                </ul>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {plan.overload.length > 0 && (
        <Panel title={`Quá tải — ${plan.overload.length} việc không còn chỗ trong 3 ngày`} icon={AlertTriangle} iconColor="#DC2626">
          <p className="text-sm text-gray-600 mb-3">
            {tDich("Đây là lúc")} <b>{tDich("bỏ bớt hoặc giao người khác")}</b>{tDich(", không phải lúc nhồi thêm. Dời tiếp là cách tồn đọng tự nhân lên.")}
          </p>
          <ul className="space-y-1.5">
            {plan.overload.map((t) => <TaskRow key={t.id} t={t} showWho={team} />)}
          </ul>
        </Panel>
      )}

      <div className="text-[12px] text-gray-400 flex items-center gap-1.5">
        <ListTodo className="w-3.5 h-3.5" />
        {tDich("Kế hoạch dựng lại mỗi lần mở trang từ danh sách việc thật ở")} <Link href="/tasks" className="underline">/tasks</Link> {tDich("— không phải bản lưu cứng.")}
      </div>
    </div>
  );
}

function TaskRow({ t, showWho }: { t: PlanTask; showWho: boolean }) {
  const { t: tDich } = getT();
  const prio = String(t.priority || "medium").toLowerCase();
  const color = prio === "urgent" ? "bg-red-100 text-red-700" : prio === "high" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600";
  return (
    <li className="flex items-start gap-2 text-sm">
      <span className={`shrink-0 text-[11px] px-1.5 py-0.5 rounded font-medium ${color}`}>{prio}</span>
      <span className="text-gray-800">
        {tDich(t.title)}
        {showWho && <span className="text-gray-400"> — {t.assignee_name}</span>}
        {t.overdue && <span className="text-red-600 font-medium"> {tDich("· quá hạn")} {t.due_date}</span>}
      </span>
    </li>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)]">
      <div className="text-[12px] text-gray-500">{label}</div>
      <div className={`text-2xl font-bold mt-0.5 ${warn ? "text-red-600" : "text-gray-900"}`}>{value}</div>
    </div>
  );
}
