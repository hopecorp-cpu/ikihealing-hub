"use client";
import { ApexChart } from "@/components/ui/chart";
import { useLang } from "@/components/lang-provider";
import type { CashFlow } from "@/lib/cashflow";
import { ArrowDownLeft, ArrowUpRight, Wallet, TriangleAlert, Truck } from "lucide-react";

export default function CashFlow({ cf, pnl }: { cf: CashFlow; pnl: { month: string; label: string; profit: number }[] }) {
  const { t, locale } = useLang();
  const loc = locale === "vi" ? "vi-VN" : locale === "ja" ? "ja-JP" : "en-US";
  const trM = (n: number) => (n / 1e6).toLocaleString(loc, { maximumFractionDigits: 1 });
  const vnd = (n: number) => Math.round(n).toLocaleString(loc) + (locale === "vi" ? "đ" : " ₫");
  const sign = (n: number) => (n >= 0 ? "+" : "−") + trM(Math.abs(n)) + " " + t("tr");

  const ms = cf.months;
  const isPartial = (m: string) => cf.partial.includes(m);

  const compare = pnl.filter(p => ms.some(m => m.month === p.month) && !isPartial(p.month))
    .map(p => { const m = ms.find(x => x.month === p.month)!; return { ...p, cash: m.opIn - m.out }; });
  const flipped = compare.filter(c => (c.profit >= 0) !== (c.cash >= 0));
  const last = ms[ms.length - 1];
  const stale = cf.staleDays ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 pb-8 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-emerald-600" /> {t("Dòng tiền thật (sổ phụ ngân hàng)")}
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {t("Bảng trên là lãi TRÊN SỔ. Đây là tiền THẬT vào/ra tài khoản MB + TCB — bán được hàng chưa chắc đã có tiền về.")}
        </p>
      </div>

      <div className={`rounded-xl p-3 text-xs flex gap-2 border ${stale > 40 ? "bg-red-50 border-red-200 text-red-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
        <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          {t("Số liệu tới")} <b>{cf.window.to?.slice(8, 10)}/{cf.window.to?.slice(5, 7)}/{cf.window.to?.slice(0, 4)}</b> — {t("trễ")} <b>{stale} {t("ngày")}</b>. {" "}
          {t("Ngân hàng chỉ gửi sổ phụ mỗi tháng 1 lần, nên đây KHÔNG phải số dư hôm nay. Muốn theo ngày: bật email biến động số dư ở app MB.")}
          {stale > 40 && <> <b>{t("Đã quá 40 ngày — nghi sổ phụ tháng mới không về, cần kiểm tra.")}</b></>}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card label={t("TIỀN VÀO (kinh doanh)")} value={vnd(last.opIn)} sub={last.finIn > 0 ? `${t("chưa gồm vay/góp vốn")} ${trM(last.finIn)} ${t("tr")}` : `${t("tháng")} ${last.month.slice(5)}/${last.month.slice(2, 4)}`} color="#10B981" Icon={ArrowDownLeft} />
        <Card label={t("TIỀN RA")} value={vnd(last.out)} sub={`${t("tháng")} ${last.month.slice(5)}/${last.month.slice(2, 4)}`} color="#EF4444" Icon={ArrowUpRight} />
        <Card label={t("RÒNG KINH DOANH")} value={sign(last.opIn - last.out)} sub={last.opIn - last.out >= 0 ? t("business tự nuôi được") : t("business chưa đủ bù chi")} color={last.opIn - last.out >= 0 ? "#10B981" : "#EF4444"} Icon={Wallet} />
        <Card label={t("SỐ DƯ CÒN LẠI")} value={vnd(cf.totals.closing)} sub={`MB ${trM(cf.banks.mb || 0)} + TCB ${trM(cf.banks.tcb || 0)} ${t("tr")}`} color="#1a73e8" Icon={Wallet} />
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
        <div className="font-semibold text-sm mb-3">{t("Tiền vào / tiền ra từng tháng")} <span className="font-normal text-gray-400">({t("triệu đồng")})</span></div>
        <ApexChart
          type="bar" height={300}
          series={[
            { name: t("Tiền vào (kinh doanh)"), data: ms.map(m => +(m.opIn / 1e6).toFixed(1)) },
            { name: t("Vay / góp vốn"), data: ms.map(m => +(m.finIn / 1e6).toFixed(1)) },
            { name: t("Tiền ra"), data: ms.map(m => -+(m.out / 1e6).toFixed(1)) },
          ]}
          options={{
            colors: ["#10B981", "#94A3B8", "#EF4444"],
            chart: { stacked: true },
            plotOptions: { bar: { borderRadius: 4, columnWidth: "55%" } },
            xaxis: { categories: ms.map(m => `${m.month.slice(5)}/${m.month.slice(2, 4)}${isPartial(m.month) ? "*" : ""}`) },
            yaxis: { labels: { formatter: (v: number) => Math.abs(v).toFixed(0) } },
            tooltip: { y: { formatter: (v: number) => vnd(Math.abs(v) * 1e6) } },
          }}
        />
        {cf.partial.length > 0 && (
          <div className="text-[11px] text-gray-400 mt-2">
            * {t("tháng sổ phụ chỉ phủ một phần → số thấp giả, đừng so với tháng đủ")}: {cf.partial.map(p => `${p.slice(5)}/${p.slice(2, 4)}`).join(", ")}
          </div>
        )}
      </div>

      {compare.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
          <div className="p-3 border-b border-gray-100 font-semibold text-sm">{t("Lãi trên sổ vs tiền thật về")}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="text-left p-2.5">{t("Tháng")}</th>
                  <th className="text-right p-2.5">{t("Lãi trên sổ (Excel)")}</th>
                  <th className="text-right p-2.5">{t("Dòng tiền thật")}</th>
                  <th className="text-right p-2.5">{t("Lệch")}</th>
                </tr>
              </thead>
              <tbody>
                {compare.map(c => {
  const { t: t } = useLang();
                  const flip = (c.profit >= 0) !== (c.cash >= 0);
                  return (
                    <tr key={c.month} className={`border-t border-gray-100 ${flip ? "bg-amber-50/60" : ""}`}>
                      <td className="p-2.5 font-medium">{t(c.label) || c.month}</td>
                      <td className={`p-2.5 text-right font-semibold sensitive ${c.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{sign(c.profit)}</td>
                      <td className={`p-2.5 text-right font-semibold sensitive ${c.cash >= 0 ? "text-emerald-600" : "text-red-600"}`}>{sign(c.cash)}</td>
                      <td className="p-2.5 text-right text-gray-500 sensitive">{sign(c.cash - c.profit)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {flipped.length > 0 && (
            <div className="p-3 bg-amber-50 border-t border-amber-200 text-xs text-amber-800 flex gap-2">
              <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <b>{flipped.length}/{compare.length} {t("tháng lãi trên sổ và tiền thật NGƯỢC DẤU nhau")}</b> — {t("tháng ghi lãi mà tiền vẫn hụt (trả nhà cung cấp, ôm hàng), tháng ghi lỗ mà tiền lại về (COD kỳ trước mới chuyển). Nhìn mỗi bảng P&L phía trên là ra quyết định sai.")}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
          <div className="font-semibold text-sm mb-3 flex items-center gap-2"><Truck className="w-4 h-4 text-emerald-600" /> {t("Tiền vào KINH DOANH đến từ đâu")}</div>
          <div className="space-y-2 text-sm">
            <Row label={t("COD J&T chuyển về")} value={vnd(cf.jt.in)} pct={cf.jt.sharePct} />
            <Row label={t("Doanh thu khác (CK khách, cổng TT, sàn)")} value={vnd(cf.other.in)} pct={cf.other.sharePct} muted />
          </div>
          {cf.fin.in > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100 text-sm flex justify-between items-baseline gap-2">
              <span className="text-gray-500">{t("Tiền vay / góp vốn")} <span className="text-[11px] text-gray-400">({t("tài trợ, không phải doanh thu")})</span></span>
              <span className="font-semibold text-gray-600 shrink-0 sensitive">{vnd(cf.fin.in)}</span>
            </div>
          )}
          <div className="text-[11px] text-gray-400 mt-3">{t("Tỉ trọng tính trên tiền vào kinh doanh, đã tách tiền vay/góp vốn ra. J&T hứa trả bao nhiêu về đúng bấy nhiêu — xem Đối soát J&T.")}</div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
          <div className="font-semibold text-sm mb-3">{t("Chi qua thẻ TCB")} <span className="font-normal text-gray-400">— {vnd(cf.tcbSpend)}</span></div>
          <div className="space-y-2 text-sm">
            {Object.entries(cf.byCat).sort((a, b) => b[1].sum - a[1].sum).map(([k, v]) => (
              <Row key={k} label={t(k)} value={vnd(v.sum)} pct={cf.tcbSpend > 0 ? Math.round(v.sum / cf.tcbSpend * 100) : 0} />
            ))}
          </div>
          <div className="text-[11px] text-gray-400 mt-3">{t("Thẻ này trả nền tảng (FB/Google/AI). Tiền lương, nhà cung cấp, thuê kho đi qua MB nên không nằm ở đây.")}</div>
        </div>
      </div>
    </div>
  );
}

function Card({ label, value, sub, color, Icon }: { label: string; value: string; sub: string; color: string; Icon: any }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-xs text-gray-500 uppercase font-semibold tracking-wide">{label}</div>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + "1a" }}>
          <Icon className="w-[18px] h-[18px]" style={{ color }} />
        </div>
      </div>
      <div className="text-xl font-bold sensitive" style={{ color }}>{value}</div>
      <div className="text-[11px] text-gray-400 mt-1">{sub}</div>
    </div>
  );
}

function Row({ label, value, pct, muted }: { label: string; value: string; pct: number; muted?: boolean }) {
  return (
    <div>
      <div className="flex justify-between items-baseline gap-2">
        <span className={`truncate ${muted ? "text-gray-400" : "text-gray-700"}`}>{label}</span>
        <span className="font-semibold shrink-0 sensitive">{value}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: muted ? "#CBD5E1" : "#10B981" }} />
      </div>
    </div>
  );
}
