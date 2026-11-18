"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useTransition } from "react";
import type { RevenueLoopData, Light } from "@/lib/revenue-loop";
import { saveLoopAssumptions, saveLeads } from "./actions";
import { TrendingUp, Users, Target, Megaphone, Filter, ArrowDown, ExternalLink, Info, Wallet, Sparkles, Gift } from "lucide-react";

const MKT_ADS_URL = "https://mkt-studio.example.com/ads";

const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n || 0));
const tr = (n: number) => (Math.round((n || 0) / 1e5) / 10).toLocaleString("vi-VN") + "tr";
const int = (n: number) => Math.round(n || 0).toLocaleString("vi-VN");
const DOT: Record<Light, string> = { green: "bg-emerald-500", yellow: "bg-amber-400", red: "bg-red-500" };
const BAR: Record<Light, string> = { green: "bg-emerald-500", yellow: "bg-amber-400", red: "bg-red-500" };

function Sensitive({ children }: { children: React.ReactNode }) { return <span className="sensitive">{children}</span>; }

function StageCard({ n, icon, title, light, accent, children }: { n: number; icon: React.ReactNode; title: string; light?: Light; accent: string; children: React.ReactNode }) {
  return (
    <div className={`relative bg-white border rounded-2xl p-4 sm:p-5 ${accent}`}>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="w-6 h-6 rounded-full bg-gray-900 text-white text-[12px] font-bold flex items-center justify-center shrink-0">{n}</span>
        <span className="text-gray-500">{icon}</span>
        <span className="text-[13px] font-semibold text-gray-700">{title}</span>
        {light && <span className={`ml-auto inline-block w-2.5 h-2.5 rounded-full ${DOT[light]}`} />}
      </div>
      {children}
    </div>
  );
}
function Arrow() {
  return <div className="flex justify-center -my-1.5 relative z-10"><span className="w-7 h-7 rounded-full bg-white border border-gray-200 text-gray-400 flex items-center justify-center shadow-sm"><ArrowDown className="w-4 h-4" /></span></div>;
}

