"use client";
import { ApexChart } from "@/components/ui/chart";
import { tr, type Locale } from "@/lib/i18n";

export default function ForecastChart({ data, locale = "vi" }: { data: any[]; locale?: Locale }) {
  const unit = locale === "vi" ? " tr" : " M";
  const keys = ["Thực tế", "Cơ sở", "Tích cực", "Bi quan"];
  const cats = data.map(d => (locale === "vi" ? d.name : String(d.name).replace(/^T/, "M")));
  return (
    <ApexChart type="line" height={280}
      series={keys.map(k => ({ name: tr(locale, k), data: data.map(d => (d[k] ?? null)) }))}
      options={{
        colors: ["#111827", "#3b82f6", "#10b981", "#ef4444"],
        stroke: { curve: "smooth", width: [3, 2, 2, 2], dashArray: [0, 5, 5, 5], lineCap: "round" },
        xaxis: { categories: cats },
        yaxis: { labels: { formatter: (v: number) => `${Math.round(v)}${unit}` } },
        tooltip: { y: { formatter: (v: number) => `${v}${unit}` } },
        markers: { size: 0, hover: { size: 5 } },
      }} />
  );
}
