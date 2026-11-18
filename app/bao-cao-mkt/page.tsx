import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove, isMktPosition } from "@/lib/auth";
import { fmtVND, vnDateStr } from "@/lib/payroll";
import { getT } from "@/lib/i18n-server";
import { Stat } from "@/components/stat";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Báo cáo hiệu suất đăng bài | IKIHEALING Hub") };
}

const MKT_DEPT = "Marketing";
const norm = (s: string) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
const PLATFORMS = [
  { key: "posts_fb", short: "FB", label: "Facebook", color: "#1877F2", ci: /facebook|fb/i },
  { key: "posts_tiktok", short: "TikTok", label: "TikTok", color: "#111827", ci: /tiktok/i },
  { key: "posts_youtube", short: "YouTube", label: "YouTube", color: "#EF4444", ci: /youtube|^yt$/i },
  { key: "posts_website", short: "Website", label: "Website", color: "#10B981", ci: /web|blog/i },
];

type Row = { id: string; name: string; counts: number[]; total: number };

function aggregate(reports: any[], users: any[], from: string, to: string): { rows: Row[]; totals: number[]; grand: number } {
  const byUser: Record<string, number[]> = {};
  for (const u of users) byUser[u.id] = [0, 0, 0, 0];
  for (const r of reports) {
    if (r.report_date < from || r.report_date > to) continue;
    if (!byUser[r.user_id]) continue;
    const f = r.fields || {};
    PLATFORMS.forEach((p, i) => { byUser[r.user_id][i] += Number(f[p.key] || 0); });
  }
  const rows: Row[] = users.map(u => {
    const counts = byUser[u.id] || [0, 0, 0, 0];
    return { id: u.id, name: u.full_name, counts, total: counts.reduce((a, b) => a + b, 0) };
  }).filter(r => r.total > 0).sort((a, b) => b.total - a.total);
  const totals = [0, 0, 0, 0];
  for (const r of rows) r.counts.forEach((c, i) => totals[i] += c);
  const grand = totals.reduce((a, b) => a + b, 0);
  return { rows, totals, grand };
}

