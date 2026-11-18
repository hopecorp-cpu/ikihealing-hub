import { getT } from "@/lib/i18n-server";

import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { layDoanhThu, gopTenSale } from "@/lib/doanh-thu";
import { isManagerOrAbove } from "@/lib/auth";
import { fmtVND, vnDateStr } from "@/lib/payroll";
import { computePnl, type MonthPnl } from "@/lib/covan/pnl";
import { loadLiveCampaign } from "@/lib/covan/state";
import { getConfigValue } from "@/lib/app-config";
import { layTienMat, type TienMat } from "@/lib/covan/tien-mat";
import { Stat } from "@/components/stat";
import {
  Gauge, Banknote, Wallet, Megaphone, UserPlus, Brain,
  BarChart3, Target, Activity, ListTodo, Rocket, PhoneCall, History,
} from "lucide-react";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Trung tâm chỉ huy | ACME Ops Hub") };
}

const SALE_TARGET = 150e6;

type DayCost = { vnd: number; calls: number };

function sumCost(map: Record<string, DayCost>, from: string, to: string): number {
  let vnd = 0;
  for (const [day, c] of Object.entries(map)) {
    if (day >= from && day <= to) vnd += c?.vnd || 0;
  }
  return vnd;
}

export default async function TrungTamChiHuyPage() {
  const { t: tDich } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(user.role === "admin" || user.role === "ceo" || isManagerOrAbove(user.role))) redirect("/");

  const sb = getServiceClient();
  const today = vnDateStr();
  const month = today.slice(0, 7);

  let pnl6: MonthPnl[] = [];
  let revMonth: number | null = null;
  try {
    const p = await computePnl();
    pnl6 = p.pnl.slice(-6);
    revMonth = p.pnl.find((r) => r.month === month)?.revenue ?? null;
  } catch { }

  let tienMat: TienMat | null = null;
  try { tienMat = await layTienMat(); } catch { }
  const cash = tienMat?.tong ?? null;
  const cashHint = tienMat && cash != null
    ? `tính đến ${tienMat.asOfCuNhat || "?"} · ${tienMat.taiKhoan.map((t) => `${t.nganHang} ${t.taiKhoan} ${t.cuQua7Ngay ? `cũ ${t.soNgayCu ?? "?"} ngày` : "mới"}`).join(" · ")}`
    : (tienMat?.ghiChu[0] || "chưa bóc được sao kê ngân hàng");

  let adsMonth: number | null = null;
  try {
    const raw = await getConfigValue(`mkt_spend_${month}`);
    if (raw != null && raw !== "") {
      const n = Number(raw);
      if (Number.isFinite(n)) adsMonth = n;
    }
  } catch { }

  let leadsMonth: number | null = null;
  try {
    const { count, error } = await sb
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("created_at", `${month}-01`);
    if (!error) leadsMonth = count || 0;
  } catch { }

  let aiCostMonth: number | null = null;
  let aiCost7d: number | null = null;
  try {
    const raw = await getConfigValue("covan_api_cost");
    const map = raw ? (JSON.parse(raw) as Record<string, DayCost>) : {};
    if (map && typeof map === "object") {
      aiCostMonth = sumCost(map, `${month}-01`, today);
      const from7 = vnDateStr(new Date(Date.now() - 6 * 86400e3));
      aiCost7d = sumCost(map, from7, today);
    }
  } catch { }

  let saleRows: { name: string; net: number; pct: number }[] | null = null;
  try {
    const byName: Record<string, number> = {};

    const { data: nsu } = await sb.from("users").select("full_name");
    const gopTen = gopTenSale((nsu || []).map((u: any) => ({ ten: u.full_name })));
    const { rows: dtRows } = await layDoanhThu(sb, `${month}-01`, today);
    for (const r of dtRows) {
      const name = (gopTen(r.sale_name) || r.sale_name || "").trim() || "(chưa gán)";
      byName[name] = (byName[name] || 0) + (Number(r.net_amount) || 0);
    }
    saleRows = Object.entries(byName)
      .map(([name, net]) => ({ name, net: Math.round(net), pct: Math.round((net / SALE_TARGET) * 100) }))
      .sort((a, b) => b.net - a.net);
  } catch { }

  let evalLast: { at: string; diem: number; tong: number } | null = null;
  try {
    const raw = await getConfigValue("covan_eval_history");
    const rows = raw ? (JSON.parse(raw) as { at: string; diem: number; tong: number }[]) : [];
    if (Array.isArray(rows) && rows.length) {
      const r = rows[rows.length - 1];
      if (r && Number.isFinite(Number(r.diem))) evalLast = { at: r.at || "?", diem: Number(r.diem), tong: Number(r.tong) || 20 };
    }
  } catch { }

  let recsApproved: number | null = null;
  try {
    const raw = await getConfigValue("covan_recs");
    const recs = raw ? (JSON.parse(raw) as { status?: string }[]) : [];
    if (Array.isArray(recs)) recsApproved = recs.filter((r) => r?.status === "approved").length;
  } catch { }

  let aiTasks: { title: string; assignee: string; status: string; due: string | null }[] | null = null;
  try {
    const { data, error } = await sb
      .from("tasks")
      .select("title,status,due_date,assignee_id")
      .contains("tags", ["ai-covan"])
      .order("created_at", { ascending: false })
      .limit(3);
    if (error) throw new Error(error.message);
    const ids = [...new Set((data || []).map((t) => t.assignee_id).filter(Boolean))];
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: us } = await sb.from("users").select("id,full_name").in("id", ids);
      for (const u of us || []) names.set(u.id, u.full_name);
    }
    aiTasks = (data || []).map((t) => ({
      title: t.title as string,
      assignee: names.get(t.assignee_id as string) || "?",
      status: (t.status as string) || "?",
      due: (t.due_date as string) || null,
    }));
  } catch { }

  let liveCamp: { goal: string; pctDone: number; done: number; total: number } | null | undefined;
  try {
    const c = await loadLiveCampaign();
    if (c) {
      const total = c.items.length;
      const done = c.items.filter((i) => i.status === "xong" || i.status === "loi").length;
      liveCamp = { goal: c.goal, done, total, pctDone: total ? Math.round((done / total) * 100) : 0 };
    } else {
      liveCamp = null;
    }
  } catch { liveCamp = undefined; }

  let reorder: { total: number; called: number } | null = null;
  try {
    const from7d = new Date(Date.now() - 7 * 86400e3).toISOString();
    const { data, error } = await sb
      .from("tasks")
      .select("id,completed_at")
      .contains("tags", ["chu-ky-dat-lai"])
      .gte("created_at", from7d);
    if (error) throw new Error(error.message);
    const rows = data || [];
    reorder = { total: rows.length, called: rows.filter((r) => r.completed_at != null).length };
  } catch { }

  let evalHistory: { at: string; diem: number; tong: number }[] | null = null;
  try {
    const raw = await getConfigValue("covan_eval_history");
    const rows = raw ? (JSON.parse(raw) as { at: string; diem: number; tong: number }[]) : [];
    if (Array.isArray(rows)) {
      evalHistory = rows
        .filter((r) => r && Number.isFinite(Number(r.diem)) && Number(r.tong) > 0)
        .slice(-12)
        .map((r) => ({ at: r.at || "?", diem: Number(r.diem), tong: Number(r.tong) }));
    }
  } catch { }

  const maxRev = Math.max(1, ...pnl6.map((r) => r.revenue));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gauge className="w-6 h-6 text-brand-600" /> {tDich("Trung tâm chỉ huy —")} {month}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {tDich("Một màn hình cho CEO: tiền, khách, sale và sức khỏe AI. Số liệu đọc thẳng từ nguồn, khối nào thiếu sẽ báo rõ.")}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Stat label={tDich("DOANH THU THÁNG NÀY")} icon={Banknote} color="#10B981" sensitive
          value={revMonth != null ? fmtVND(revMonth) : tDich("chưa có dữ liệu")}
          hint={tDich("MISA (đã trừ VAT) — computePnl")} />
        <Stat label={tienMat?.cuQua7Ngay ? tDich("TIỀN MẶT (SỐ CŨ)") : tDich("TIỀN MẶT")} icon={Wallet}
          color={tienMat?.cuQua7Ngay ? "#EF4444" : "#1a73e8"} sensitive
          value={cash != null ? fmtVND(cash) : tDich("chưa có dữ liệu")}
          hint={cashHint} />
        <Stat label={tDich("CHI ADS THÁNG")} icon={Megaphone} color="#EF4444" sensitive
          value={adsMonth != null ? fmtVND(adsMonth) : tDich("chưa có dữ liệu")}
          hint={adsMonth != null ? tDich("config mkt_spend — đang ghi thiếu, xem caveat P&L") : `chưa ghi mkt_spend_${month}`} />
        <Stat label={tDich("LEAD THÁNG NÀY")} icon={UserPlus} color="#8B5CF6"
          value={leadsMonth != null ? leadsMonth.toLocaleString("vi-VN") : tDich("chưa có dữ liệu")}
          hint={tDich("bảng leads (pool chia lead)")} />
        <Stat label={tDich("CHI PHÍ AI THÁNG")} icon={Brain} color="#F59E0B" sensitive
          value={aiCostMonth != null ? fmtVND(aiCostMonth) : tDich("chưa có dữ liệu")}
          hint={tDich("sổ covan_api_cost (token thật)")} />
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
        <div className="p-3 border-b border-gray-100 font-semibold text-sm flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-brand-600" /> {tDich("Doanh thu 6 tháng gần nhất")}
        </div>
        {pnl6.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="text-left p-2.5">{tDich("Tháng")}</th>
                  <th className="text-right p-2.5">{tDich("Doanh thu")}</th>
                  <th className="text-left p-2.5 w-[38%]">{tDich("Tỷ lệ")}</th>
                  <th className="text-right p-2.5">{tDich("Lãi/lỗ vận hành")}</th>
                </tr>
              </thead>
              <tbody>
                {pnl6.map((r) => (
                  <tr key={r.month} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="p-2.5 font-medium text-gray-800">{r.month.slice(5, 7)}/{r.month.slice(0, 4)}</td>
                    <td className="p-2.5 text-right font-semibold sensitive">{fmtVND(r.revenue)}</td>
                    <td className="p-2.5">
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.max(2, Math.round((r.revenue / maxRev) * 100))}%` }} />
                      </div>
                    </td>
                    <td className={`p-2.5 text-right font-semibold sensitive ${r.net_operating >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {fmtVND(r.net_operating)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-gray-400 text-sm">{tDich("chưa có dữ liệu")}</div>
        )}
        <div className="px-3 py-2 text-[11px] text-gray-400 border-t border-gray-100">
          {tDich("Doanh thu MISA đã trừ VAT. Lãi/lỗ vận hành = doanh thu − giá vốn − lương − ship − lãi vay − ads − opex (ads/ship đang ghi thiếu — xem caveat ở /tai-chinh).")}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
          <div className="p-3 border-b border-gray-100 font-semibold text-sm flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-600" /> {tDich("Chỉ tiêu sale tháng này (100% =")} {fmtVND(SALE_TARGET)})
          </div>
          {saleRows == null ? (
            <div className="p-6 text-center text-gray-400 text-sm">{tDich("chưa có dữ liệu")}</div>
          ) : !saleRows.length ? (
            <div className="p-6 text-center text-gray-400 text-sm">{tDich("chưa có đơn MISA trong tháng")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="text-left p-2.5">Sale</th>
                    <th className="text-right p-2.5">{tDich("Doanh số")}</th>
                    <th className="text-left p-2.5 w-[30%]">{tDich("% chỉ tiêu")}</th>
                  </tr>
                </thead>
                <tbody>
                  {saleRows.map((s) => (
                    <tr key={s.name} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="p-2.5 font-medium text-gray-800 truncate max-w-[160px]">{s.name}</td>
                      <td className="p-2.5 text-right font-semibold sensitive">{fmtVND(s.net)}</td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${s.pct >= 100 ? "bg-emerald-500" : s.pct >= 60 ? "bg-amber-400" : "bg-red-400"}`}
                              style={{ width: `${Math.min(100, Math.max(2, s.pct))}%` }} />
                          </div>
                          <span className={`text-xs font-semibold w-11 text-right ${s.pct >= 100 ? "text-emerald-600" : s.pct >= 60 ? "text-amber-600" : "text-red-600"}`}>{s.pct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="px-3 py-2 text-[11px] text-gray-400 border-t border-gray-100">
            {tDich("Doanh số = tiền thu thực về theo MISA (net, đã trừ VAT), gộp theo tên sale trên đơn — chưa tính gán lại đơn ở /gan-don.")}
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
          <div className="p-3 border-b border-gray-100 font-semibold text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-600" /> {tDich("Sức khỏe AI agent (Trợ lý AI)")}
          </div>
          <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
            <div className="p-3 text-center">
              <div className="text-[10px] text-gray-500 uppercase font-semibold">{tDich("Eval gần nhất")}</div>
              <div className={`text-lg font-bold ${evalLast && evalLast.diem / evalLast.tong >= 0.8 ? "text-emerald-600" : evalLast ? "text-amber-600" : "text-gray-400"}`}>
                {evalLast ? `${evalLast.diem}/${evalLast.tong}` : "—"}
              </div>
              <div className="text-[10px] text-gray-400">{evalLast ? evalLast.at.slice(0, 10) : tDich("chưa có dữ liệu")}</div>
            </div>
            <div className="p-3 text-center">
              <div className="text-[10px] text-gray-500 uppercase font-semibold">{tDich("Chi phí AI 7 ngày")}</div>
              <div className="text-lg font-bold text-gray-800 sensitive">{aiCost7d != null ? fmtVND(aiCost7d) : "—"}</div>
              <div className="text-[10px] text-gray-400">{aiCost7d != null ? tDich("token thật, quy đổi VND") : tDich("chưa có dữ liệu")}</div>
            </div>
            <div className="p-3 text-center">
              <div className="text-[10px] text-gray-500 uppercase font-semibold">{tDich("Đề xuất đang đo")}</div>
              <div className="text-lg font-bold text-gray-800">{recsApproved != null ? recsApproved : "—"}</div>
              <div className="text-[10px] text-gray-400">{recsApproved != null ? "status approved" : tDich("chưa có dữ liệu")}</div>
            </div>
          </div>
          <div className="p-3">
            <div className="text-xs font-semibold text-gray-600 flex items-center gap-1.5 mb-2">
              <ListTodo className="w-3.5 h-3.5" /> {tDich("3 việc gần nhất cố vấn đã giao")}
            </div>
            {aiTasks == null ? (
              <div className="text-sm text-gray-400 text-center py-3">{tDich("chưa có dữ liệu")}</div>
            ) : !aiTasks.length ? (
              <div className="text-sm text-gray-400 text-center py-3">{tDich("cố vấn chưa giao việc nào")}</div>
            ) : (
              <ul className="space-y-2">
                {aiTasks.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${t.status === "done" ? "bg-emerald-500" : t.status === "in_progress" ? "bg-amber-400" : "bg-gray-300"}`} />
                    <div className="min-w-0">
                      <div className="text-gray-800 truncate">{tDich(t.title)}</div>
                      <div className="text-[11px] text-gray-400">
                        {t.assignee} · {t.status}{t.due ? ` · hạn ${t.due.slice(8, 10)}/${t.due.slice(5, 7)}` : ""}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
          <div className="p-3 border-b border-gray-100 font-semibold text-sm flex items-center gap-2">
            <Rocket className="w-4 h-4 text-orange-600" /> {tDich("Chiến dịch đang chạy")}
          </div>
          {liveCamp === undefined ? (
            <div className="p-6 text-center text-gray-400 text-sm">{tDich("chưa có dữ liệu")}</div>
          ) : liveCamp === null ? (
            <div className="p-6 text-center text-gray-400 text-sm">{tDich("Chưa có chiến dịch")}</div>
          ) : (
            <div className="p-3 space-y-3">
              <div className="text-sm text-gray-800 font-medium line-clamp-2">{tDich(liveCamp.goal)}</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-orange-500"
                    style={{ width: `${Math.min(100, Math.max(2, liveCamp.pctDone))}%` }} />
                </div>
                <span className="text-xs font-semibold text-orange-600 w-11 text-right">{liveCamp.pctDone}%</span>
              </div>
              <div className="text-[11px] text-gray-400">
                {tDich("Máy đã chạy")} {liveCamp.done}/{liveCamp.total} {tDich("đầu việc (xong + lỗi)")}
              </div>
              <a href="/chien-dich-live" className="inline-block text-xs font-semibold text-brand-600 hover:underline">
                {tDich("Xem sơ đồ sống →")}
              </a>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
          <div className="p-3 border-b border-gray-100 font-semibold text-sm flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-emerald-600" /> {tDich("Máy nhắc đặt lại (7 ngày)")}
          </div>
          {reorder == null ? (
            <div className="p-6 text-center text-gray-400 text-sm">{tDich("chưa có dữ liệu")}</div>
          ) : (
            <div className="p-3 space-y-2">
              <div className="text-lg font-bold text-gray-800">
                {reorder.total.toLocaleString("vi-VN")} {tDich("danh sách giao /")} {reorder.called.toLocaleString("vi-VN")} {tDich("đã gọi xong")}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${reorder.total ? Math.min(100, Math.max(2, Math.round((reorder.called / reorder.total) * 100))) : 0}%` }} />
                </div>
                <span className="text-xs font-semibold text-emerald-600 w-11 text-right">
                  {reorder.total ? Math.round((reorder.called / reorder.total) * 100) : 0}%
                </span>
              </div>
              <div className="text-[11px] text-gray-400">
                {tDich("Việc bảng tasks có tag chu-ky-dat-lai, tạo trong 7 ngày — đã gọi = có completed_at")}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
          <div className="p-3 border-b border-gray-100 font-semibold text-sm flex items-center gap-2">
            <History className="w-4 h-4 text-purple-600" /> {tDich("Lịch sử điểm sức khỏe AI")}
          </div>
          {evalHistory == null ? (
            <div className="p-6 text-center text-gray-400 text-sm">{tDich("chưa có dữ liệu")}</div>
          ) : !evalHistory.length ? (
            <div className="p-6 text-center text-gray-400 text-sm">{tDich("chưa chấm lần nào")}</div>
          ) : (
            <div className="p-3">
              <div className="flex items-end justify-center gap-2 h-28">
                {evalHistory.map((h, i) => {
                  const pct = Math.round((h.diem / h.tong) * 100);
                  return (
                    <div key={i} className="flex flex-col items-center justify-end gap-1 h-full w-8">
                      <div className="w-full flex-1 flex items-end">
                        <div className={`w-full rounded-t ${pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-400" : "bg-red-400"}`}
                          style={{ height: `${Math.max(4, pct)}%` }} />
                      </div>
                      <span className="text-[10px] font-semibold text-gray-600">{h.diem}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 text-[11px] text-gray-400 text-center">
                {evalHistory.length} {tDich("lần chấm gần nhất — thang /")}{evalHistory[evalHistory.length - 1].tong}, cron CN 21:00
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
