import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove, isSalePosition } from "@/lib/auth";
import Trend from "./Trend";
import { getT } from "@/lib/i18n-server";
import { layDoanhThuNhieuThang, gopTenSale } from "@/lib/doanh-thu";
import { saleCuaNick } from "@/lib/zalo-nick-sale";
import { getTeamWordGuard } from "@/lib/word-guardrail";
import { Users, ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("AI chấm tư vấn sale | ACME Ops Hub") };
}

const saleOf = (r: any) => saleCuaNick(r.account_id, r.last_message_time || r.analyzed_at) || r.account_name || "?";

export default async function ChatQualityPage({ searchParams }: { searchParams: { acc?: string } }) {
  const { t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const manager = user.role === "admin" || user.role === "ceo" || isManagerOrAbove(user.role);
  const saleOnly = !manager && isSalePosition((user as any).position);
  if (!manager && !saleOnly) redirect("/");

  const sb = getServiceClient();
  const probe = await sb.from("salework_chat_analysis").select("id").limit(1);
  const tableMissing = !!probe.error;

  let rows: any[] = [];
  if (!tableMissing) {
    const { data } = await sb.from("salework_chat_analysis").select("*").order("score", { ascending: true }).limit(200);
    rows = data ?? [];
  }
  const sales = [...new Set(rows.map(saleOf))];

  const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").trim();
  const mySale = saleOnly ? (sales.find(s => norm(s) === norm(user.full_name)) || sales.find(s => norm(s) && (norm(user.full_name).includes(norm(s)) || norm(s).includes(norm(user.full_name)))) || null) : null;
  const acc = saleOnly ? mySale : searchParams.acc;
  const list = (saleOnly && !mySale) ? [] : (acc ? rows.filter(r => saleOf(r) === acc) : rows);

  const hasPhone = (r: any) => !!(r.phone && String(r.phone).replace(/\D/g, "").length >= 9) || /0\d{8,10}/.test(r.customer_name || "");
  const isSlip = (r: any) => hasPhone(r) && arr(r.tags).some((tg: string) => /không ch[oố]t|follow[- ]?up/i.test(tg));
  const perSale = sales.map(s => {
    const rs = rows.filter(r => saleOf(r) === s);
    const tagC: Record<string, number> = {};
    for (const r of rs) for (const tg of arr(r.tags)) tagC[tg] = (tagC[tg] || 0) + 1;
    const topTag = Object.entries(tagC).sort((a, b) => b[1] - a[1])[0];
    const realN = rs.filter(hasPhone).length;
    const slip = rs.filter(isSlip).length;
    return { sale: s, n: rs.length, avg: rs.length ? Math.round(rs.reduce((a, r) => a + (r.score || 0), 0) / rs.length * 10) / 10 : 0, weak: rs.filter(r => (r.score || 0) <= 4).length, realN, slip, slipPct: realN ? Math.round(slip / realN * 100) : 0, topTag: topTag ? topTag[0] : "—" };
  }).sort((a, b) => b.slipPct - a.slipPct);
  const myRank = saleOnly && mySale ? ([...perSale].sort((a, b) => b.avg - a.avg).findIndex(s => s.sale === mySale) + 1) : 0;

  const weekKey = (ts: string) => { const d = new Date(ts); const dow = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - dow); return d.toISOString().slice(5, 10); };
  const wmap: Record<string, Record<string, { sum: number; n: number }>> = {};
  for (const r of rows) { if (!r.last_message_time) continue; const wk = weekKey(r.last_message_time); const s = saleOf(r); ((wmap[wk] ??= {})[s] ??= { sum: 0, n: 0 }); wmap[wk][s].sum += r.score || 0; wmap[wk][s].n++; }
  const weekly = Object.keys(wmap).sort().slice(-10).map(wk => { const o: any = { week: wk }; for (const s of sales) { const v = wmap[wk][s]; if (v?.n) o[s] = Math.round(v.sum / v.n * 10) / 10; } return o; });

  const gopTen = gopTenSale(sales.map((ten) => ({ ten })));
  const li = (await layDoanhThuNhieuThang(sb, "2026-03-01", new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10))).rows;
  const revMap: Record<string, Record<string, number>> = {};
  for (const r of li) { const mo = (r.order_date || "").slice(0, 7); const n = gopTen(r.sale_name); if (!mo || !n) continue; (revMap[n] ??= {})[mo] = (revMap[n][mo] || 0) + (r.net_amount || 0); }
  const monthly = sales.map(s => {
    const sc: Record<string, { sum: number; n: number }> = {};
    for (const r of rows.filter(r => saleOf(r) === s)) { const mo = (r.last_message_time || "").slice(0, 7); if (!mo) continue; (sc[mo] ??= { sum: 0, n: 0 }); sc[mo].sum += r.score || 0; sc[mo].n++; }
    const rev = revMap[s] || {};
    const months = [...new Set([...Object.keys(sc), ...Object.keys(rev)])].sort();
    return { sale: s, rows: months.map(mo => ({ month: mo, avg: sc[mo]?.n ? Math.round(sc[mo].sum / sc[mo].n * 10) / 10 : null, conv: sc[mo]?.n || 0, revenue: Math.round(rev[mo] || 0) })) };
  }).filter(m => m.rows.length);
  const avg = list.length ? Math.round(list.reduce((s, r) => s + (r.score || 0), 0) / list.length * 10) / 10 : 0;
  const weak = list.filter(r => (r.score || 0) <= 4).length;

  const wordGuard = await getTeamWordGuard(7).catch(() => null);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">{t("AI chấm chất lượng tư vấn")} {saleOnly ? t("của bạn") : t("sale")}</h1>
        <p className="text-sm text-gray-500 mt-1">{saleOnly ? t("AI phân tích chat của BẠN → điểm yếu & gợi ý cụ thể để cải thiện tỉ lệ chốt. Đọc mục 'Nên làm' để sửa ngay.") : <>{t("Claude phân tích chat Zalo (Salework) → điểm yếu & cách chăm để tăng tỉ lệ chốt + giá trị đơn. Cập nhật:")} <code>node scripts/salework-analyze-chat.mjs</code></>}</p>
      </div>

      {wordGuard && wordGuard.lessons.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
          <div className="text-sm font-bold text-rose-800 flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> {t("Nhắc chung cả team — ngôn từ CẦN TRÁNH")}</div>
          <p className="text-xs text-rose-700 mt-1">{t("7 ngày qua team chạm")} <b>{wordGuard.weekViol}</b> {t("cuộc dùng từ cấm. Thực phẩm bổ sung — 1 câu claim chữa bệnh có thể phạt 30-60tr. Ai cũng đọc để không lặp lại.")}</p>
          <div className="mt-3 space-y-1.5">
            {wordGuard.lessons.map((l, i) => (
              <div key={i} className="flex items-center gap-2 text-sm flex-wrap">
                <span className="text-rose-600 line-through shrink-0">{l.phrase}</span>
                <span className="text-gray-400">→</span>
                <span className="text-emerald-700 font-medium">{t("nói")} “{l.safe}”</span>
                <span className="text-[11px] text-gray-400 ml-auto shrink-0">{l.count} {t("lần")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {saleOnly && !mySale && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-sm text-amber-800">{t("Chưa khớp được tài khoản chat Zalo với hồ sơ của bạn nên chưa có điểm. Báo quản lý để gắn giúp nhé.")}</div>
      )}

      {tableMissing ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-sm text-amber-800">
          {t("Chưa tạo bảng")} <code>salework_chat_analysis</code>. {t("Paste")} <code>supabase/migrations/031_salework_chat_analysis.sql</code> {t("vào Supabase → SQL Editor → Run, rồi chạy")} <code>node scripts/salework-analyze-chat.mjs</code>.
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">{t("Chưa có dữ liệu. Chạy")} <code>node scripts/salework-analyze-chat.mjs</code> {t("để AI chấm.")}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label={t("Hội thoại đã chấm")} value={String(list.length)} tone="slate" />
            <Stat label={t("Điểm TB")} value={`${avg}/10`} tone={avg >= 7 ? "emerald" : avg >= 5 ? "blue" : "red"} />
            <Stat label={t("Cần cải thiện (≤4đ)")} value={String(weak)} tone={weak > 0 ? "red" : "emerald"} />
            {saleOnly
              ? <Stat label={t("Xếp hạng team")} value={myRank ? `#${myRank}/${sales.length}` : "—"} tone="blue" />
              : <Stat label={t("Số sale")} value={String(sales.length)} tone="slate" />}
          </div>

          {!saleOnly && !acc && perSale.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-x-auto">
              <div className="p-3 border-b border-gray-100 text-sm font-semibold flex items-center gap-2"><Users className="w-4 h-4 text-gray-500" /> {t("Theo từng sale (để tuột khách nhiều → ít)")}</div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase"><tr><th className="text-left p-3">{t("Sale")}</th><th className="text-right p-3">{t("Để tuột khách")}</th><th className="text-right p-3">{t("Điểm TB")}</th><th className="text-right p-3">{t("Hội thoại")}</th><th className="text-right p-3">{t("Cần coach")}</th><th className="text-left p-3">{t("Lỗi hay mắc nhất")}</th></tr></thead>
                <tbody>
                  {perSale.map(s => (
                    <tr key={s.sale} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="p-3 font-medium"><a className="text-blue-600 hover:underline" href={`/chat-quality?acc=${encodeURIComponent(s.sale)}`}>{s.sale}</a></td>
                      <td className={`p-3 text-right font-bold ${s.slipPct >= 50 ? "text-red-600" : s.slipPct >= 30 ? "text-amber-600" : "text-emerald-600"}`}>{s.slipPct}%<span className="text-[11px] font-normal text-gray-400"> ({s.slip}/{s.realN})</span></td>
                      <td className={`p-3 text-right font-bold ${s.avg >= 7 ? "text-emerald-600" : s.avg >= 5 ? "text-blue-600" : "text-red-600"}`}>{s.avg}</td>
                      <td className="p-3 text-right">{s.n}</td>
                      <td className="p-3 text-right text-red-600">{s.weak}</td>
                      <td className="p-3 text-xs text-gray-600">{s.topTag}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!saleOnly && !acc && <Trend weekly={weekly} sales={sales} monthly={monthly} />}

          {!saleOnly && (
            <div className="flex flex-wrap gap-2 text-sm">
              <a href="/chat-quality" className={`px-3 py-1.5 rounded-lg border ${!acc ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200"}`}>{t("Tất cả sale")}</a>
              {sales.map(a => <a key={a} href={`/chat-quality?acc=${encodeURIComponent(a)}`} className={`px-3 py-1.5 rounded-lg border ${acc === a ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200"}`}>{a}</a>)}
            </div>
          )}

          {(() => {
            const tagCount: Record<string, number> = {};
            for (const r of list) for (const tg of arr(r.tags)) tagCount[tg] = (tagCount[tg] || 0) + 1;
            const top = Object.entries(tagCount).sort((a, b) => b[1] - a[1]);
            if (!top.length) return null;
            const max = top[0][1];
            return (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
                <div className="text-sm font-semibold mb-2">{t("Lỗi phổ biến nhất")} {acc ? `— ${acc}` : t("(cả team)")} {t("— ưu tiên đào tạo")}</div>
                <div className="space-y-1.5">
                  {top.slice(0, 8).map(([tg, n]) => (
                    <div key={tg} className="flex items-center gap-2 text-sm">
                      <div className="w-44 shrink-0 text-gray-700">{tg}</div>
                      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden"><div className="h-full bg-red-400" style={{ width: `${Math.round(n / max * 100)}%` }} /></div>
                      <div className="w-10 text-right text-gray-500">{n}</div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-2">{t("Số = số hội thoại mắc lỗi đó. Đây là chủ đề nên đưa vào buổi training chung.")}</p>
              </div>
            );
          })()}
          <p className="text-xs text-gray-400">{t("Sắp theo điểm thấp → cao (ưu tiên coaching trước).")}</p>
          <div className="space-y-3">
            {list.map(r => (
              <div key={r.id} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{r.customer_name || t("(khách)")} <span className="text-xs font-normal text-gray-400">· {t("sale")} {saleOf(r)} · {r.msg_count} {t("tin")}</span></div>
                    {r.customer_need && <div className="text-xs text-gray-500 mt-0.5">{t("Khách cần:")} {r.customer_need}</div>}
                  </div>
                  <div className={`shrink-0 text-2xl font-bold ${r.score >= 7 ? "text-emerald-600" : r.score >= 5 ? "text-blue-600" : "text-red-600"}`}>{r.score}<span className="text-sm text-gray-400">/10</span></div>
                </div>
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mt-3 text-sm">
                  {arr(r.weaknesses).length > 0 && <Block title={t("Điểm yếu")} items={arr(r.weaknesses)} color="text-red-700" />}
                  {arr(r.missed).length > 0 && <Block title={t("Cơ hội bỏ lỡ")} items={arr(r.missed)} color="text-orange-700" />}
                  {arr(r.suggestions).length > 0 && <Block title={t("Nên làm")} items={arr(r.suggestions)} color="text-emerald-700" />}
                  {arr(r.did_well).length > 0 && <Block title={t("✓ Làm tốt")} items={arr(r.did_well)} color="text-gray-500" />}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function arr(v: any): string[] { return Array.isArray(v) ? v : []; }
function Block({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div>
      <div className={`text-xs font-semibold ${color} mb-1`}>{title}</div>
      <ul className="space-y-0.5 text-xs text-gray-600 list-disc pl-4">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </div>
  );
}
function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  const t: Record<string, string> = { slate: "text-gray-900", emerald: "text-emerald-700", blue: "text-blue-700", red: "text-red-600" };
  return <div className="bg-white rounded-xl border border-gray-200 p-4"><div className="text-xs text-gray-500 uppercase">{label}</div><div className={`text-xl font-bold mt-1 ${t[tone]}`}>{value}</div></div>;
}
