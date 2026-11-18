import { LucideIcon } from "lucide-react";

export function StatCard({ label, value, icon: Icon, sub }: { label: string; value: string | number; icon: LucideIcon; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</div>
        <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center">
          <Icon className="w-4 h-4 text-brand-600" />
        </div>
      </div>
      <div className="text-3xl font-bold text-gray-900 mt-3">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}
