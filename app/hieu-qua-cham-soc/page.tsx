import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove, isSalePosition } from "@/lib/auth";
import { normalizePhone } from "@/lib/zalo";
import { norm } from "@/lib/sale-metrics";
import { fmtVND, vnDateStr } from "@/lib/payroll";
import { layDoanhThuNhieuThang } from "@/lib/doanh-thu";
import { getConfigValue } from "@/lib/app-config";
import { getT } from "@/lib/i18n-server";
import { Stat } from "@/components/stat";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Hiệu quả chăm sóc | ACME Ops Hub") };
}

const slice10 = (s: any) => (s || "").toString().slice(0, 10);
function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a: string, b: string) {
  return Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 864e5);
}
function median(arr: number[]): number | null {
  if (!arr.length) return null;
  const s = [...arr].sort((x, y) => x - y); const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

type Agg = { cared: number; conv: number; rev: number; dto: number[] };
const emptyAgg = (): Agg => ({ cared: 0, conv: 0, rev: 0, dto: [] });

export default async function HieuQuaChamSocPage({ searchParams }: { searchParams: { w?: string } }) {
  const { t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const manager = isManagerOrAbove(user.role);
  const sale = isSalePosition((user as any).position);
  if (!manager && !sale) redirect("/?denied=hieuquachamsoc");
  const meMode = !manager && sale;
  const meKey = norm((user as any).full_name || "");

  const W = [30, 60, 90].includes(Number(searchParams.w)) ? Number(searchParams.w) : 30;
  const sb = getServiceClient();

  const { data: careRows } = await sb.from("customer_care_log")
    .select("customer_phone, customer_name, sale_name, flow_type, last_contact, note");

  const li = (await layDoanhThuNhieuThang(sb, "2026-03-01", vnDateStr())).rows;
  const ordMap: Record<string, { date: string; rev: number; phone: string | null }> = {};
  for (const r of li) {
    const o = (ordMap[r.order_code] ??= { date: slice10(r.order_date), rev: 0, phone: normalizePhone(r.customer_phone) });
    o.rev += r.net_amount || 0;
    const d = slice10(r.order_date); if (d > o.date) o.date = d;
  }
  const ordersByPhone = new Map<string, { date: string; rev: number }[]>();
  for (const o of Object.values(ordMap)) {
    if (!o.phone) continue;
    const arr = ordersByPhone.get(o.phone) || []; arr.push({ date: o.date, rev: o.rev }); ordersByPhone.set(o.phone, arr);
  }

  let callLog: Record<string, Record<string, any>> = {};
  try { callLog = JSON.parse((await getConfigValue("call_log")) || "{}"); } catch { }
  const chotBySale: Record<string, number> = {};
  for (const day of Object.keys(callLog)) {
    for (const [name, v] of Object.entries(callLog[day] || {})) {
      const c = typeof v === "object" ? (v as any).chot || 0 : 0;
      chotBySale[norm(name)] = (chotBySale[norm(name)] || 0) + c;
    }
  }

  const overall = emptyAgg();
  const byFlow: Record<string, Agg> = { notBought: emptyAgg(), bought: emptyAgg() };
  const bySale: Record<string, { name: string } & Agg> = {};
  const byPain: Record<string, Agg> = {};
  const seenPhone = new Set<string>();

  for (const c of careRows || []) {
    const ph = normalizePhone(c.customer_phone); if (!ph) continue;
    const lc = slice10(c.last_contact); if (!lc) continue;
    if (seenPhone.has(ph)) continue; seenPhone.add(ph);
    const saleKey = norm(c.sale_name || "");
    if (meMode && saleKey !== meKey) continue;

    const flow = c.flow_type === "notBought" ? "notBought" : "bought";
    const painM = (c.note || "").match(/^\s*\[([^\]]+)\]/);
    const pain = painM ? painM[1].trim() : "(không ghi nỗi đau)";

    const orders = ordersByPhone.get(ph) || [];
    const upper = addDays(lc, W);
    const inWin = orders.filter(o => o.date > lc && o.date <= upper);
    const converted = inWin.length > 0;
    const revWin = inWin.reduce((s, o) => s + o.rev, 0);
    const firstInWin = converted ? inWin.map(o => o.date).sort()[0] : null;
    const dto = firstInWin ? daysBetween(lc, firstInWin) : null;

    const bump = (a: Agg) => { a.cared++; if (converted) { a.conv++; a.rev += revWin; if (dto != null) a.dto.push(dto); } };
    bump(overall);
    bump(byFlow[flow]);
    bump((byPain[pain] ??= emptyAgg()));
    const s = (bySale[saleKey] ??= { name: c.sale_name || "—", ...emptyAgg() });
    s.cared++; if (converted) { s.conv++; s.rev += revWin; if (dto != null) s.dto.push(dto); }
  }

  let touchLog: Record<string, any> = {};
  try { touchLog = JSON.parse((await getConfigValue("care_touch_log")) || "{}"); } catch { }
  const touchBuckets: { k: string; cared: number; conv: number }[] = [
    { k: "1", cared: 0, conv: 0 }, { k: "2", cared: 0, conv: 0 }, { k: "3", cared: 0, conv: 0 }, { k: "4+", cared: 0, conv: 0 },
  ];
  for (const [ph, tv] of Object.entries(touchLog)) {
    if (meMode && norm((tv as any).sale || "") !== meKey) continue;
    const n = (tv as any).n || 0; if (!n) continue;
    const b = touchBuckets[n >= 4 ? 3 : n - 1]; if (!b) continue;
    b.cared++; if ((ordersByPhone.get(ph) || []).length) b.conv++;
  }
  const hasTouch = touchBuckets.some(b => b.cared > 0);

  const pct = (a: Agg) => a.cared ? Math.round(a.conv / a.cared * 1000) / 10 : 0;
  const saleRows = Object.entries(bySale).map(([k, v]) => ({
    key: k, name: v.name, cared: v.cared, conv: v.conv, convPct: pct(v), rev: v.rev,
    dtoMed: median(v.dto), chotKhai: chotBySale[k] || 0,
  })).sort((a, b) => b.convPct - a.convPct || b.rev - a.rev);
  const painRows = Object.entries(byPain).map(([k, v]) => ({ pain: k, cared: v.cared, conv: v.conv, convPct: pct(v), rev: v.rev }))
    .sort((a, b) => b.convPct - a.convPct || b.cared - a.cared);

  let myRank: { rank: number; total: number } | null = null;
  if (meMode) {

    const fullBySale: Record<string, Agg> = {};
    const seen2 = new Set<string>();
    for (const c of careRows || []) {
      const ph = normalizePhone(c.customer_phone); if (!ph) continue;
      const lc = slice10(c.last_contact); if (!lc) continue;
      if (seen2.has(ph)) continue; seen2.add(ph);
      const sk = norm(c.sale_name || ""); if (!sk) continue;
      const orders = ordersByPhone.get(ph) || [];
      const upper = addDays(lc, W);
      const conv = orders.some(o => o.date > lc && o.date <= upper);
      const a = (fullBySale[sk] ??= emptyAgg()); a.cared++; if (conv) a.conv++;
    }
    const ranked = Object.entries(fullBySale).map(([k, v]) => ({ k, p: v.cared ? v.conv / v.cared : 0 })).sort((a, b) => b.p - a.p);
    const idx = ranked.findIndex(r => r.k === meKey);
    if (idx >= 0) myRank = { rank: idx + 1, total: ranked.length };
  }

  const oPct = pct(overall);
  const oMed = median(overall.dto);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{t("Hiệu quả chăm sóc → đơn hàng")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {meMode ? t("Khách BẠN đã chăm rồi có ra đơn thật không (nối qua SĐT với sổ đơn).") : t("Khách đã chăm rồi có ra đơn thật không — nối customer_care_log với sổ đơn qua SĐT.")}
          </p>
        </div>
        <form className="flex gap-2 items-center">
          <label className="text-sm text-gray-500">{t("Cửa sổ")}</label>
          <select name="w" defaultValue={String(W)} className="p-2 border border-gray-200 rounded-lg text-sm">
            <option value="30">30 {t("ngày")}</option>
            <option value="60">60 {t("ngày")}</option>
            <option value="90">90 {t("ngày")}</option>
          </select>
          <button className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm">{t("Xem")}</button>
        </form>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label={t("Khách đã chăm")} value={overall.cared.toLocaleString("vi")} hint={meMode && myRank ? `${t("Hạng")} ${myRank.rank}/${myRank.total}` : t("có SĐT + ngày chăm")} />
        <Stat label={t("Ra đơn sau chăm")} value={`${overall.conv.toLocaleString("vi")}`} hint={`${t("trong")} ${W} ${t("ngày")}`} color="#10B981" />
        <Stat label={t("Tỉ lệ ra đơn")} value={`${oPct}%`} color={oPct >= 20 ? "#10B981" : "#F59E0B"} />
        <Stat label={t("Thời gian chăm→đơn")} value={oMed != null ? `${oMed} ${t("ngày")}` : "—"} hint={t("trung vị")} />
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
        <div className="text-sm font-semibold mb-1">{t("Doanh thu đến từ khách đã chăm")}</div>
        <div className="text-2xl font-bold text-emerald-600">{fmtVND(overall.rev)}</div>
        <div className="text-xs text-gray-400 mt-1">{t("Tổng tiền các đơn phát sinh trong")} {W} {t("ngày sau lần chăm gần nhất.")}</div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
        <div className="font-bold mb-3">{t("Theo loại chăm sóc")}</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FlowCard title={t("Khách CHƯA mua (acquisition)")} a={byFlow.notBought} pct={pct(byFlow.notBought)} med={median(byFlow.notBought.dto)} W={W} t={t} />
          <FlowCard title={t("Khách ĐÃ mua (giữ chân / mua lại)")} a={byFlow.bought} pct={pct(byFlow.bought)} med={median(byFlow.bought.dto)} W={W} t={t} />
        </div>
      </div>

      {!meMode && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
          <div className="font-bold mb-1">{t("Theo từng sale")}</div>
          <p className="text-xs text-gray-400 mb-3">{t("Quy cho người CHĂM (care_log.sale_name). Đối chiếu \"chốt tự khai\" (call_log) vs \"đơn thật\" (sổ đơn Telegram) để lộ khai ảo.")}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr><th className="text-left p-2">{t("Sale")}</th><th className="text-right p-2">{t("Đã chăm")}</th><th className="text-right p-2">{t("Ra đơn")}</th><th className="text-right p-2">{t("Tỉ lệ")}</th><th className="text-right p-2">{t("Trung vị (ngày)")}</th><th className="text-right p-2">{t("DT từ chăm")}</th><th className="text-right p-2">{t("Chốt tự khai")}</th></tr>
              </thead>
              <tbody>
                {saleRows.map((s, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="p-2 font-medium">{i === 0 ? "" : i === 1 ? "" : i === 2 ? "" : ""}{s.name}</td>
                    <td className="p-2 text-right">{s.cared}</td>
                    <td className="p-2 text-right">{s.conv}</td>
                    <td className={`p-2 text-right font-semibold ${s.convPct >= 20 ? "text-emerald-600" : "text-amber-600"}`}>{s.convPct}%</td>
                    <td className="p-2 text-right text-gray-500">{s.dtoMed != null ? s.dtoMed : "—"}</td>
                    <td className="p-2 text-right">{fmtVND(s.rev)}</td>
                    <td className="p-2 text-right text-gray-400" title={t("Sale tự khai khi bấm Đã gọi → chốt (toàn bộ ngày còn lưu)")}>{s.chotKhai}</td>
                  </tr>
                ))}
                {!saleRows.length && <tr><td colSpan={7} className="p-6 text-center text-gray-400">{t("Chưa có dữ liệu chăm sóc")}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
        <div className="font-bold mb-1">{t("Theo nỗi đau (để nhân rộng cái hiệu quả)")}</div>
        <p className="text-xs text-gray-400 mb-3">{t("Lấy từ tag [nỗi đau] đầu ghi chú khi ghi khách telesales. Nỗi đau nào ra đơn cao → ưu tiên kịch bản đó.")}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase"><tr><th className="text-left p-2">{t("Nỗi đau")}</th><th className="text-right p-2">{t("Đã chăm")}</th><th className="text-right p-2">{t("Ra đơn")}</th><th className="text-right p-2">{t("Tỉ lệ")}</th><th className="text-right p-2">{t("DT từ chăm")}</th></tr></thead>
            <tbody>
              {painRows.map((p, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="p-2 font-medium">{p.pain}</td>
                  <td className="p-2 text-right">{p.cared}</td>
                  <td className="p-2 text-right">{p.conv}</td>
                  <td className={`p-2 text-right font-semibold ${p.convPct >= 20 ? "text-emerald-600" : "text-amber-600"}`}>{p.convPct}%</td>
                  <td className="p-2 text-right">{fmtVND(p.rev)}</td>
                </tr>
              ))}
              {!painRows.length && <tr><td colSpan={5} className="p-6 text-center text-gray-400">{t("Chưa có dữ liệu")}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {hasTouch && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
          <div className="font-bold mb-1">{t("Chạm mấy lần thì ra đơn?")}</div>
          <p className="text-xs text-gray-400 mb-3">{t("Số lần chăm/gọi (ghi nhận trên hệ thống) → tỉ lệ khách có đơn. Giúp biết cần kiên trì bao nhiêu lần.")}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase"><tr><th className="text-left p-2">{t("Số lần chạm")}</th><th className="text-right p-2">{t("Số khách")}</th><th className="text-right p-2">{t("Có đơn")}</th><th className="text-right p-2">{t("Tỉ lệ ra đơn")}</th></tr></thead>
              <tbody>
                {touchBuckets.filter(b => b.cared > 0).map((b, i) => {
                  const p = b.cared ? Math.round(b.conv / b.cared * 1000) / 10 : 0;
                  return <tr key={i} className="border-t border-gray-100"><td className="p-2 font-medium">{b.k} {t("lần")}</td><td className="p-2 text-right">{b.cared}</td><td className="p-2 text-right">{b.conv}</td><td className={`p-2 text-right font-semibold ${p >= 20 ? "text-emerald-600" : "text-amber-600"}`}>{p}%</td></tr>;
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">{t("Đếm tích luỹ số lần chạm/SĐT (từ khi bật tính năng). 'Có đơn' = SĐT có đơn trong sổ bất kỳ. Dữ liệu dày dần theo thời gian.")}</p>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 space-y-1">
        <div className="font-semibold text-amber-900">{t("Cách đọc đúng")}</div>
        <div>{t("• Đây là TƯƠNG QUAN, không phải nhân quả — khách có thể ra đơn vì lý do khác, không hẳn do được chăm.")}</div>
        <div>{t("• Chỉ đo khách có bấm ghi nhận chăm + có SĐT khớp sổ đơn. Khách chăm \"chui\" không vào số.")}</div>
        <div>{t("• customer_care_log ghi đè theo SĐT → chỉ tính từ LẦN CHĂM GẦN NHẤT, chưa đếm được số lần chạm (sẽ làm ở bước sau).")}</div>
        <div>{t("• \"Chốt tự khai\" gộp toàn bộ ngày còn lưu trong call_log (~60 ngày), không khớp tuyệt đối khung thời gian với cột đơn thật — chỉ để soi khai ảo.")}</div>
      </div>
    </div>
  );
}

function FlowCard({ title, a, pct, med, W, t }: { title: string; a: Agg; pct: number; med: number | null; W: number; t: (s: string) => string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="text-sm font-semibold mb-2">{title}</div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <span>{t("Đã chăm")}: <b>{a.cared}</b></span>
        <span>{t("Ra đơn")}: <b className="text-emerald-600">{a.conv}</b></span>
        <span>{t("Tỉ lệ")}: <b className={pct >= 20 ? "text-emerald-600" : "text-amber-600"}>{pct}%</b></span>
        <span>{t("Trung vị")}: <b>{med != null ? `${med} ${t("ngày")}` : "—"}</b></span>
      </div>
      <div className="text-[11px] text-gray-400 mt-1">{t("trong")} {W} {t("ngày sau chăm")} · {fmtVND(a.rev)}</div>
    </div>
  );
}
