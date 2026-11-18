"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, Filter, X } from "lucide-react";
import { useLang } from "@/components/lang-provider";

const RANGES = [
  { v: "today", l: "Hôm nay" },
  { v: "7d", l: "7 ngày" },
  { v: "30d", l: "30 ngày" },
  { v: "mtd", l: "Tháng này" },
  { v: "qtd", l: "Quý này" },
  { v: "ytd", l: "YTD" }
];

function generateMonthOptions(): { v: string; l: string }[] {
  const opts: { v: string; l: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear(), m = d.getMonth() + 1;
    opts.push({ v: `month:${y}-${String(m).padStart(2,"0")}`, l: `T${m}/${y}` });
  }
  return opts;
}
function generateQuarterOptions(): { v: string; l: string }[] {
  const opts: { v: string; l: string }[] = [];
  const now = new Date();
  const curQ = Math.floor(now.getMonth() / 3) + 1;
  const curY = now.getFullYear();

  for (let i = 0; i < 4; i++) {
    let q = curQ - i;
    let y = curY;
    if (q < 1) { q += 4; y -= 1; }
    opts.push({ v: `quarter:${y}-Q${q}`, l: `Q${q}/${y}` });
  }
  return opts;
}

export function FilterBar({
  currentRange, currentChannel, currentSubChannel, currentProduct, currentCustomer, currentSale,
  availableChannels, availableSubChannels, products, customers, sales
}: {
  currentRange: string;
  currentChannel: string;
  currentSubChannel: string;
  currentProduct: string;
  currentCustomer: string;
  currentSale: string;
  availableChannels: string[];
  availableSubChannels: string[];
  products: { id: string; name: string; sku?: string }[];
  customers: { id: string; full_name: string }[];
  sales: { id: string; full_name: string }[];
}) {
  const { t } = useLang();
  const router = useRouter();
  const sp = useSearchParams();

  const setParam = (key: string, val: string) => {
    const params = new URLSearchParams(sp.toString());
    if (val) params.set(key, val);
    else params.delete(key);
    router.push(`/dashboard?${params.toString()}`);
  };

  const clearAll = () => router.push("/dashboard");
  const activeCount = [currentChannel, currentSubChannel, currentProduct, currentCustomer, currentSale].filter(Boolean).length;

  const monthOpts = generateMonthOptions();
  const quarterOpts = generateQuarterOptions();
  const isMonthSelected = currentRange.startsWith("month:");
  const isQuarterSelected = currentRange.startsWith("quarter:");

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="bg-white border border-gray-200 rounded-lg p-1 flex gap-0.5">
        <Calendar className="w-3.5 h-3.5 text-gray-400 ml-2 self-center" />
        {RANGES.map(r => (
          <button key={r.v}
            onClick={() => setParam("range", r.v)}
            className={`px-2.5 py-1 text-xs font-medium rounded transition ${
              currentRange === r.v ? "bg-brand-600 text-white" : "text-gray-700 hover:bg-gray-100"
            }`}>{t(r.l)}</button>
        ))}
      </div>

      <div className={`bg-white border rounded-lg px-2 py-1 flex items-center gap-1 ${isMonthSelected ? "border-brand-500 ring-1 ring-brand-200" : "border-gray-200"}`}>
        <span className="text-xs text-gray-500">{t("Tháng")}:</span>
        <select value={isMonthSelected ? currentRange : ""}
          onChange={e => e.target.value && setParam("range", e.target.value)}
          className="text-xs bg-transparent outline-none cursor-pointer py-1">
          <option value="">{t("— chọn —")}</option>
          {monthOpts.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
        </select>
      </div>

      <div className={`bg-white border rounded-lg px-2 py-1 flex items-center gap-1 ${isQuarterSelected ? "border-brand-500 ring-1 ring-brand-200" : "border-gray-200"}`}>
        <span className="text-xs text-gray-500">{t("Quý")}:</span>
        <select value={isQuarterSelected ? currentRange : ""}
          onChange={e => e.target.value && setParam("range", e.target.value)}
          className="text-xs bg-transparent outline-none cursor-pointer py-1">
          <option value="">{t("— chọn —")}</option>
          {quarterOpts.map(q => <option key={q.v} value={q.v}>{q.l}</option>)}
        </select>
      </div>

      <Selector
        icon=""
        value={currentProduct}
        onChange={v => setParam("product", v)}
        options={[{ value: "", label: t("Tất cả SP") }, ...products.map(p => ({ value: p.id, label: p.name + (p.sku ? ` (${p.sku})` : "") }))]}
      />

      <Selector
        icon=""
        value={currentCustomer}
        onChange={v => setParam("customer", v)}
        options={[{ value: "", label: t("Tất cả KH") }, ...customers.slice(0, 200).map(c => ({ value: c.id, label: c.full_name }))]}
      />

      <Selector
        icon=""
        value={currentSale}
        onChange={v => setParam("sale", v)}
        options={[{ value: "", label: t("Tất cả Sale") }, ...sales.map(s => ({ value: s.id, label: s.full_name }))]}
      />

      {availableChannels.length > 0 && (
        <Selector
          icon=""
          value={currentChannel}
          onChange={v => setParam("channel", v)}
          options={[{ value: "", label: t("Mọi kênh") }, ...availableChannels.map(c => ({ value: c, label: c }))]}
        />
      )}

      {availableSubChannels.length > 0 && (
        <Selector
          icon=""
          value={currentSubChannel}
          onChange={v => setParam("subch", v)}
          options={[{ value: "", label: t("Mọi kênh con") }, ...availableSubChannels.map(c => ({ value: c, label: c }))]}
        />
      )}

      {activeCount > 0 && (
        <button onClick={clearAll}
          className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded inline-flex items-center gap-1">
          <X className="w-3 h-3" /> {t("Xoá filter")} ({activeCount})
        </button>
      )}
    </div>
  );
}

function Selector({ icon, value, onChange, options }: { icon: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  const { t: t } = useLang();
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-2 py-1 flex items-center gap-1">
      <span className="text-xs">{icon}</span>
      <select value={value}
        onChange={e => onChange(e.target.value)}
        className="text-xs bg-transparent outline-none cursor-pointer py-1 max-w-[160px]">
        {options.map(o => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
      </select>
    </div>
  );
}
