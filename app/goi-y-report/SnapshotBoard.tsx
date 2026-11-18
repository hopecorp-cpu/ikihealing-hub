import { getT } from "@/lib/i18n-server";
import { MetricCard, Panel } from "@/components/dashboard-ui";
import { ShoppingCart, Users, Repeat, MessageSquare, TrendingUp, TrendingDown, MapPin, Activity } from "lucide-react";
import type { ReportSnapshot } from "@/lib/report-advisor";

export default function SnapshotBoard({ s }: { s: ReportSnapshot }) {
  const { t: t } = getT();
  const maxIdx = Math.max(1, ...s.monthIndex.map((m) => m.index));
  const maxConcern = Math.max(1, ...s.concerns.map((c) => c.pct));

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-[#12261f] to-[#1c3a30] rounded-2xl p-5 text-white">
        <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#A8D254]">
          {t("Báo cáo tháng")} {s.month.slice(5)}/{s.month.slice(0, 4)} {t("· dữ liệu NOVA")}
        </div>
        <p className="mt-2 text-[15px] leading-relaxed text-white/90">{s.headline}</p>
        <p className="mt-1.5 text-[13px] text-white/60">
          {s.monthClosed
            ? t("Dữ liệu tháng đã đủ ngày.")
            : `Tháng ${s.month.slice(5)} có dữ liệu tới ngày ${s.dayCut} — mọi so sánh đã cắt kỳ trước về cùng ngày.`}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label={t("Đơn trong kỳ")} value={s.orders.toLocaleString("vi-VN")} icon={ShoppingCart} />
        <MetricCard label={t("Khách hàng")} value={s.customers.toLocaleString("vi-VN")} icon={Users} color="#3B82F6" />
        <MetricCard label={t("Tỉ lệ quay lại")} value={s.repeatPct + "%"} sub={`tái mua sau ~${s.reMuaMedian} ngày`} icon={Repeat} color="#8B5CF6" />
        <MetricCard label={t("Lượt tin nhắn/quyết định")} value={s.chatMedian || "-"} sub={t("trung vị mỗi cuộc tư vấn")} icon={MessageSquare} color="#F59E0B" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title={t("Phân khúc giỏ hàng")} icon={Activity}>
          <div className="space-y-3">
            {s.segments.map((seg) => (
              <div key={seg.name}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-semibold text-gray-800">{seg.name}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-[13px] font-bold text-gray-900 tabular-nums sensitive">{seg.share}%</span>
                    {seg.mom === null ? (
                      <span className="text-[11px] text-gray-400">{seg.small ? t("quy mô nhỏ") : t("chưa có nền")}</span>
                    ) : (
                      <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${seg.mom >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {seg.mom >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {seg.mom > 0 ? "+" : ""}{seg.mom}%
                      </span>
                    )}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#A8D254] to-[#2E8975]" style={{ width: Math.min(100, seg.share) + "%" }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-gray-500">
            {t("Phân khúc dưới 3% giỏ hàng không diễn giải phần trăm biến động — mẫu quá nhỏ, con số sẽ nhiễu.")}
          </p>
        </Panel>

        <Panel title={t("Địa bàn dẫn đầu")} icon={MapPin} iconColor="#3B82F6">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-gray-400">
                  <th className="text-left font-semibold pb-2">{t("Tỉnh thành")}</th>
                  <th className="text-right font-semibold pb-2">{t("Tỉ trọng đơn")}</th>
                  <th className="text-right font-semibold pb-2">{t("Giá trị/đơn")}</th>
                </tr>
              </thead>
              <tbody>
                {s.provinces.map((p) => (
                  <tr key={p.name} className="border-t border-gray-50">
                    <td className="py-1.5 font-medium text-gray-800">{p.name}</td>
                    <td className="py-1.5 text-right tabular-nums text-gray-900 font-semibold">{p.share}%</td>
                    <td className="py-1.5 text-right tabular-nums text-gray-600 sensitive">
                      {p.avgCod ? Math.round(p.avgCod / 1000).toLocaleString("vi-VN") + "k" : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[12px] text-gray-500">{t("Chỉ xếp hạng tỉnh có từ 20 đơn trở lên. Giá trị/đơn tính trên đơn thu tiền khi nhận hàng.")}</p>
        </Panel>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title={t("Nhịp mùa theo tháng")} icon={TrendingUp}>
          {s.monthIndex.length ? (
            <>
              <div className="flex items-end gap-3 h-32">
                {s.monthIndex.map((m) => (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-[11px] font-bold text-gray-700 tabular-nums">{m.index}</span>
                    <div className="w-full rounded-t-lg bg-gradient-to-t from-[#2E8975] to-[#4BC0AB]"
                         style={{ height: Math.max(4, (m.index / maxIdx) * 92) + "px" }} />
                    <span className="text-[11px] text-gray-500">T{m.month.slice(5)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[12px] text-gray-500">
                {t("Chỉ số nhịp, mốc 100 = tháng")} {s.monthIndex[0].month.slice(5)}{t(". Chỉ tính tháng có dữ liệu trọn tháng.")}
              </p>
            </>
          ) : (
            <p className="text-[13px] text-gray-500">{t("Chưa có tháng nào đủ trọn dữ liệu để dựng nhịp mùa.")}</p>
          )}
        </Panel>

        <Panel title={t("Khách chủ động quan tâm điều gì")} icon={MessageSquare} iconColor="#F59E0B">
          {s.concerns.length ? (
            <>
              <div className="space-y-2.5">
                {s.concerns.map((c) => (
                  <div key={c.name}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[13px] text-gray-800">{c.name}</span>
                      <span className="text-[13px] font-bold text-gray-900 tabular-nums">{c.pct}%</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600"
                           style={{ width: (c.pct / maxConcern) * 100 + "%" }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[12px] text-gray-500">
                {t("Chỉ tính các cuộc hội thoại mà khách là bên nêu vấn đề, đã loại phần bị tin nhắn tư vấn gửi sẵn làm phồng.")}
              </p>
            </>
          ) : (
            <p className="text-[13px] text-gray-500">{t("Chưa có dữ liệu hội thoại đã phân tích.")}</p>
          )}
        </Panel>
      </div>

      <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-brand-700">{t("Điểm sáng của kỳ")}</div>
        <p className="mt-1 text-[14px] text-gray-800">{s.diemSang}</p>
      </div>
    </div>
  );
}