export default async function BaoCaoMktPage() {
  const { t: tDich } = getT();
  const { t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove(user.role) && !isMktPosition((user as any).position)) redirect("/?denied=baocaomkt");
  const sb = getServiceClient();

  const today = vnDateStr();
  const month = today.slice(0, 7);
  const dim = new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate();
  const mFrom = `${month}-01`, mTo = `${month}-${String(dim).padStart(2, "0")}`;
  const yest = new Date(new Date(today).getTime() - 864e5).toISOString().slice(0, 10);
  const wFrom = new Date(new Date(today).getTime() - 6 * 864e5).toISOString().slice(0, 10);

  const { data: usersRaw } = await sb.from("users")
    .select("id, full_name, position, active, departments!users_department_id_fkey(name)").eq("active", true);
  const mktUsers = (usersRaw ?? []).filter((u: any) => u.departments?.name === MKT_DEPT || isMktPosition(u.position));

  const { data: reports } = await sb.from("daily_reports").select("user_id, report_date, fields")
    .gte("report_date", mFrom).lte("report_date", mTo);

  const datesWithData = [...new Set((reports ?? []).filter(r => mktUsers.some((u: any) => u.id === r.user_id) && PLATFORMS.some(p => Number((r.fields || {})[p.key] || 0) > 0)).map(r => r.report_date))].sort();
  const dayDate = datesWithData.includes(yest) ? yest : (datesWithData.slice(-1)[0] || yest);

  const day = aggregate(reports ?? [], mktUsers, dayDate, dayDate);
  const week = aggregate(reports ?? [], mktUsers, wFrom, today);
  const monthAgg = aggregate(reports ?? [], mktUsers, mFrom, mTo);

  const { data: ci } = await sb.from("content_items").select("author_id, channel, publish_date, created_at")
    .or(`publish_date.gte.${mFrom}T00:00:00,created_at.gte.${mFrom}T00:00:00`);
  const ciByPlatform = [0, 0, 0, 0]; let ciTotal = 0;
  for (const c of ci ?? []) {
    const d = (c.publish_date || c.created_at || "").slice(0, 10);
    if (d < mFrom || d > mTo) continue;
    const idx = PLATFORMS.findIndex(p => p.ci.test(c.channel || ""));
    if (idx >= 0) { ciByPlatform[idx]++; ciTotal++; }
  }

  const leader = monthAgg.rows[0];
  const topPlatform = monthAgg.totals.map((t, i) => ({ i, t })).sort((a, b) => b.t - a.t)[0];
  const topPlatformPct = monthAgg.grand ? Math.round(topPlatform.t / monthAgg.grand * 100) : 0;
  const activeDay = day.rows.length;

  const { thongKeDang } = await import("@/lib/content-posted");
  const dangThang = await thongKeDang(mFrom, mTo).catch(() => ({ nhoms: [], tong: 0 }));
  const dangTuan = await thongKeDang(wFrom, today).catch(() => ({ nhoms: [], tong: 0 }));

  let fbGraph: any = null;
  try { fbGraph = JSON.parse((await sb.from("config").select("value").eq("key", "fb_graph_latest").maybeSingle()).data?.value || "null"); } catch { }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{t("Báo cáo hiệu suất đăng bài — Phòng Marketing")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("Số bài theo nhân viên × nền tảng · Facebook · TikTok · YouTube · Website. Nguồn: Báo cáo cuối ngày của MKT.")}</p>
        </div>
        <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg self-start">{t("Kỳ")}: {month.slice(5)}/{month.slice(0, 4)} · {t("lập")} {today}</span>
      </div>

      <section className="bg-white border border-emerald-200 rounded-xl overflow-hidden">
        <div className="p-3 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between flex-wrap gap-2">
          <span className="font-bold text-sm">{t("Bài đã đăng thật — tách theo nhóm")}</span>
          <span className="text-[11px] text-gray-500">{t("Tháng này")}: <b>{dangThang.tong}</b> {t("bài")} · {t("7 ngày")}: <b>{dangTuan.tong}</b></span>
        </div>
        {dangThang.nhoms.length ? (
          <div className="divide-y divide-gray-100">
            {dangThang.nhoms.map((n) => (
              <div key={tDich(n.nhom)} className="p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="sm:w-44 shrink-0">
                  <div className="font-semibold text-sm text-gray-800">{n.tenNhom}</div>
                  <div className="text-[11px] text-gray-500">{n.tong} {t("bài trong tháng")}</div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {n.theoNguoi.map((p) => (
                    <span key={tDich(p.ten)} className="text-[12px] px-2 py-1 rounded-lg bg-gray-50 border border-gray-150 text-gray-700">
                      {tDich(p.ten)} <b className="tabular-nums">{p.so}</b>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-3 text-[12px] text-gray-500">
            {t("Chưa có lượt đăng nào được ghi trong tháng. Số này đếm từ nút")} <b>{t("Đã đăng")}</b> {t("nhân viên bấm trên Telegram — bấm nút thì bài mới được tính.")}
          </div>
        )}
        <div className="px-3 pb-3 text-[11px] text-gray-400">
          {t("Đếm từ hành động thật (ai bấm, bấm ở nhóm nào), không phải số tự khai trong báo cáo cuối ngày.")}
        </div>
      </section>

      {fbGraph?.pages?.length > 0 && (
        <section className="bg-white border border-blue-200 rounded-xl overflow-hidden">
          <div className="p-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between flex-wrap gap-2">
            <span className="font-bold text-sm">{t("Facebook fanpage (Meta API)")}</span>
            <span className="text-[11px] text-gray-500">{Number(fbGraph.totals?.followers || 0).toLocaleString("vi")} {t("follower")} · {fbGraph.totals?.active7 || 0} {t("inbox HĐ 7 ngày")} · {fbGraph.totals?.unread || 0} {t("chưa đọc")}{fbGraph.generatedAt ? ` · ${String(fbGraph.generatedAt).slice(0, 10)}` : ""}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase"><tr><th className="text-left p-2">{t("Fanpage")}</th><th className="text-right p-2">{t("Follower")}</th><th className="text-right p-2">{t("Inbox 7 ngày")}</th><th className="text-right p-2">{t("Inbox 30 ngày")}</th><th className="text-right p-2">{t("Chưa đọc")}</th></tr></thead>
              <tbody className="tabular-nums">
                {fbGraph.pages.map((p: any, i: number) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="p-2 font-medium">{p.name}</td>
                    <td className="p-2 text-right">{Number(p.followers || 0).toLocaleString("vi")}</td>
                    <td className="p-2 text-right">{p.active7 || 0}</td>
                    <td className="p-2 text-right text-gray-500">{p.active30 || 0}</td>
                    <td className={`p-2 text-right ${p.unread > 0 ? "text-red-600 font-semibold" : "text-gray-400"}`}>{p.unread || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-3 py-2 text-[11px] text-gray-400">{t("Nguồn Meta Graph API chính thức (9 fanpage). SĐT không có trong inbox FB (đặc thù kênh) — lấy ở bước lên đơn.")}</p>
        </section>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label={t("Tổng bài tháng")} value={`${monthAgg.grand}`} color="#6366F1" hint={t("bài đã đăng")} />
        <Stat label={t("Dẫn đầu tháng")} value={leader ? leader.name : "—"} color="#F59E0B" hint={leader ? `${leader.total} ${t("bài")}` : ""} />
        <Stat label={t("Kênh chủ lực")} value={`${topPlatformPct}%`} color={PLATFORMS[topPlatform.i].color} hint={`${tDich(PLATFORMS[topPlatform.i].label)} (${topPlatform.t})`} />
        <Stat label={`${t("Ngày")} ${dayDate.slice(8)}/${dayDate.slice(5, 7)}`} value={`${day.grand}`} color="#10B981" hint={`${activeDay}/${mktUsers.length} ${t("NV hoạt động")}`} />
      </div>

      <PeriodTable title={`1 · ${t("Báo cáo ngày")} — ${dayDate.slice(8)}/${dayDate.slice(5, 7)}/${dayDate.slice(0, 4)}`} agg={day} accent="#3B82F6" showMix />
      <PeriodTable title={`2 · ${t("Báo cáo tuần")} — ${wFrom.slice(8)}/${wFrom.slice(5, 7)} → ${today.slice(8)}/${today.slice(5, 7)}`} agg={week} accent="#8B5CF6" />
      <PeriodTable title={`3 · ${t("Báo cáo tháng")} — ${month.slice(5)}/${month.slice(0, 4)}`} agg={monthAgg} accent="#0EA5E9" />

      <section className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
        <h2 className="font-bold mb-2">{t("Đối chiếu Content log (trang Content MKT)")}</h2>
        <p className="text-xs text-gray-500 mb-2">{t("Số bài thực sự được log vào trang Content trong tháng — so với số tự báo cáo ở trên để phát hiện lệch.")}</p>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p, i) => (
            <span key={p.key} className="text-xs px-2.5 py-1 rounded-lg" style={{ background: p.color + "1A", color: p.color }}>
              {tDich(p.label)}: <b>{ciByPlatform[i]}</b> {t("log")} {monthAgg.totals[i] !== ciByPlatform[i] ? `(${t("báo cáo")} ${monthAgg.totals[i]})` : ""}
            </span>
          ))}
          <span className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600">{t("Tổng log")}: <b>{ciTotal}</b> · {t("Tổng báo cáo")}: <b>{monthAgg.grand}</b></span>
        </div>
      </section>
    </div>
  );
}

function PeriodTable({ title, agg, accent, showMix }: { title: string; agg: { rows: Row[]; totals: number[]; grand: number }; accent: string; showMix?: boolean }) {
  const { t: tDich } = getT();
  const { t } = getT();
  const maxTotal = Math.max(1, ...agg.rows.map(r => r.total));
  return (
    <section className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
      <h2 className="font-bold mb-3" style={{ color: accent }}>{title}</h2>
      {agg.rows.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">{t("Chưa có dữ liệu kỳ này (nhân viên chưa nhập số bài trong Báo cáo cuối ngày).")}</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr><th className="text-left p-2">{t("Nhân viên")}</th>{PLATFORMS.map(p => <th key={p.key} className="text-right p-2">{tDich(p.short)}</th>)}<th className="text-right p-2">{t("Tổng")}</th></tr>
              </thead>
              <tbody>
                {agg.rows.map((r, idx) => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="p-2 font-medium">{idx === 0 ? "" : idx === 1 ? "" : idx === 2 ? "" : ""}{r.name}</td>
                    {r.counts.map((c, i) => <td key={i} className="p-2 text-right tabular-nums">{c || "–"}</td>)}
                    <td className="p-2 text-right font-bold tabular-nums">{r.total}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 font-bold bg-gray-50">
                  <td className="p-2">{t("Cả phòng")}</td>
                  {agg.totals.map((t, i) => <td key={i} className="p-2 text-right tabular-nums">{t}</td>)}
                  <td className="p-2 text-right tabular-nums" style={{ color: accent }}>{agg.grand}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-xs font-semibold text-gray-500 mb-1">{t("Bài theo nhân viên")}</div>
              <div className="space-y-1.5">
                {agg.rows.map(r => (
                  <div key={r.id} className="flex items-center gap-2 text-xs">
                    <span className="w-20 truncate text-gray-600">{r.name}</span>
                    <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden"><div className="h-full rounded" style={{ width: `${r.total / maxTotal * 100}%`, background: accent }} /></div>
                    <span className="w-6 text-right tabular-nums font-medium">{r.total}</span>
                  </div>
                ))}
              </div>
            </div>
            {showMix && agg.grand > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-500 mb-1">{t("Cơ cấu nền tảng")}</div>
                <div className="flex h-5 rounded overflow-hidden">
                  {PLATFORMS.map((p, i) => agg.totals[i] > 0 && (
                    <div key={p.key} style={{ width: `${agg.totals[i] / agg.grand * 100}%`, background: p.color }} title={`${tDich(p.label)}: ${agg.totals[i]}`} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {PLATFORMS.map((p, i) => agg.totals[i] > 0 && (
                    <span key={p.key} className="text-[11px] flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: p.color }} />{tDich(p.short)} {agg.totals[i]}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

