"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "./lang-provider";
import {
  LayoutGrid, Rocket, ClipboardList, Users, ShoppingCart, Phone, Headset, Circle,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  overview: LayoutGrid, start: Rocket, checklist: ClipboardList,
  customers: Users, orders: ShoppingCart, phone: Phone, assist: Headset,
};
export type HubTab = { href: string; label: string; iconKey: string };

export function HubTabs({ tabs, rootHref }: { tabs: HubTab[]; rootHref?: string }) {
  const { t } = useLang();
  const pathname = usePathname();
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-1 flex gap-1 overflow-x-auto mb-4">
      {tabs.map((tab) => {

        const active = tab.href === rootHref
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(tab.href + "/");
        const Icon = ICONS[tab.iconKey] || Circle;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 whitespace-nowrap ${
              active
                ? "bg-gradient-to-r from-[#0B1F14] to-[#143020] text-[#F5C518] shadow"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Icon className="w-4 h-4" /> {t(tab.label)}
          </Link>
        );
      })}
    </div>
  );
}
