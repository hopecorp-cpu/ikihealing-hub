import { getT } from "@/lib/i18n-server";
import { LucideIcon } from "lucide-react";
import Link from "next/link";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export function MetricCard({
  label, value, sub, icon: Icon, color = "#10B981", delta, deltaGoodWhenUp = true, sensitive = true,
}: {
  label: string; value: string | number; sub?: string; icon: LucideIcon; color?: string;
  delta?: number | null; deltaGoodWhenUp?: boolean; sensitive?: boolean;
}) {
  const hasDelta = delta !== undefined && delta !== null && isFinite(delta as number);
  const up = (delta ?? 0) >= 0;
  const good = up === deltaGoodWhenUp;
  const deltaColor = !hasDelta ? "#9CA3AF" : good ? "#059669" : "#DC2626";
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] hover:shadow-[0_4px_12px_rgba(16,24,40,0.08)] transition-shadow">
      <div className="flex items-start justify-between">
        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</div>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + "16" }}>
          <Icon className="w-[18px] h-[18px]" style={{ color }} />
        </div>
      </div>
      <div className={`${sensitive ? "sensitive " : ""}text-[26px] leading-tight font-bold text-gray-900 mt-2 tabular-nums`}>{value}</div>
      <div className="flex items-center gap-1.5 mt-1.5 min-h-[18px]">
        {hasDelta && (
          <span className="inline-flex items-center gap-0.5 text-[12px] font-semibold" style={{ color: deltaColor }}>
            {up ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {Math.abs(delta as number).toFixed(0)}%
          </span>
        )}
        {sub && <span className="text-[12px] text-gray-400">{sub}</span>}
      </div>
    </div>
  );
}

export function CapacityCard({
  label, current, capacity, unit = "", icon: Icon, color = "#10B981",
  note, fullIsGood = true, sensitive = false, fmt, mocKyVong,
}: {
  label: string; current: number; capacity: number; unit?: string; icon: LucideIcon; color?: string;
  note?: string; fullIsGood?: boolean; sensitive?: boolean; fmt?: (n: number) => string;

  mocKyVong?: number | null;
}) {
  const { t: t } = getT();
  const ok = capacity > 0 && isFinite(current) && isFinite(capacity);
  const ratio = ok ? current / capacity : 0;
  const pct = Math.round(ratio * 100);

  const coMoc = mocKyVong != null && isFinite(mocKyVong) && mocKyVong > 0;
  const tyLeChamMau = coMoc ? current / (mocKyVong as number) : ratio;
  const barColor = !ok ? "#CBD5E1"
    : fullIsGood ? (tyLeChamMau >= 0.9 ? "#059669" : tyLeChamMau >= 0.6 ? "#F59E0B" : "#DC2626")
    : (tyLeChamMau >= 1 ? "#DC2626" : tyLeChamMau >= 0.8 ? "#F59E0B" : "#059669");
  const vachMoc = coMoc && ok ? Math.max(0, Math.min(100, ((mocKyVong as number) / capacity) * 100)) : null;

  const laPhanTram = unit.trim() === "%";
  const show = (n: number) => (fmt ? fmt(n) : String(n));
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] hover:shadow-[0_4px_12px_rgba(16,24,40,0.08)] transition-shadow">
      <div className="flex items-start justify-between">
        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</div>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + "16" }}>
          <Icon className="w-[18px] h-[18px]" style={{ color }} />
        </div>
      </div>
      <div className={`${sensitive ? "sensitive " : ""}text-[26px] leading-tight font-bold text-gray-900 mt-2 tabular-nums`}>
        {ok ? show(current) : "—"}
        <span className="text-[15px] font-semibold text-gray-400"> / {ok ? show(capacity) : "—"}{unit}</span>
      </div>
      <div className="relative mt-2 h-1.5 bg-gray-100 rounded-full">
        <div className="h-full rounded-full transition-[width]" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: barColor }} />
        {vachMoc != null && (
          <span className="absolute top-[-2px] h-[10px] w-[2px] rounded-full bg-gray-400" style={{ left: `${vachMoc}%` }} title={t("mốc cùng kỳ")} />
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-1.5 min-h-[18px]">
        {ok && !laPhanTram && <span className="text-[12px] font-semibold tabular-nums" style={{ color: barColor }}>{pct}%</span>}
        {note && <span className="text-[12px] text-gray-400">{note}</span>}
      </div>
    </div>
  );
}

