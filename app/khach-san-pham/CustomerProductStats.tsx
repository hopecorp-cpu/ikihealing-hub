"use client";
import { useLang } from "@/components/lang-provider";

type MonthRow = {
  month: string; orders: number; customers: number | null;
  cafeCust: number | null; siliconCust: number | null; thanhLocCust: number | null;
  cafeKg: number | null; siliconUnits: number | null; thanhLocUnits: number | null;
  note?: string;
};
type Stats = {
  generatedAt: string; source: string;
  systemTotalCustomers: number; activeCustomersT1T4: number;
  unique: { cafe: number; silicon: number; thanhLoc: number };
  anyOfThree: number; anyOfThreeRatio: number; naiveSum: number;
  ratioVsActive: { cafe: number; silicon: number; thanhLoc: number };
  months: MonthRow[];
};

const n = (v: number | null, suffix = "") => v == null ? "—" : v.toLocaleString("vi") + suffix;

export default function CustomerProductStats({ data }: { data: Stats }) {
  const { t } = useLang();
  const cards = [
    { key: "cafe", label: t("Cà phê NOVA"), icon: "", color: "amber",
      cust: data.unique.cafe, ratio: data.ratioVsActive.cafe },
    { key: "silicon", label: t("Túi / bộ silicon"), icon: "", color: "sky",
      cust: data.unique.silicon, ratio: data.ratioVsActive.silicon },
    { key: "thanhLoc", label: t("Liệu trình thanh lọc"), icon: "", color: "emerald",
      cust: data.unique.thanhLoc, ratio: data.ratioVsActive.thanhLoc },
  ] as const;
  const tone: Record<string, string> = {
    amber: "text-amber-700 bg-amber-50 border-amber-200",
    sky: "text-sky-700 bg-sky-50 border-sky-200",
    emerald: "text-emerald-700 bg-emerald-50 border-emerald-200",
  };
  const bar: Record<string, string> = { amber: "bg-amber-500", sky: "bg-sky-500", emerald: "bg-emerald-500" };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">{t("Nhóm khách Thanh lọc / Detox")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("Khách dùng cà phê NOVA / túi silicon / bộ thanh lọc — nhóm hỗ trợ tiêu hoá & chuyển hoá. T1–T5/2026. Cập nhật")} {data.generatedAt}.
        </p>
      </div>

      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5">
        <div className="text-sm font-medium text-indigo-700">{t("Tổng nhóm khách Thanh lọc / Detox")}</div>
        <div className="flex flex-wrap items-end gap-x-8 gap-y-1 mt-1">
          <div className="text-4xl font-bold text-indigo-800">
            {data.anyOfThree.toLocaleString("vi")} <span className="text-lg font-medium">{t("người")}</span>
          </div>
          <div>
            <div className="text-2xl font-semibold text-indigo-700">{data.anyOfThreeRatio}%</div>
            <div className="text-xs text-indigo-600">{t("trên")} {data.activeCustomersT1T4.toLocaleString("vi")} {t("khách mua hàng")}</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-indigo-500">{data.naiveSum}</div>
            <div className="text-xs text-indigo-600">{t("lượt dùng SP detox (cafe+silicon+thanh lọc)")}</div>
          </div>
        </div>
        <div className="text-xs text-indigo-600 mt-2">
          {data.anyOfThree} {t("người = số khách thật trong nhóm (đã gộp & khử SĐT trùng).")}
          {t("Có")} {data.naiveSum - data.anyOfThree} {t("lượt là khách dùng từ 2 SP trở lên (vd combo silicon + cafe) nên tổng lượt")} {data.naiveSum} {">"} {t("số người")} {data.anyOfThree}.
        </div>
      </div>

      <div className="text-sm font-medium text-gray-500">{t("Bóc tách theo từng sản phẩm trong nhóm:")}</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cards.map(c => (
          <div key={c.key} className={`rounded-xl border p-4 ${tone[c.color]}`}>
            <div className="text-sm font-medium flex items-center gap-1.5">
              <span className="text-lg">{c.icon}</span>{t(c.label)}
            </div>
            <div className="text-3xl font-bold mt-2">{n(c.cust)} <span className="text-base font-medium">{t("khách")}</span></div>
            <div className="text-sm mt-1">
              ≈ <b>{c.ratio}%</b> {t("khách mua hàng kỳ T1–T4")}
            </div>
            <div className="mt-2 h-2 rounded-full bg-white/60 overflow-hidden">
              <div className={`h-full ${bar[c.color]}`} style={{ width: `${Math.min(c.ratio, 100)}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm text-gray-600">
        <b>{t("Mẫu số:")}</b> {data.activeCustomersT1T4.toLocaleString("vi")} {t("khách đã mua hàng (giao thành công) trong kỳ T1–T4 / tổng")} {data.systemTotalCustomers.toLocaleString("vi")} {t("khách trong hệ thống.")}
        {t("Đây là")} <b>{t("khách duy nhất")}</b> {t("(đã khử SĐT trùng giữa các tháng).")}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="text-left p-3">{t("Tháng")}</th>
              <th className="text-right p-3">{t("Đơn giao")}</th>
              <th className="text-right p-3">{t("Khách")}</th>
              <th className="text-right p-3">{t("Khách mua cafe")}</th>
              <th className="text-right p-3">{t("Khách mua silicon")}</th>
              <th className="text-right p-3">{t("Khách mua thanh lọc")}</th>
              <th className="text-right p-3">{t("Kg cafe")}</th>
              <th className="text-right p-3">{t("Bộ silicon")}</th>
              <th className="text-right p-3">{t("Thanh lọc")}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {data.months.map(m => (
              <tr key={m.month} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="p-3 font-medium">{m.month}/2026</td>
                <td className="p-3 text-right">{n(m.orders)}</td>
                <td className="p-3 text-right">{n(m.customers)}</td>
                <td className="p-3 text-right text-amber-700 font-medium">{n(m.cafeCust)}</td>
                <td className="p-3 text-right text-sky-700 font-medium">{n(m.siliconCust)}</td>
                <td className="p-3 text-right text-emerald-700 font-medium">{n(m.thanhLocCust)}</td>
                <td className="p-3 text-right">{n(m.cafeKg, " kg")}</td>
                <td className="p-3 text-right">{n(m.siliconUnits)}</td>
                <td className="p-3 text-right">{n(m.thanhLocUnits)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 space-y-1.5">
        <div className="font-semibold">{t("Lưu ý về dữ liệu")}</div>
        <p>• {t("Nguồn:")} {data.source}</p>
        <p>• <b>{t("T1, T2")}</b> {t("file vận chuyển ghi tắt tên hàng → chỉ đếm được khách")} <i>{t("có mua")}</i>{t(", chưa ra kg/số túi.")}</p>
        <p>• <b>{t("T5")}</b> {t("nguồn tổng hợp MShopkeeper → có khối lượng nhưng")} <i>{t("không tách được theo khách")}</i>.</p>
        <p>• {t("Là dữ liệu vận chuyển (phủ ~86–100% tổng đơn) nên các con số là")} <b>{t("tối thiểu")}</b>{t(", thực tế có thể cao hơn.")}</p>
      </div>
    </div>
  );
}
