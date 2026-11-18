"use client";
import { useLang } from "@/components/lang-provider";

import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export const ACME_PALETTE = ["#10B981", "#3B82F6", "#F59E0B", "#8B5CF6", "#EF4444", "#06B6D4", "#EC4899", "#64748B"];

export const fmtShort = (v: number) => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(Math.round(n));
};
export const fmtVND = (v: number) => (Number(v) || 0).toLocaleString("vi") + "đ";

const base = (): ApexOptions => ({
  chart: { fontFamily: "inherit", toolbar: { show: false }, zoom: { enabled: false }, animations: { speed: 500 }, foreColor: "#6B7280" },
  colors: ACME_PALETTE,
  grid: { borderColor: "#F3F4F6", strokeDashArray: 4, padding: { left: 8, right: 8 } },
  dataLabels: { enabled: false },
  legend: { fontSize: "12px", markers: { radius: 12 }, itemMargin: { horizontal: 8 } },
  tooltip: { theme: "light", style: { fontSize: "12px" } },
  stroke: { curve: "smooth", width: 2.5, lineCap: "round" },
});

function deepMerge(a: any, b: any): any {
  const out = { ...a };
  for (const k of Object.keys(b || {})) out[k] = b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) ? deepMerge(a[k] || {}, b[k]) : b[k];
  return out;
}

export function ApexChart({ type, series, options, height = 260 }: {
  type: "area" | "line" | "bar" | "donut" | "pie" | "radialBar";
  series: any; options?: ApexOptions; height?: number | string;
}) {
  return <ReactApexChart type={type} series={series} height={height} options={deepMerge(base(), options || {})} />;
}

export function DonutChart({ data, money = false, height = 240 }: { data: { name: string; value: number }[]; money?: boolean; height?: number }) {
  const { t: t } = useLang();
  return (
    <ApexChart type="donut" height={height}
      series={data.map(d => d.value)}
      options={{
        labels: data.map(d => d.name),
        stroke: { width: 2, colors: ["#fff"] },
        legend: { position: "bottom" },
        plotOptions: { pie: { donut: { size: "68%", labels: { show: true, total: { show: true, label: t("Tổng"), formatter: () => (money ? fmtShort(data.reduce((s, d) => s + d.value, 0)) : String(data.reduce((s, d) => s + d.value, 0))) } } } } },
        tooltip: { y: { formatter: (v: number) => (money ? fmtVND(v) : String(v)) } },
      }} />
  );
}

export function LineChart({ categories, series, money = false, area = false, height = 260 }: {
  categories: (string | number)[]; series: { name: string; data: number[] }[]; money?: boolean; area?: boolean; height?: number;
}) {
  return (
    <ApexChart type={area ? "area" : "line"} height={height} series={series}
      options={{
        xaxis: { categories, labels: { style: { fontSize: "11px" } }, axisBorder: { show: false }, axisTicks: { show: false } },
        yaxis: { labels: { formatter: (v: number) => fmtShort(v), style: { fontSize: "11px" } } },
        fill: area ? { type: "gradient", gradient: { shadeIntensity: 0.4, opacityFrom: 0.35, opacityTo: 0.05, stops: [0, 100] } } : { type: "solid" },
        tooltip: { y: { formatter: (v: number) => (money ? fmtVND(v) : String(v)) } },
        markers: { size: 0, hover: { size: 5 } },
      }} />
  );
}
