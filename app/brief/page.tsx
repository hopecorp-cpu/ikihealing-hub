import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { layDoanhThu } from "@/lib/doanh-thu";
import { isManagerOrAbove, isSalePosition } from "@/lib/auth";
import { fmtVND, vnDateStr } from "@/lib/payroll";
import { getConfigValue } from "@/lib/app-config";
import { CONFIG_KEY_ANNUAL_TARGET, DEFAULT_ANNUAL_TARGET_2026, buildMonthlyTargets2026 } from "@/lib/bi-targets";
import stockData from "@/data/warehouse-stock.json";
import Copilot from "./Copilot";
import SaleBrief from "./SaleBrief";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Bản tin sáng | IKIHEALING Hub") };
}

export default async function BriefPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!isManagerOrAbove(user.role)) {
    if (isSalePosition((user as any).position)) return <SaleBrief user={user} />;
    redirect("/?denied=brief");
  }
  const sb = getServiceClient();
  const { t } = getT();

  const today = vnDateStr();
  const month = today.slice(0, 7);
  const dim = new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate();
  const dElapsed = +today.slice(8, 10);
  const expectedPct = Math.round(dElapsed / dim * 100);
  const yest = new Date(new Date(today).getTime() - 864e5).toISOString().slice(0, 10);

  const li: any[] = (await layDoanhThu(sb, `${month}-01`, `${month}-${String(dim).padStart(2, "0")}`)).rows;
  const rev = li.reduce((s, r) => s + (r.net_amount || 0), 0);
  const ordIds = new Set(li.map(r => r.order_code));
  const yRev = li.filter(r => r.order_date === yest).reduce((s, r) => s + (r.net_amount || 0), 0);
  const yOrd = new Set(li.filter(r => r.order_date === yest).map(r => r.order_code)).size;
  const annual = Number(await getConfigValue(CONFIG_KEY_ANNUAL_TARGET)) || DEFAULT_ANNUAL_TARGET_2026;
  const { rows: tRows } = buildMonthlyTargets2026(annual, { [month]: rev }, month);
  const target = tRows.find(r => r.month === month)?.target || 0;
  const pct = target ? Math.round(rev / target * 100) : 0;

  const now = new Date(today).getTime();
  let needCare = 0;
  try { needCare = JSON.parse((await getConfigValue("care_summary")) || "{}").needCare || 0; } catch { }

  let unreplied: any = { bySale: [], total: 0 };
  try { unreplied = JSON.parse((await getConfigValue("sale_unreplied")) || "{}"); unreplied.bySale ||= []; } catch { }

  let inbox: any = null;
  try { inbox = JSON.parse((await getConfigValue("inbox_latest")) || "null"); } catch { }

  let fbInbox: any = null;
  try { fbInbox = JSON.parse((await getConfigValue("fb_inbox_latest")) || "null"); } catch { }
  const fbActivePages = fbInbox ? (fbInbox.pages || []).filter((p: any) => (p.new30 || 0) > 0 || (p.active30 || 0) > 0).sort((a: any, b: any) => (b.new30 || 0) - (a.new30 || 0)) : [];

  const { data: careRows } = await sb.from("customer_care_log").select("sale_name").eq("last_contact", today);
  const careBySale: Record<string, number> = {};
  for (const r of careRows ?? []) { const s = r.sale_name || "—"; careBySale[s] = (careBySale[s] || 0) + 1; }
  const careToday = (careRows ?? []).length;
  const careList = Object.entries(careBySale).sort((a, b) => b[1] - a[1]);

  const callN = (v: any) => typeof v === "number" ? v : (v?.n || 0);
  const callChot = (v: any) => typeof v === "number" ? 0 : (v?.chot || 0);
  let callRaw: Record<string, any> = {};
  try { const cl = JSON.parse((await getConfigValue("call_log")) || "{}"); callRaw = cl[today] || {}; } catch { }
  const callsToday = Object.values(callRaw).reduce((a: number, b: any) => a + callN(b), 0);
  const chotToday = Object.values(callRaw).reduce((a: number, b: any) => a + callChot(b), 0);
  const callsBySale = Object.fromEntries(Object.entries(callRaw).map(([k, v]) => [k, callN(v)]));
  const callList = Object.entries(callRaw).sort((a, b) => callN(b[1]) - callN(a[1]));

  const stock = (stockData as any).items as any[];
  const lowStock = stock.filter(s => s.closing > 0 && s.closing <= 10).length;
  const outStock = stock.filter(s => s.closing <= 0).length;
  const daysSince = (d: any) => d ? Math.floor((now - new Date(d).getTime()) / 864e5) : 999;
  const [{ count: jtReturns }, { data: misaLatest }, { data: jtFresh }, { data: chatLatest }] = await Promise.all([
    sb.from("jt_waybills").select("*", { count: "exact", head: true }).eq("status_group", "returned").gte("order_create_time", `${month}-01 00:00:00`),
    sb.from("tg_orders").select("ngay").order("ngay", { ascending: false }).limit(1).maybeSingle(),
    sb.from("jt_summary").select("updated_at").eq("id", 1).maybeSingle(),
    sb.from("salework_chat_analysis").select("analyzed_at").order("analyzed_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const misaDays = daysSince(misaLatest?.ngay), jtDays = daysSince(jtFresh?.updated_at), chatDays = daysSince(chatLatest?.analyzed_at);

  const todos: { t: string; who: string; tone: string }[] = [];
  if (pct < expectedPct - 5) todos.push({ t: `${t("Doanh số mới")} ${pct}% KPI ${t("dù đã qua")} ${expectedPct}% ${t("tháng — đẩy chốt đơn + khuyến mãi/tái mua.")}`, who: "Sale", tone: "red" });
  if (needCare > 0) todos.push({ t: `${needCare} ${t("khách mua cách đây 45–90 ngày → gọi nhắc tái mua (vào /cham-soc-kh).")}`, who: t("CSKH/Sale"), tone: "amber" });
  if (outStock > 0) todos.push({ t: `${outStock} ${t("mã HẾT HÀNG +")} ${lowStock} ${t("mã sắp hết → đặt nhập bổ sung (vào /kho).")}`, who: t("Kho/Mua hàng"), tone: outStock > 0 ? "red" : "amber" });
  if ((jtReturns || 0) > 0) todos.push({ t: `${jtReturns} ${t("đơn J&T hoàn về tháng này → kiểm tra + nhập lại kho (vào /doi-soat-jt).")}`, who: t("Kho"), tone: "amber" });
  if (misaDays > 2) todos.push({ t: `${t("Sổ đơn Telegram chưa bóc")} ${misaDays} ${t("ngày → kiểm cron tg-boc-don / bot còn trong nhóm Đơn Hàng không.")}`, who: t("IT"), tone: "red" });
  if (jtDays > 2) todos.push({ t: `${t("J&T chưa đồng bộ")} ${jtDays} ${t("ngày.")}`, who: "IT", tone: "red" });
  if (chatDays > 3) todos.push({ t: `${t("Chấm chất lượng chat chưa chạy")} ${chatDays} ${t("ngày.")}`, who: "IT", tone: "amber" });
  if (unreplied.total > 0) todos.push({ t: `${unreplied.total} ${t("KHÁCH đang chờ sale trả lời (Zalo) — vào trả lời/gọi NGAY kẻo mất đơn.")}`, who: "Sale", tone: "red" });
  if (!todos.length) todos.push({ t: t("Mọi chỉ số trong ngưỡng tốt — giữ nhịp "), who: "—", tone: "emerald" });

  const digest = { ngay: today, doanhSoThang: rev, kpiThang: target, datKPIpct: pct, daQuaThangPct: expectedPct, homQua: { doanhSo: yRev, soDon: yOrd }, soDonThang: ordIds.size, khachCanCham: needCare, khachChoTraLoi: unreplied.total, choTraLoiTheoSale: unreplied.bySale, dataDoVe: inbox, dataDoVeFB: fbInbox?.totals || null, luotChamSocHomNay: careToday, chamSocTheoSale: careBySale, goiTelesalesHomNay: callsToday, goiTheoSale: callsBySale, tonSapHet: lowStock, tonHetHang: outStock, donHoanJT: jtReturns || 0, syncNgay: { misa: misaDays, jt: jtDays, chat: chatDays }, vieccanlam: todos.map(t => t.t) };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">{t("Bản tin sáng")} — {today}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("1 màn hình: hôm qua thế nào, đang ở đâu, hôm nay làm gì. Đã qua")} {expectedPct}% {t("tháng.")}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label={t("DT hôm qua")} value={fmtVND(yRev)} color="#10B981" hint={`${yOrd} ${t("đơn")}`} />
        <Stat label={t("DT tháng")} value={fmtVND(rev)} color="#6366F1" hint={`${ordIds.size} ${t("đơn")}`} />
        <Stat label={t("% KPI tháng")} value={pct + "%"} color={pct >= expectedPct ? "#10B981" : "#EF4444"} hint={`${t("nhịp")} ${expectedPct}%`} />
        <Stat label={t("Khách cần chăm")} value={String(needCare)} color="#F59E0B" hint={t("mua 45–90 ngày trước")} />
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
        <div className="font-bold mb-3">{t("Hôm nay cần làm")}</div>
        <div className="space-y-2">
          {todos.map((t, i) => (
            <div key={i} className={`flex items-start gap-2 text-sm p-2 rounded-lg ${t.tone === "red" ? "bg-red-50" : t.tone === "amber" ? "bg-amber-50" : "bg-emerald-50"}`}>
              <span>{t.tone === "red" ? "" : t.tone === "amber" ? "" : ""}</span>
              <div><span className="text-gray-800">{t.t}</span> {t.who !== "—" && <span className="text-xs text-gray-400">— {t.who}</span>}</div>
            </div>
          ))}
        </div>
      </div>

      {inbox && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
          <div className="font-bold mb-1">{t("Data đổ về (Zalo)")}</div>
          <p className="text-xs text-gray-500 mb-3">{t("Hội thoại active + tỷ lệ lấy SĐT. \"Mới/ngày\" = chênh lệch so hôm trước (Salework không có ngày tạo hội thoại).")}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label={t("Hội thoại 7 ngày")} value={String(inbox.active7 ?? "—")} color="#0EA5E9" hint={`${t("30 ngày:")} ${inbox.active30 ?? "—"}`} />
            <Stat label={t("Tổng liên hệ")} value={(inbox.contactsTotal ?? 0).toLocaleString("vi")} color="#6366F1" hint={`${t("có SĐT")} ${inbox.contactsTotal ? Math.round(inbox.contactsWithPhone / inbox.contactsTotal * 100) : 0}%`} />
            <Stat label={t("Khách mới hôm nay")} value={inbox.newContacts != null ? "+" + inbox.newContacts : t("chờ mai")} color="#10B981" hint={inbox.newPhones != null ? `${t("SĐT mới")} +${inbox.newPhones}` : ""} />
            <Stat label={t("Tỷ lệ lấy SĐT (khách mới)")} value={inbox.newPhoneRate != null ? inbox.newPhoneRate + "%" : t("chờ mai")} color={inbox.newPhoneRate != null && inbox.newPhoneRate < 30 ? "#EF4444" : "#10B981"} hint={t("mục tiêu ≥30%")} />
          </div>
        </div>
      )}

      {fbInbox && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
          <div className="font-bold mb-1">{t("Data đổ về (Facebook)")}</div>
          <p className="text-xs text-gray-500 mb-3">{t("Khách MỚI nhắn fanpage (Pancake). FB hầu như không có SĐT trong chat — SĐT lấy ở bước lên đơn.")}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label={t("Khách mới hôm nay")} value={String(fbInbox.totals?.newToday ?? "—")} color="#10B981" hint={`${t("7 ngày:")} ${fbInbox.totals?.new7 ?? "—"}`} />
            <Stat label={t("Khách mới 30 ngày")} value={String(fbInbox.totals?.new30 ?? "—")} color="#1877F2" hint={`~${Math.round((fbInbox.totals?.new30 || 0) / 30 * 10) / 10}${t("/ngày")}`} />
            <Stat label={t("Hội thoại active 30d")} value={String(fbInbox.totals?.active30 ?? "—")} color="#6366F1" />
            <Stat label={t("Tỷ lệ có SĐT")} value={(fbInbox.totals?.phoneRate ?? 0) + "%"} color="#9CA3AF" hint={t("FB ít SĐT trong chat")} />
          </div>
          {fbActivePages.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {fbActivePages.map((p: any, i: number) => (
                <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg">{p.name}: <b>{p.new30}</b> {t("mới/30d")}</span>
              ))}
            </div>
          )}
          <p className="text-[11px] text-gray-400 mt-2">{t("Chỉ")} <b>{fbActivePages.length}</b> {t("fanpage có inbox. Fanpage chính (Đạm Mẫu) chưa có inbox FB qua Pancake; page \"NOVA\" gói Pancake hết hạn — cần rà lại kết nối/gói.")}</p>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
        <div className="font-bold mb-1">{t("Chăm sóc khách hôm nay")} <span className="font-normal text-gray-400">({careToday} {t("lượt")})</span></div>
        <p className="text-xs text-gray-500 mb-2">{t("Số khách mỗi sale đã chăm (bấm \"Đã gửi\" ở Chăm sóc khách). 0 lượt = chưa làm.")}</p>
        <div className="flex flex-wrap gap-2">
          {careList.length ? careList.map(([s, n], i) => (
            <span key={i} className={`text-sm px-2.5 py-1 rounded-full ${n >= 10 ? "bg-emerald-100 text-emerald-700" : n > 0 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>{s}: <b>{n}</b></span>
          )) : <span className="text-sm text-red-600">{t("Chưa sale nào chăm khách hôm nay")}</span>}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="font-bold mb-1">{t("Cuộc gọi telesales hôm nay")} <span className="font-normal text-gray-400">({callsToday} {t("cuộc")} · {chotToday} {t("chốt")})</span></div>
          <p className="text-xs text-gray-500 mb-2">{t("Tệp nóng phải GỌI (chuyển đổi cao hơn nhắn). Bấm \"Đã gọi\" ở Chăm sóc khách để ghi nhận.")}</p>
          <div className="flex flex-wrap gap-2">
            {callList.length ? callList.map(([s, v], i) => (
              <span key={i} className={`text-sm px-2.5 py-1 rounded-full ${callN(v) >= 5 ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>{s}: <b>{callN(v)}</b> {t("gọi")}{callChot(v) > 0 ? ` · ${callChot(v)} ${t("chốt")}` : ""}</span>
            )) : <span className="text-sm text-red-600">{t("Hôm nay chưa sale nào GỌI khách — đang chỉ nhắn tin!")}</span>}
          </div>
        </div>
      </div>

      {unreplied.bySale.length > 0 && (
        <div className="bg-white border border-red-200 rounded-xl p-5">
          <div className="font-bold mb-1 text-red-700">{t("Khách đang chờ sale trả lời")} ({unreplied.total})</div>
          <p className="text-xs text-gray-500 mb-3">{t("Khách đã nhắn mà sale CHƯA trả lời. Để lâu = mất đơn. Vào Zalo trả lời/gọi ngay.")}</p>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase"><tr><th className="text-left p-2">Sale</th><th className="text-right p-2">{t("Khách chờ")}</th><th className="text-right p-2">{t("Chờ lâu nhất")}</th></tr></thead>
            <tbody>
              {unreplied.bySale.sort((a: any, b: any) => b.count - a.count).map((s: any, i: number) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="p-2 font-medium">{s.sale}</td>
                  <td className="p-2 text-right font-bold text-red-600">{s.count}</td>
                  <td className="p-2 text-right text-xs text-gray-500">{s.oldestHours >= 24 ? Math.round(s.oldestHours / 24) + " " + t("ngày") : Math.round(s.oldestHours) + "h"} {s.oldestName && `(${s.oldestName})`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Copilot digest={digest} />
    </div>
  );
}

function Stat({ label, value, color, hint }: { label: string; value: string; color: string; hint?: string }) {
  return <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-3"><div className="text-xs text-gray-500">{label}</div><div className="text-lg font-bold" style={{ color }}>{value}</div>{hint && <div className="text-[11px] text-gray-400">{hint}</div>}</div>;
}