export function Donut({
  segments, total, centerLabel, centerSub = "Tổng", size = 150, thickness = 22,
}: {
  segments: { label: string; value: number; color: string }[];
  total?: number; centerLabel?: string; centerSub?: string; size?: number; thickness?: number;
}) {
  const sum = total ?? segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const arcs = sum > 0 ? segments.map((s) => {
  const { t: t } = getT();
    const frac = s.value / sum;
    const dash = frac * circ;
    const el = (
      <circle key={t(s.label)} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
        strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-offset}
        transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="butt" />
    );
    offset += dash;
    return el;
  }) : [];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F1F5F9" strokeWidth={thickness} />
      {arcs}
      {centerLabel && (
        <>
          <text x={cx} y={cy - 4} textAnchor="middle" className="fill-gray-900" style={{ fontSize: 20, fontWeight: 700 }}>{centerLabel}</text>
          <text x={cx} y={cy + 15} textAnchor="middle" className="fill-gray-400" style={{ fontSize: 11 }}>{centerSub}</text>
        </>
      )}
    </svg>
  );
}

export function DonutLegend({ segments, sum, fmt }: { segments: { label: string; value: number; color: string }[]; sum: number; fmt?: (n: number) => string }) {
  return (
    <div className="flex-1 space-y-2 min-w-0">
      {segments.map((s) => {
  const { t: t } = getT();
        const pct = sum > 0 ? (s.value / sum) * 100 : 0;
        return (
          <div key={t(s.label)} className="flex items-center gap-2 text-[13px]">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-gray-600 truncate flex-1">{t(s.label)}</span>
            <span className="text-gray-400 tabular-nums">{pct.toFixed(0)}%</span>
            {fmt && <span className="sensitive text-gray-800 font-semibold tabular-nums w-20 text-right shrink-0">{fmt(s.value)}</span>}
          </div>
        );
      })}
    </div>
  );
}

export function MiniAreaChart({ points, color = "#10B981", height = 64, width = 640 }: { points: number[]; color?: string; height?: number; width?: number }) {
  const { t: t } = getT();
  if (!points.length) return <div className="text-xs text-gray-400 py-6 text-center">{t("Chưa có dữ liệu")}</div>;
  const max = Math.max(...points, 1);
  const stepX = points.length > 1 ? width / (points.length - 1) : width;
  const pad = 6;
  const y = (v: number) => height - pad - (v / max) * (height - pad * 2);
  const line = points.map((v, i) => `${i === 0 ? "M" : "L"} ${i * stepX} ${y(v)}`).join(" ");
  const area = `${line} L ${(points.length - 1) * stepX} ${height} L 0 ${height} Z`;
  const id = `spark-${color.replace("#", "")}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" className="block">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Pipeline({ stages }: { stages: { label: string; count: number; color: string }[] }) {
  const { t: t } = getT();
  return (
    <div className="flex items-stretch gap-1.5 overflow-x-auto pb-1">
      {stages.map((s, i) => (
        <div key={t(s.label)} className="flex items-center shrink-0">
          <div className="rounded-xl px-4 py-3 min-w-[120px]" style={{ background: s.color + "12", border: `1px solid ${s.color}22` }}>
            <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: s.color }}>{t(s.label)}</div>
            <div className="text-xl font-bold text-gray-900 mt-0.5 tabular-nums">{s.count}</div>
          </div>
          {i < stages.length - 1 && <span className="text-gray-300 px-1 text-lg">›</span>}
        </div>
      ))}
    </div>
  );
}

export function ActivityFeed({ items }: { items: { icon: string; text: string; time: string; href?: string; color?: string }[] }) {
  const { t: t } = getT();
  if (!items.length) return <div className="text-center py-8 text-gray-400 text-sm">{t("Chưa có hoạt động")}</div>;
  return (
    <div className="space-y-0.5">
      {items.map((it, i) => {
  const { t: t } = getT();
        const inner = (
          <div className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors">
            <span className="w-8 h-8 rounded-full flex items-center justify-center text-[15px] shrink-0" style={{ background: (it.color || "#10B981") + "16" }}>
              {it.icon ? it.icon : <span className="w-2 h-2 rounded-full" style={{ background: it.color || "#10B981" }} />}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] text-gray-700 leading-snug">{it.text}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">{it.time}</div>
            </div>
          </div>
        );
        return it.href ? <Link key={i} href={it.href} className="block">{inner}</Link> : <div key={i}>{inner}</div>;
      })}
    </div>
  );
}

export function Panel({ title, icon: Icon, iconColor = "#10B981", action, children, className = "" }: { title: string; icon?: LucideIcon; iconColor?: string; action?: { label: string; href: string }; children: React.ReactNode; className?: string }) {
  const { t: t } = getT();
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800 text-[15px] flex items-center gap-2">
          {Icon && <Icon className="w-[18px] h-[18px]" style={{ color: iconColor }} />}
          {title}
        </h3>
        {action && <Link href={action.href} className="text-[12px] text-gray-400 hover:text-gray-700 font-medium">{t(action.label)}</Link>}
      </div>
      {children}
    </div>
  );
}