function LeadsEditor({ d }: { d: RevenueLoopData }) {
  const { t: t } = useLang();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const chans = d.channels.slice(0, 8).map(c => c.channel);
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(d.channels.slice(0, 8).map(c => [c.channel, c.leads != null ? String(c.leads) : ""])));
  if (!open) return <button onClick={() => setOpen(true)} className="mt-2 text-[11px] text-emerald-700 hover:underline">{t("Nhập lead theo kênh (tháng này)")}</button>;
  return (
    <div className="mt-2 border border-emerald-200 bg-emerald-50/40 rounded-xl p-3 space-y-2">
      <div className="text-[11px] text-gray-500">{t("Số lead đầu phễu tháng")} {`T${+d.month.slice(5)}`} {t("— để tính tỉ lệ chốt thật (đơn/lead). Có webhook rồi thì để tự chạy, đây chỉ dùng khi nhập tay/bù.")}</div>
      <div className="grid grid-cols-2 gap-2">
        {chans.map(ch => (
          <label key={ch} className="flex items-center gap-2 text-[12px]">
            <span className="flex-1 truncate text-gray-700">{ch}</span>
            <input value={vals[ch] || ""} onChange={e => setVals(v => ({ ...v, [ch]: e.target.value.replace(/[^\d]/g, "") }))} placeholder="0"
              className="w-16 px-2 py-1 rounded border border-gray-200 text-xs text-right" />
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={() => start(async () => { const by: Record<string, number> = {}; for (const [k, v] of Object.entries(vals)) { const n = Number(v) || 0; if (n > 0) by[k] = n; } const r = await saveLeads(d.month, by); if (r.ok) location.reload(); })}
          disabled={pending} className="text-[11px] px-3 py-1 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-60">{pending ? t("Đang lưu…") : t("Lưu lead")}</button>
        <button onClick={() => setOpen(false)} className="text-[11px] px-3 py-1 bg-gray-100 text-gray-600 rounded-lg">{t("Đóng")}</button>
      </div>
    </div>
  );
}

export function LoopClient({ data: d, canSeeAll, canEdit }: { data: RevenueLoopData; canSeeAll: boolean; canEdit: boolean }) {
  const { t: t } = useLang();
  const monthLabel = `T${+d.month.slice(5)}/${d.month.slice(0, 4)}`;
  const prevLabel = `T${+d.prevMonth.slice(5)}`;

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-10">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("Vòng lặp doanh thu —")} {monthLabel}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("Kế hoạch → đối chiếu thực tế → tự chỉnh: mục tiêu → KPI/AOV mỗi sale → khách & lead cần → ngân sách ads → %chi phí MKT → đo chuyển đổi → gợi ý bán.")}</p>
        </div>
        <a href="/ke-hoach-doanh-thu" className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 whitespace-nowrap">{t("Bảng phân rã & combo →")}</a>
      </div>

      <div className="space-y-0">
        <StageCard n={1} icon={<TrendingUp className="w-4 h-4" />} title={t("Mục tiêu doanh thu tháng")} light={d.finLight} accent="border-emerald-200">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <div className="text-2xl font-bold text-gray-900"><Sensitive>{tr(d.monthActual)}</Sensitive><span className="text-sm font-normal text-gray-400"> / <Sensitive>{tr(d.monthTarget)}</Sensitive> {t("mục tiêu")}</span></div>
              <div className="text-[12px] text-gray-600 mt-1">{t("Đạt")} <b>{d.pacePct}%</b> {t("· theo lịch phải")} <b>{d.expectedPct}%</b> <span className={d.finLight === "green" ? "text-emerald-600" : d.finLight === "yellow" ? "text-amber-600" : "text-red-600"}>{d.finLight === "green" ? t("→ đúng nhịp") : d.finLight === "yellow" ? t("→ chậm nhịp") : t("→ cần đẩy mạnh")}</span></div>
            </div>
            <div className="text-right text-[12px] text-gray-500">
              <div>{t("Dự báo cuối tháng:")} <b className={d.projectedPct >= 100 ? "text-emerald-600" : "text-amber-600"}>{d.projectedPct}%</b></div>
              <div>{t("Ngày")} {d.daysElapsed}/{d.totalDays} {t("· mục tiêu năm")} <Sensitive>{(d.annualTarget / 1e9).toLocaleString("vi-VN")}</Sensitive> {t("tỷ")}</div>
            </div>
          </div>
          <div className="mt-2.5 h-2 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${BAR[d.finLight]}`} style={{ width: `${Math.max(2, Math.min(100, d.pacePct))}%` }} /></div>
        </StageCard>
        <Arrow />

        <StageCard n={2} icon={<Target className="w-4 h-4" />} title={t("KPI mỗi sale · AOV · hiệu chỉnh theo thực tế")} accent="border-blue-200">
          <div className="grid grid-cols-3 gap-3 text-center">
            <Mini label={`${d.sales.length} sale`} value={canSeeAll ? <Sensitive>{tr(d.sales.reduce((s, x) => s + x.target, 0))}</Sensitive> : "KPI"} sub={t("tổng KPI tháng")} />
            <Mini label="AOV team" value={<Sensitive>{fmt(d.teamAov)}đ</Sensitive>} sub={`${int(d.totalOrders)} đơn · ${int(d.totalCustomers)} khách`} />
            <Mini label={t("Tỉ lệ chốt dùng")} value={`${d.closeRateRealTeam != null ? Math.round(d.closeRateRealTeam * 100) : Math.round(d.assumptions.closeRate * 100)}%`} sub={d.closeRateRealTeam != null ? t("đo thật (call_log)") : t("giả định")} />
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            <Badge ok={d.closeRateRealTeam != null}>{t("Chốt: kế hoạch")} {Math.round(d.assumptions.closeRate * 100)}% {d.closeRateRealTeam != null ? `→ thật ${Math.round(d.closeRateRealTeam * 100)}% (đã ốp)` : t("(chưa đủ dữ liệu gọi)")}</Badge>
            <Badge ok={d.opcReal != null}>{t("Đơn/khách: kế hoạch")} {d.assumptions.ordersPerCustomer} {d.opcReal != null ? `→ thật ${d.opcReal} (đã ốp)` : ""}</Badge>
          </div>
        </StageCard>
        <Arrow />

        <StageCard n={4} icon={<Users className="w-4 h-4" />} title={`Tháng trước (${prevLabel}) đạt gì`} accent="border-slate-200">
          <div className="grid grid-cols-3 gap-3 text-center">
            <Mini label={t("Doanh số")} value={<Sensitive>{tr(d.sales.reduce((s, x) => s + x.revLast, 0))}</Sensitive>} sub={prevLabel} />
            <Mini label={t("Khách")} value={int(d.sales.reduce((s, x) => s + x.custsLast, 0))} sub={t("đã mua")} />
            <Mini label={t("Đơn")} value={int(d.sales.reduce((s, x) => s + x.ordersLast, 0))} sub={t("tháng trước")} />
          </div>
          <p className="text-[11px] text-gray-400 mt-2">{t("Cơ sở đối chiếu: tháng này cần giữ nhịp khách/đơn ít nhất bằng tháng trước để không tụt.")}</p>
        </StageCard>
        <Arrow />

        <StageCard n={5} icon={<Filter className="w-4 h-4" />} title={t("Tháng này CÒN CẦN bao nhiêu (để về đích)")} accent="border-indigo-300 ring-1 ring-indigo-100">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <Mini label={t("Còn thiếu DT")} value={<Sensitive>{tr(d.needGap)}</Sensitive>} sub={t("so với KPI")} tone="indigo" />
            <Mini label={t("Đơn cần chốt")} value={`+${int(d.needOrders)}`} sub={t("đơn nữa")} tone="indigo" />
            <Mini label={t("Khách cần")} value={`+${int(d.needCustomers)}`} sub={t("khách mua")} tone="indigo" />
            <Mini label={t("LEAD cần")} value={`+${int(d.needLeads)}`} sub={`@chốt ${d.closeRateRealTeam != null ? Math.round(d.closeRateRealTeam * 100) : Math.round(d.assumptions.closeRate * 100)}%`} tone="indigo-strong" />
          </div>
          <p className="text-[11px] text-gray-500 mt-2 flex items-start gap-1"><Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-400" /><span>{t("Lead cần = đơn cần ÷ tỉ lệ chốt (ốp số thật khi có). MKT dựa số này để lên list.")}</span></p>
        </StageCard>
        <Arrow />

        <StageCard n={6} icon={<Megaphone className="w-4 h-4" />} title={t("Ngân sách ads để ra list")} accent="border-pink-200">
          {canSeeAll ? (
            <>
              <div className="flex items-end justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-2xl font-bold text-gray-900"><Sensitive>~{tr(d.budgetNeeded)}</Sensitive></div>
                  <div className="text-[12px] text-gray-600">{t("để thu")} <b>{int(d.needLeads)}</b> {t("lead (giữ lãi mục tiêu")} {Math.round(d.assumptions.desiredMargin * 100)}%)</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{t("Trần hoà vốn:")} <Sensitive>{tr(d.budgetBreakeven)}</Sensitive> {t("— vượt là lỗ")}</div>
                </div>
                <a href={MKT_ADS_URL} target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 inline-flex items-center gap-1.5 whitespace-nowrap"><Megaphone className="w-3.5 h-3.5" /> MKT Studio → Ads <ExternalLink className="w-3 h-3" /></a>
              </div>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[11px]">
                <CeilMini label={t("CPL trần")} value={<Sensitive>{fmt(d.ceil.cplCeiling)}đ</Sensitive>} />
                <CeilMini label={t("CPL hoà vốn")} value={<Sensitive>{fmt(d.ceil.cplBreakeven)}đ</Sensitive>} />
                <CeilMini label={t("CPO trần")} value={<Sensitive>{fmt(d.ceil.cpoCeiling)}đ</Sensitive>} />
                <CeilMini label={t("AOV net · biên")} value={<Sensitive>{fmt(d.aovNet)}{t("đ ·")} {Math.round(d.assumptions.grossMargin * 100)}%</Sensitive>} />
              </div>
            </>
          ) : <p className="text-[12px] text-gray-500">{t("Phần ngân sách ads dành cho quản lý. Bạn tập trung LEAD cần của mình ở ⑤ và bảng dưới.")}</p>}
        </StageCard>
        <Arrow />

        <StageCard n={7} icon={<Wallet className="w-4 h-4" />} title={t("Chi phí MKT / doanh thu (chống thất thoát)")} light={canSeeAll ? d.mktLight : undefined} accent="border-amber-200">
          {canSeeAll ? (
            d.mktSpend > 0 ? (
              <>
                <div className="flex items-end justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{d.mktPct != null ? `${d.mktPct}%` : "—"}<span className="text-sm font-normal text-gray-400"> {t("chi phí / doanh thu")}</span></div>
                    <div className="text-[12px] text-gray-600">{t("Đã chi")} <Sensitive>{tr(d.mktSpend)}</Sensitive> {t("· trần")} <b>{Math.round(d.assumptions.mktCostCapPct * 100)}%</b> (≈ <Sensitive>{tr(d.mktCapAmount)}</Sensitive>/tháng)</div>
                  </div>
                  <div className="text-right text-[12px]">
                    <div className={d.mktHeadroom >= 0 ? "text-emerald-600" : "text-red-600 font-semibold"}>{d.mktHeadroom >= 0 ? t("Còn được chi") : t("Đã vượt")} <Sensitive>{tr(Math.abs(d.mktHeadroom))}</Sensitive></div>
                  </div>
                </div>
                {d.mktLight === "red" && <div className="mt-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{t("Chi phí MKT vượt trần")} {Math.round(d.assumptions.mktCostCapPct * 100)}{t("% doanh thu — rà lại mã ads lỗ, cắt bớt để tránh thất thoát.")}</div>}
                {d.mktOverBudgetWarn && <div className="mt-2 text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">{t("Ngân sách ads kế hoạch (")}<Sensitive>{tr(d.budgetNeeded)}</Sensitive>{t(") cộng đã chi sẽ vượt trần %MKT — cân nhắc tăng chốt/AOV thay vì đổ thêm tiền.")}</div>}
              </>
            ) : <p className="text-[12px] text-gray-500">{t("Chưa nhập chi phí MKT tháng này.")} {canEdit ? t("Nhập ở form 'Giả định' dưới cùng để tính % (hoặc set FB_ADS_TOKEN để tự kéo).") : t("Nhờ admin nhập để theo dõi %.")}</p>
          ) : <p className="text-[12px] text-gray-500">{t("Chỉ quản lý xem chỉ số chi phí.")}</p>}
        </StageCard>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3"><span className="w-6 h-6 rounded-full bg-gray-900 text-white text-[12px] font-bold flex items-center justify-center">8</span><h2 className="text-[15px] font-bold text-gray-800">{t("Đo chuyển đổi — theo kênh · Zalo · cuộc gọi")}</h2></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-[12px] font-semibold text-gray-600 mb-1.5">{t("Doanh thu &amp; chuyển đổi theo kênh")} <span className="text-gray-400 font-normal">{t("(đơn từ MISA · lead từ Zalo/Pancake)")}</span></div>
            <div className="space-y-1.5">
              {d.channels.slice(0, 6).map(c => (
                <div key={c.channel} className="flex items-center gap-2 text-[12px]">
                  <span className="w-24 shrink-0 truncate text-gray-700">{c.channel}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-pink-400" style={{ width: `${Math.max(2, c.pctRev)}%` }} /></div>
                  <span className="w-28 text-right shrink-0 text-gray-500"><Sensitive>{tr(c.revenue)}</Sensitive> · {c.orders}{t("đơn")}</span>
                  <span className="w-20 text-right shrink-0">
                    {c.leads != null
                      ? <span className="text-emerald-600 font-semibold">{c.leads} lead · {c.convRate}%</span>
                      : <span className="text-gray-300">—</span>}
                  </span>
                </div>
              ))}
              {!d.channels.length && <div className="text-[12px] text-gray-400">{t("Chưa có dữ liệu kênh tháng này")}</div>}
            </div>
            {canEdit && <LeadsEditor d={d} />}
          </div>
          <div className="grid grid-cols-2 gap-3 content-start">
            <div className="border border-gray-200 rounded-xl p-3 text-center"><div className="text-[11px] text-gray-500">{t("Chất lượng Zalo")}</div><div className="text-xl font-bold mt-1">{d.chatAvg != null ? `${d.chatAvg}/10` : "—"}</div><a href="/chat-quality" className="text-[11px] text-blue-600 hover:underline">{t("AI chấm tư vấn →")}</a></div>
            <div className="border border-gray-200 rounded-xl p-3 text-center"><div className="text-[11px] text-gray-500">{t("Chốt cuộc gọi")}</div><div className="text-xl font-bold mt-1">{d.callCloseReal != null ? `${d.callCloseReal}%` : "—"}</div><div className="text-[10px] text-gray-400">{t("tự khai (call_log)")}</div></div>
            <div className="col-span-2 border border-gray-200 rounded-xl p-3"><div className="text-[12px] text-gray-600">{t("Chăm sóc → đơn: đo tỉ lệ chuyển đổi thật ở trang riêng.")}</div><a href="/hieu-qua-cham-soc" className="text-[12px] text-blue-600 hover:underline">{t("Hiệu quả chăm sóc →")}</a></div>
          </div>
        </div>
        {d.leadsTotal > 0 ? (
          <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2 mt-3">{t("Đã có")} <b>{d.leadsTotal} {t("lead thật")}</b> {t("đầu phễu (")}{d.leadsSource || t("webhook/nhập tay")}{t(") → tỉ lệ chốt theo kênh là")} <b>{t("số đo thật")}</b> {t("(đơn/lead). Kênh chưa có lead vẫn hiển thị \"—\". Nguồn: DT = MISA (1 nguồn), lead = Zalo/Pancake.")}</p>
        ) : (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-3">{t("Chưa \"bắt\" lead đầu phễu nên chuyển đổi theo kênh vẫn")} <b>{t("ước lượng")}</b>{t(". Bật đo THẬT: cắm webhook")} <code>/api/leads/ingest</code> {t("vào Zalo OA / Pancake / ZaloCRM, hoặc bấm \"Nhập lead theo kênh\" ở trên.")}</p>
        )}
      </div>

      {canSeeAll && <RecoBlock d={d} />}

      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 overflow-hidden">
        <h2 className="text-[15px] font-bold text-gray-800 mb-1">{t("Chi tiết từng sale —")} {monthLabel}</h2>
        <p className="text-xs text-gray-500 mb-3">{t("AOV riêng · tháng trước · còn cần (đơn/khách/lead) · tỉ lệ chốt dùng. Hàng đỏ = đang tụt nhịp.")}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase">
              <tr>
                <th className="text-left p-2">Sale</th><th className="text-right p-2">KPI</th><th className="text-right p-2">{t("Đã đạt")}</th><th className="text-right p-2">%</th>
                <th className="text-right p-2">AOV</th><th className="text-right p-2 bg-slate-50">{prevLabel}{t(": khách·DT")}</th><th className="text-right p-2 bg-indigo-50">{t("Còn cần: đơn·khách")}</th>
                <th className="text-right p-2 bg-indigo-100">Lead</th><th className="text-right p-2">{t("Chốt %")}</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {d.sales.map(s => {
                const pctColor = s.pct == null ? "text-gray-400" : s.pct >= 90 ? "text-emerald-600" : s.pct >= 60 ? "text-amber-600" : "text-red-600";
                return (
                  <tr key={s.userId} className={`border-t border-gray-100 ${s.behind ? "bg-red-50/40" : ""}`}>
                    <td className="p-2"><div className="font-medium whitespace-nowrap">#{s.rank} {s.name} {s.behind && <span className="text-[10px] text-red-600">{t("● tụt")}</span>}</div><div className="text-[10px] text-gray-500 whitespace-nowrap">{s.position}</div></td>
                    <td className="p-2 text-right"><Sensitive>{tr(s.target)}</Sensitive></td>
                    <td className="p-2 text-right font-medium"><Sensitive>{tr(s.revenue)}</Sensitive></td>
                    <td className={`p-2 text-right font-semibold ${pctColor}`}>{s.pct == null ? "—" : s.pct + "%"}</td>
                    <td className="p-2 text-right text-gray-600"><Sensitive>{fmt(s.aov)}</Sensitive></td>
                    <td className="p-2 text-right text-gray-500 bg-slate-50/50">{int(s.custsLast)} · <Sensitive>{tr(s.revLast)}</Sensitive></td>
                    <td className="p-2 text-right bg-indigo-50/50">+{int(s.ordersNeeded)} · +{int(s.customersNeeded)}</td>
                    <td className="p-2 text-right font-bold text-indigo-700 bg-indigo-100/50">+{int(s.leadsNeeded)}</td>
                    <td className="p-2 text-right">{Math.round(s.closeRateUsed * 100)}%{s.closeRateReal != null ? <span className="text-[10px] text-emerald-600 block">{t("thật")}</span> : <span className="text-[10px] text-gray-400 block">{t("g.định")}</span>}</td>
                  </tr>
                );
              })}
              {!d.sales.length && <tr><td colSpan={9} className="p-6 text-center text-gray-400">{t("Chưa có dữ liệu sale")}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {canEdit && <AssumptionsForm d={d} />}
    </div>
  );
}

