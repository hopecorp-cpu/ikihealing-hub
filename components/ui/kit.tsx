import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function Card({ children, className = "", padding = true }: { children: ReactNode; className?: string; padding?: boolean }) {
  return <div className={`bg-white border border-gray-200 rounded-2xl shadow-sm ${padding ? "p-5" : ""} ${className}`}>{children}</div>;
}

export function SectionCard({ title, desc, right, children, className = "" }: { title?: ReactNode; desc?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-2xl shadow-sm ${className}`}>
      {(title || right) && (
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-gray-100">
          <div>
            {title && <div className="font-bold text-gray-900">{title}</div>}
            {desc && <div className="text-xs text-gray-500 mt-0.5">{desc}</div>}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, color = "#10B981", hint, trend }: {
  label: string; value: ReactNode; icon?: LucideIcon; color?: string; hint?: ReactNode;
  trend?: { dir: "up" | "down" | "flat"; text: string };
}) {
  const trendColor = trend?.dir === "up" ? "#10B981" : trend?.dir === "down" ? "#EF4444" : "#9CA3AF";
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] text-gray-500 uppercase font-semibold tracking-wide">{label}</div>
        {Icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + "1A" }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
        )}
      </div>
      <div className="text-2xl font-bold tracking-tight" style={{ color }}>{value}</div>
      {(hint || trend) && (
        <div className="flex items-center gap-2 mt-1">
          {trend && <span className="text-[11px] font-semibold" style={{ color: trendColor }}>{trend.dir === "up" ? "▲" : trend.dir === "down" ? "▼" : "→"} {trend.text}</span>}
          {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
        </div>
      )}
    </div>
  );
}

const BADGE: Record<string, string> = {
  gray: "bg-gray-100 text-gray-600",
  green: "bg-emerald-50 text-emerald-700",
  blue: "bg-blue-50 text-blue-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  violet: "bg-violet-50 text-violet-700",
  slate: "bg-slate-100 text-slate-600",
};
export function Badge({ children, tone = "gray", dot = false, className = "" }: { children: ReactNode; tone?: keyof typeof BADGE | string; dot?: boolean; className?: string }) {
  const dotColor: Record<string, string> = { gray: "#9CA3AF", green: "#10B981", blue: "#3B82F6", amber: "#F59E0B", red: "#EF4444", violet: "#8B5CF6", slate: "#64748B" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${BADGE[tone] || BADGE.gray} ${className}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dotColor[tone] || dotColor.gray }} />}
      {children}
    </span>
  );
}

export function PageHeader({ title, subtitle, icon: Icon, iconColor = "#10B981", actions }: {
  title: ReactNode; subtitle?: ReactNode; icon?: LucideIcon; iconColor?: string; actions?: ReactNode;
}) {
  return (
    <div className="flex justify-between items-start flex-wrap gap-3">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2.5 text-gray-900">
          {Icon && <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: iconColor + "1A" }}><Icon className="w-5 h-5" style={{ color: iconColor }} /></span>}
          {title}
        </h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1" style={{ marginLeft: Icon ? 46 : 0 }}>{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Toolbar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-wrap items-center gap-2 ${className}`}>{children}</div>;
}

export function EmptyState({ icon: Icon, title, desc }: { icon?: LucideIcon; title: string; desc?: string }) {
  return (
    <div className="text-center py-12 px-4">
      {Icon && <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3"><Icon className="w-6 h-6 text-gray-400" /></div>}
      <div className="text-sm font-semibold text-gray-600">{title}</div>
      {desc && <div className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">{desc}</div>}
    </div>
  );
}
