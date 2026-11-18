import { getT } from "@/lib/i18n-server";

import Link from "next/link";
import { getServiceClient } from "@/lib/supabase-server";
import { vnDateStr } from "@/lib/payroll";
import { isSalePosition, isManagerOrAbove } from "@/lib/auth";
import { getMySaleUrgent } from "@/lib/sale-urgent";
import { ListTodo, Heart, MessageSquare, ClipboardCheck, ShoppingCart, FileText, type LucideIcon } from "lucide-react";

const norm = (s: string) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();

export default async function MyDay({ user }: { user: any }) {
  const { t: t } = getT();
  const sb = getServiceClient();
  const today = vnDateStr();
  const isSale = isSalePosition(user.position);
  const isManager = isManagerOrAbove(user.role);

  const { data: myTasks } = await sb.from("tasks")
    .select("id,title,status,priority,due_date")
    .eq("assignee_id", user.id).not("status", "in", "(done,cancelled)")
    .order("due_date", { ascending: true, nullsFirst: false }).limit(30);
  const tasks = myTasks || [];
  const overdue = tasks.filter((x: any) => x.due_date && x.due_date.slice(0, 10) < today);

  const { count: reportCount } = await sb.from("daily_reports").select("id", { count: "exact", head: true })
    .eq("user_id", user.id).eq("report_date", today).eq("status", "submitted");
  const reported = (reportCount || 0) > 0;

  let careDue: { name: string }[] = []; let careDueCount = 0;
  let urgent: any = null;
  let checklist: { done: boolean; missing: number } | null = null;
  let onlinePending = 0;
  if (isSale || isManager) {
    const { count } = await sb.from("orders").select("id", { count: "exact", head: true })
      .eq("source_platform", "salepage").eq("status", "pending");
    onlinePending = count || 0;
  }
  if (isSale) {
    const me = norm(user.full_name);
    const { data: due } = await sb.from("customer_care_log")
      .select("customer_name, sale_name").lte("next_due", today).eq("status", "active").limit(500);
    const mine = (due || []).filter((r: any) => norm(r.sale_name || "") === me);
    careDueCount = mine.length;
    careDue = mine.slice(0, 3).map((r: any) => ({ name: r.customer_name || "?" }));

    try { urgent = await getMySaleUrgent(user); } catch { }

    try {
      const { data } = await sb.from("config").select("value").eq("key", `salecheck_${today}__${user.id}`).maybeSingle();
      if (data?.value) { const doc = JSON.parse(data.value); checklist = { done: !(doc.missing || []).length, missing: (doc.missing || []).length }; }
      else checklist = null;
    } catch { }
  }

  const waiting = (urgent?.unreplied || 0) + (urgent?.fbTotal || 0);

  const clean = !overdue.length && !careDueCount && !waiting && reported && (!checklist || checklist.done);

  return (
    <div className="bg-white border border-emerald-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <div className="font-bold text-gray-900">{t("Hôm nay của tôi —")} {today.slice(8)}/{today.slice(5, 7)}</div>
        <span className={`text-[11px] px-2 py-0.5 rounded-full ${clean ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
          {clean ? t("Sạch việc — giữ nhịp!") : t("Còn việc cần xử lý")}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <Tile href="/tasks" icon={ListTodo} label={t("Việc của tôi")} value={String(tasks.length)}
          sub={overdue.length ? `${overdue.length} quá hạn` : tasks.length ? t("đang mở") : t("sạch việc")} danger={overdue.length > 0} />
        {isSale && <Tile href="/cham-soc-kh" icon={Heart} label={t("Khách cần chăm")} value={String(careDueCount)}
          sub={careDue.length ? careDue.map(c => c.name).join(", ").slice(0, 26) : t("không có khách due")} danger={careDueCount > 0} />}
        {isSale && <Tile href="/danh-ba-khach" icon={MessageSquare} label={t("Khách chờ trả lời")} value={String(waiting)}
          sub={urgent?.oldestHours ? `lâu nhất ${urgent.oldestHours}h` : "Zalo + Facebook"} danger={waiting > 0} />}
        {isSale && <Tile href="/sales/checklist" icon={ClipboardCheck} label={t("Checklist hôm nay")}
          value={checklist ? (checklist.done ? t("Đủ") : `thiếu ${checklist.missing}`) : t("Chưa")}
          sub={checklist ? (checklist.done ? t("đủ tag") : t("tag chưa xong")) : t("chưa cập nhật")} danger={!checklist || !checklist.done} />}
        {(isSale || isManager) && <Tile href="/sales/don-online" icon={ShoppingCart} label={t("Đơn online chờ")} value={String(onlinePending)}
          sub={onlinePending ? t("cần xác nhận") : t("không có đơn chờ")} danger={onlinePending > 0} />}
        <Tile href="/daily-report" icon={FileText} label={t("Báo cáo cuối ngày")} value={reported ? t("Đã nộp") : t("Chưa")}
          sub={reported ? t("hoàn thành ✓") : t("nộp trước khi về")} danger={!reported} />
      </div>

      {tasks.length > 0 && (
        <div className="border-t border-gray-100 pt-2">
          <div className="text-[11px] font-semibold text-gray-500 mb-1">{t("Việc gần hạn nhất:")}</div>
          <div className="space-y-1">
            {tasks.slice(0, 5).map((tk: any) => {
  const { t: t } = getT();
              const od = tk.due_date && tk.due_date.slice(0, 10) < today;
              return (
                <Link key={tk.id} href="/tasks" className="flex items-center gap-2 text-[12px] hover:bg-gray-50 rounded px-1 py-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${od ? "bg-red-500" : tk.priority === "urgent" || tk.priority === "high" ? "bg-amber-400" : "bg-gray-300"}`} />
                  <span className="truncate text-gray-700">{t(tk.title)}</span>
                  {tk.due_date && <span className={`ml-auto shrink-0 text-[10px] ${od ? "text-red-500 font-semibold" : "text-gray-400"}`}>{od ? t("QUÁ HẠN ") : ""}{tk.due_date.slice(8, 10)}/{tk.due_date.slice(5, 7)}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({ href, icon: Icon, label, value, sub, danger }: { href: string; icon?: LucideIcon; label: string; value: string; sub: string; danger?: boolean }) {
  return (
    <Link href={href} className={`rounded-xl border p-2.5 hover:shadow-sm transition ${danger ? "border-red-200 bg-red-50/50" : "border-gray-200 bg-gray-50/50"}`}>
      <div className="text-[11px] text-gray-500 flex items-center gap-1">{Icon && <Icon className="w-3.5 h-3.5" />} {label}</div>
      <div className={`text-lg font-bold ${danger ? "text-red-600" : "text-emerald-700"}`}>{value}</div>
      <div className="text-[10px] text-gray-400 truncate">{sub}</div>
    </Link>
  );
}
