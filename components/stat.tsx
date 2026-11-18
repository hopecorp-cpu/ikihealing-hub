import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowUp, ArrowDown } from "lucide-react";

export function Stat({
  label, value, color = "#1a73e8", hint, icon: Icon, delta, deltaGoodWhenUp = true, sensitive,
}: {
  label: string;
  value: ReactNode;
  color?: string;
  hint?: ReactNode;
  icon?: LucideIcon;
  delta?: number;
  deltaGoodWhenUp?: boolean;
  sensitive?: boolean;
}) {
  const up = (delta ?? 0) >= 0;
  const good = up === deltaGoodWhenUp;
  const sv = sensitive ? "sensitive" : "";
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-xs text-gray-500 uppercase font-semibold tracking-wide">{label}</div>
        {Icon && (
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + "1a" }}>
            <Icon className="w-[18px] h-[18px]" style={{ color }} />
          </div>
        )}
      </div>
      <div className={`text-2xl font-bold leading-tight truncate ${sv}`} style={{ color }}>{value}</div>
      {delta !== undefined && (
        <div className={`inline-flex items-center gap-0.5 mt-1.5 text-xs font-semibold px-1.5 py-0.5 rounded-md ${good ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
          {up ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
          {Math.abs(delta).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%
        </div>
      )}
      {hint && <div className={`text-xs text-gray-400 mt-1 truncate ${sv}`}>{hint}</div>}
    </div>
  );
}