function RecoBlock({ d }: { d: RevenueLoopData }) {
  const { t: t } = useLang();
  const r = d.reco;
  const [ideas, setIdeas] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const genIdeas = async () => {
    setLoading(true); setErr(""); setIdeas("");
    try {
      const res = await fetch("/api/loop-ideas", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ month: d.month, gap: r.gap, needOrders: d.needOrders, topMargin: r.topMargin, channels: d.channels }) });
      const j = await res.json();
      if (j.ok) setIdeas(j.answer || ""); else setErr(j.reason === "no_api_key" ? "Chưa cấu hình ANTHROPIC_API_KEY" : "Không tạo được gợi ý");
    } catch { setErr("Lỗi kết nối"); } finally { setLoading(false); }
  };
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-1"><span className="w-6 h-6 rounded-full bg-gray-900 text-white text-[12px] font-bold flex items-center justify-center">9</span><h2 className="text-[15px] font-bold text-gray-800">{t("Cần bán gì để đạt KPI — upsell · cross-sell · downsell · quà")}</h2></div>
      <p className="text-xs text-gray-500 mb-3">{t("Tính từ gap KPI (")}<Sensitive>{tr(r.gap)}</Sensitive>{t(") + biên SP thật. Tặng quà — KHÔNG chiết khấu — giữ giá & lãi.")}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <RecoCard color="emerald" title={t("Upsell — nâng combo")}>
          {r.upsell ? <><b>+{int(r.upsell.unitsNeeded)}</b> combo <span className="font-medium">{r.upsell.combo}</span><div className="text-[11px] text-gray-500 mt-0.5">{t("giá")} <Sensitive>{fmt(r.upsell.price)}đ</Sensitive> {t("→ phủ")} <Sensitive>{tr(r.upsell.addRevenue)}</Sensitive></div></> : <span className="text-gray-400">{t("Đã đạt KPI")}</span>}
        </RecoCard>
        <RecoCard color="blue" title={t("Cross-sell — bán kèm")}>
          {r.crossSell ? <>{t("Kèm")} <span className="font-medium">{r.crossSell.product}</span> {t("vào")} <b>{int(r.crossSell.attachTo)}</b> {t("đơn")}<div className="text-[11px] text-gray-500 mt-0.5">{t("biên")} {r.crossSell.marginPct}{t("% · thêm")} <Sensitive>{tr(r.crossSell.addRevenue)}</Sensitive></div></> : <span className="text-gray-400">—</span>}
        </RecoCard>
        <RecoCard color="amber" title={t("Downsell — giữ khách")}>
          {r.downsell ? <><span className="font-medium">{r.downsell.combo}</span> <Sensitive>{fmt(r.downsell.price)}đ</Sensitive><div className="text-[11px] text-gray-500 mt-0.5">{t(r.downsell.note)}</div></> : <span className="text-gray-400">—</span>}
        </RecoCard>
        <RecoCard color="rose" title={t("Quà thay chiết khấu")}>
          {r.gift ? <>{t("Giữ thêm")} <b><Sensitive>{tr(r.gift.savingsVsDiscount10)}</Sensitive></b> {t("lãi")}<div className="text-[11px] text-gray-500 mt-0.5">{t("vs CK 10% · CP quà")} <Sensitive>{tr(r.gift.totalGiftCost)}</Sensitive></div></> : <span className="text-gray-400">—</span>}
        </RecoCard>
      </div>
      {r.topMargin.length > 0 && <div className="mt-3 text-[11px] text-gray-500">{t("SP biên cao nên đẩy:")} {r.topMargin.map(p => `${p.name} ${Math.round(p.margin * 100)}%`).join(" · ")}</div>}
      <div className="mt-3 border-t border-gray-100 pt-3">
        <button onClick={genIdeas} disabled={loading} className="text-sm px-3 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 inline-flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> {loading ? t("AI đang nghĩ…") : t("AI gợi ý chương trình/deal tháng này")}</button>
        {err && <span className="text-[12px] text-red-600 ml-2">{err}</span>}
        {ideas && <div className="mt-3 text-[13px] text-gray-800 bg-violet-50 border border-violet-200 rounded-xl p-3 whitespace-pre-wrap leading-relaxed">{ideas}</div>}
      </div>
    </div>
  );
}

