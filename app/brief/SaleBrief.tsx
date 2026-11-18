import { getServiceClient } from "@/lib/supabase-server";
import { layDoanhThu, gopTenSale } from "@/lib/doanh-thu";
import { fmtVND, vnDateStr } from "@/lib/payroll";
import { getSaleSnapshot, norm } from "@/lib/sale-metrics";
import { calcPace } from "@/lib/bi-targets";
import Link from "next/link";
import { Heart, MessageSquare, Target, Trophy, ClipboardList, Phone } from "lucide-react";
import { getT } from "@/lib/i18n-server";

export default async function SaleBrief({ user }: { user: any }) {
  const { t: tDich } = getT();
  const { t } = getT();
  const sb = getServiceClient();
  const today = vnDateStr();
  const month = today.slice(0, 7);
  const dim = new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate();
  const dElapsed = +today.slice(8, 10);
  const expectedPct = Math.round(dElapsed / dim * 100);

  const { me, leaderboard } = await getSaleSnapshot(user.full_name, month);

  let revToday = 0;

  const { rows: liToday } = await layDoanhThu(sb, today, today);
  const gopTen = gopTenSale([{ ten: user.full_name || "" }]);
  for (const r of liToday) if (norm(gopTen(r.sale_name) || r.sale_name || "") === norm(user.full_name)) revToday += r.net_amount || 0;

  const firstName = (user.full_name || "").trim().split(" ").slice(-1)[0] || user.full_name;
  const hour = +new Date(Date.now() + 7 * 3600e3).toISOString().slice(11, 13);
  const greet = hour < 11 ? t("Chào buổi sáng") : hour < 14 ? t("Chào buổi trưa") : hour < 18 ? t("Chào buổi chiều") : t("Chào buổi tối");

  if (!me) {
    return (
      <div className="max-w-3xl mx-auto mt-10 bg-white border border-yellow-200 rounded-xl p-8 text-center">
        <div className="text-4xl mb-3"></div>
        <h1 className="text-xl font-bold">{greet}, {firstName}!</h1>
        <p className="text-gray-500 mt-2">{t("Chưa gắn được hồ sơ của bạn với dữ liệu sale (tên trong MISA chưa khớp). Báo admin để gắn nhé.")}</p>
      </div>
    );
  }

  const pace = calcPace(me.revenue, dElapsed, dim, me.target);
  const pctColor = me.pct == null ? "#9CA3AF" : me.pct >= 100 ? "#10B981" : me.pct >= expectedPct ? "#3B82F6" : "#EF4444";
  const unrep = me.unreplied;

  const todos: { icon: any; text: string; href: string; danger?: boolean }[] = [];
  if (unrep && unrep.count > 0)
    todos.push({ icon: MessageSquare, text: `${t("Trả lời ngay")} ${unrep.count} ${t("khách đang chờ")}${unrep.oldestHours >= 24 ? ` (${t("lâu nhất")} ${Math.round(unrep.oldestHours / 24)} ${t("ngày!)")}` : ""}`, href: "/danh-ba-khach", danger: true });
  if (me.careToday === 0)
    todos.push({ icon: Heart, text: t("Hôm nay chưa chăm khách nào — vào gửi tin nhắn chăm sóc"), href: "/cham-soc-kh", danger: true });
  if (me.callsToday === 0)
    todos.push({ icon: Phone, text: t("Hôm nay chưa GỌI khách nào — tệp nóng nên GỌI, đừng chỉ nhắn (chuyển đổi cao hơn)"), href: "/cham-soc-kh", danger: true });
  if (me.pct != null && me.pct < expectedPct)
    todos.push({ icon: Target, text: `${t("Doanh số đang chậm nhịp — cần ~")}${fmtVND(pace.dailyRateNeeded)}${t("/ngày để kịp KPI")}`, href: "/cham-soc-kh" });
  if (!todos.length)
    todos.push({ icon: Trophy, text: t("Bạn đang bám nhịp tốt — giữ phong độ chốt đơn & chăm khách "), href: "/sales/khach-cua-toi" });

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">{greet}, {firstName}!</h1>
        <p className="text-sm text-gray-500 mt-1">{t("Bản tin của bạn hôm nay")} {today} · {t("đã qua")} {expectedPct}% {t("tháng")} {month.slice(5)}.</p>
      </div>

      <section className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
        <h2 className="font-bold mb-2">{t("Việc cần làm hôm nay")}</h2>
        <div className="space-y-2">
          {todos.map((t, i) => (
            <Link key={i} href={t.href} className={`flex items-center gap-3 p-3 rounded-lg border ${t.danger ? "bg-red-50 border-red-200 text-red-800" : "bg-gray-50 border-gray-100 text-gray-700"} hover:brightness-95`}>
              <t.icon className="w-4 h-4 shrink-0" />
              <span className="text-sm font-medium flex-1">{t.text}</span>
              <span className="text-xs opacity-60">→</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
        <h2 className="font-bold mb-3">{t("Doanh số của tôi")} — {month.slice(5)}/{month.slice(0, 4)}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label={t("Tháng này")} value={fmtVND(me.revenue)} color={pctColor} />
          <Stat label={t("KPI tháng")} value={fmtVND(me.target)} color="#6B7280" hint={me.pct == null ? "—" : `${me.pct}% · ${t("kỳ vọng")} ${expectedPct}%`} />
          <Stat label={t("Hôm nay")} value={fmtVND(revToday)} color="#10B981" />
          <Stat label={t("Đơn · Khách")} value={`${me.orders} · ${me.custs}`} color="#8B5CF6" />
        </div>
        <div className="mt-3">
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, me.pct || 0)}%`, background: pctColor }} />
          </div>
          <div className="flex justify-between text-[11px] text-gray-400 mt-1">
            <span>{me.pct ?? 0}% KPI</span>
            <span>{t("Dự kiến cuối tháng:")} {fmtVND(pace.projectedEndOfPeriod)} ({Math.round(pace.projectedPercent)}%)</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/danh-ba-khach" className={`block rounded-xl p-4 border ${unrep && unrep.count > 0 ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`}>
          <div className="flex items-center gap-2 font-bold"><MessageSquare className="w-4 h-4" /> {t("Khách đang chờ tôi")}</div>
          <div className={`text-3xl font-bold mt-1 ${unrep && unrep.count > 0 ? "text-red-600" : "text-gray-400"}`}>{unrep?.count || 0}</div>
          <div className="text-xs text-gray-500 mt-1">{unrep && unrep.count > 0 ? `${t("Lâu nhất:")} ${unrep.oldestName} (${unrep.oldestHours >= 24 ? Math.round(unrep.oldestHours / 24) + " " + t("ngày") : Math.round(unrep.oldestHours) + "h"})` : t("Không có khách nào chờ — tốt!")}</div>
        </Link>
        <Link href="/cham-soc-kh" className="block rounded-xl p-4 border bg-white border-gray-200">
          <div className="flex items-center gap-2 font-bold"><Heart className="w-4 h-4" /> {t("Tôi đã chăm hôm nay")}</div>
          <div className={`text-3xl font-bold mt-1 ${me.careToday > 0 ? "text-emerald-600" : "text-gray-400"}`}>{me.careToday}</div>
          <div className="text-xs text-gray-500 mt-1">{me.careToday > 0 ? `${t("Tháng này:")} ${me.careMonth} ${t("lượt chăm sóc")}` : t("Chưa chăm ai — chăm khách chính là ra tiền!")}</div>
          <div className={`text-xs mt-0.5 ${me.callsToday > 0 ? "text-blue-600" : "text-red-500"}`}>{t("Gọi hôm nay:")} {me.callsToday}{me.callsToday === 0 ? " " + t("— tệp nóng nên gọi!") : ` · ${t("tháng")} ${me.callsMonth}`}</div>
        </Link>
      </div>

      <section className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
        <h2 className="font-bold mb-3 flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" /> {t("Bảng xếp hạng doanh số team")}</h2>
        <div className="space-y-1.5">
          {leaderboard.map((m) => {
            const meRow = norm(m.name) === norm(user.full_name);
            const medal = m.rank === 1 ? "" : m.rank === 2 ? "" : m.rank === 3 ? "" : `#${m.rank}`;
            return (
              <div key={m.userId} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${meRow ? "bg-blue-50 border border-blue-200 font-semibold" : "bg-gray-50"}`}>
                <span className="w-8 text-center">{medal}</span>
                <span className="flex-1 truncate">{m.name}{meRow ? " " + t("(bạn)") : ""}</span>
                <span className="tabular-nums">{fmtVND(m.revenue)}</span>
                <span className="w-12 text-right text-xs" style={{ color: m.pct == null ? "#9CA3AF" : m.pct >= 100 ? "#10B981" : "#6B7280" }}>{m.pct == null ? "—" : m.pct + "%"}</span>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-gray-400 mt-2">{t("Xếp theo doanh số tháng. Chăm khách & trả lời nhanh = lên hạng nhanh nhất.")}</p>
      </section>

      <div className="flex flex-wrap gap-2">
        <Link href="/sales/huong-dan" className="text-sm px-3 py-2 bg-violet-600 text-white rounded-lg flex items-center gap-2">{t("Hướng dẫn / Bắt đầu ở đây")}</Link>
        <Link href="/sales/checklist" className="text-sm px-3 py-2 bg-emerald-700 text-white rounded-lg flex items-center gap-2"><ClipboardList className="w-4 h-4" /> {t("Checklist hôm nay")}</Link>
        <Link href="/sales/khach-cua-toi" className="text-sm px-3 py-2 bg-gray-900 text-white rounded-lg flex items-center gap-2"><ClipboardList className="w-4 h-4" /> {t("Khách của tôi")}</Link>
        <Link href="/cham-soc-kh" className="text-sm px-3 py-2 bg-rose-600 text-white rounded-lg flex items-center gap-2"><Heart className="w-4 h-4" /> {t("Chăm sóc khách")}</Link>
        <Link href="/playbook" className="text-sm px-3 py-2 bg-amber-500 text-white rounded-lg">Sales Playbook</Link>
      </div>
    </div>
  );
}

function Stat({ label, value, color, hint }: { label: string; value: string; color: string; hint?: string }) {
  return <div className="bg-gray-50 border border-gray-100 rounded-xl p-3"><div className="text-xs text-gray-500">{label}</div><div className="text-lg font-bold" style={{ color }}>{value}</div>{hint && <div className="text-[11px] text-gray-400">{hint}</div>}</div>;
}