function RecoCard({ color, title, children }: { color: string; title: string; children: React.ReactNode }) {
  const bg: Record<string, string> = { emerald: "border-emerald-200 bg-emerald-50/40", blue: "border-blue-200 bg-blue-50/40", amber: "border-amber-200 bg-amber-50/40", rose: "border-rose-200 bg-rose-50/40" };
  return <div className={`rounded-xl border p-3 text-[13px] ${bg[color]}`}><div className="text-[12px] font-semibold text-gray-700 mb-1">{title}</div>{children}</div>;
}

function Mini({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub: string; tone?: string }) {
  const cls = tone === "indigo-strong" ? "bg-indigo-600 text-white" : tone === "indigo" ? "bg-indigo-50 border border-indigo-100" : "bg-gray-50 border border-gray-100";
  const subCls = tone === "indigo-strong" ? "text-indigo-100" : "text-gray-400";
  const labelCls = tone === "indigo-strong" ? "text-indigo-100" : "text-gray-500";
  return <div className={`rounded-xl p-2.5 ${cls}`}><div className={`text-[11px] ${labelCls}`}>{label}</div><div className="text-lg font-bold mt-0.5">{value}</div><div className={`text-[10px] ${subCls}`}>{sub}</div></div>;
}
function CeilMini({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-lg bg-gray-50 border border-gray-100 p-2"><div className="text-gray-400">{label}</div><div className="font-semibold text-gray-700 mt-0.5">{value}</div></div>;
}
function Badge({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return <span className={`px-2 py-0.5 rounded-full border ${ok ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-gray-50 border-gray-200 text-gray-500"}`}>{children}</span>;
}

function AssumptionsForm({ d }: { d: RevenueLoopData }) {
  const { t: t } = useLang();
  const [closeRatePct, setCloseRatePct] = useState(String(Math.round(d.assumptions.closeRate * 100)));
  const [ordersPerCustomer, setOrdersPerCustomer] = useState(String(d.assumptions.ordersPerCustomer));
  const [grossMarginPct, setGrossMarginPct] = useState(String(Math.round(d.assumptions.grossMargin * 100)));
  const [desiredMarginPct, setDesiredMarginPct] = useState(String(Math.round(d.assumptions.desiredMargin * 100)));
  const [mktCostCapPct, setMktCostCapPct] = useState(String(Math.round(d.assumptions.mktCostCapPct * 100)));
  const [mktSpend, setMktSpend] = useState(String(d.mktSpend || 0));
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    setMsg("");
    const r = await saveLoopAssumptions({ closeRatePct: +closeRatePct, ordersPerCustomer: +ordersPerCustomer, grossMarginPct: +grossMarginPct, desiredMarginPct: +desiredMarginPct, mktCostCapPct: +mktCostCapPct, mktSpend: +mktSpend, month: d.month });
    setMsg(r.ok ? "Đã lưu — số lead cần, ngân sách & %MKT tính lại." : `${r.error || "Lỗi"}`);
  });
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
      <h2 className="text-[15px] font-bold text-gray-800 mb-1">{t("Giả định & chi phí (chỉ admin)")}</h2>
      <p className="text-xs text-gray-500 mb-3">{t("Sửa → toàn bộ lead cần, ngân sách ads, %MKT tự tính lại. Giả định kế hoạch, hệ thống tự ốp số thật khi có.")}</p>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
        <Fld label={t("Tỉ lệ chốt (%)")}><input value={closeRatePct} onChange={e => setCloseRatePct(e.target.value.replace(/[^\d]/g, ""))} className="finp" /></Fld>
        <Fld label={t("Đơn / 1 khách")}><input value={ordersPerCustomer} onChange={e => setOrdersPerCustomer(e.target.value.replace(/[^\d.,]/g, ""))} className="finp" /></Fld>
        <Fld label={t("Biên lãi gộp (%)")}><input value={grossMarginPct} onChange={e => setGrossMarginPct(e.target.value.replace(/[^\d]/g, ""))} className="finp" /></Fld>
        <Fld label={t("Lãi muốn giữ (%)")}><input value={desiredMarginPct} onChange={e => setDesiredMarginPct(e.target.value.replace(/[^\d]/g, ""))} className="finp" /></Fld>
        <Fld label={t("Trần MKT/DT (%)")}><input value={mktCostCapPct} onChange={e => setMktCostCapPct(e.target.value.replace(/[^\d]/g, ""))} className="finp" /></Fld>
        <Fld label={`Chi phí MKT T${+d.month.slice(5)} (đ)`}><input value={mktSpend} onChange={e => setMktSpend(e.target.value.replace(/[^\d]/g, ""))} className="finp" /></Fld>
      </div>
      <div className="flex items-center gap-3 mt-3">
        <button onClick={save} disabled={pending} className="text-sm px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50">{pending ? t("Đang lưu…") : t("Lưu")}</button>
        {msg && <span className="text-[12px] text-gray-600">{msg}</span>}
      </div>
      <p className="text-[11px] text-gray-400 mt-2">{t("Chi phí MKT: nhập tay hằng tháng, hoặc set FB_ADS_TOKEN trên MKT Studio để tự kéo chi tiêu Meta (khi tài khoản ACME bật được).")}</p>
      <style jsx>{`.finp{width:100%;padding:6px 8px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;text-align:right}`}</style>
    </div>
  );
}
function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs text-gray-500 block mb-0.5">{label}</span>{children}</label>;
}
