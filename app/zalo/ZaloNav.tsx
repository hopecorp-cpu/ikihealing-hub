"use client";

import { useLang } from "@/components/lang-provider";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard, MessageSquare, Users, UsersRound, Megaphone, Radio,
  BarChart3, CheckSquare, GitBranch, Package, CalendarClock, Settings, ArrowLeft, ChevronDown, LogOut, Search, Smartphone, X, QrCode, FileText,
} from "lucide-react";

const MENU = [
  { href: "/zalo", label: "Tổng quan", icon: LayoutDashboard, chinhXac: true },
  { href: "/zalo/khach-hang", label: "Khách hàng", icon: Users },
  { href: "/zalo/tin-nhan", label: "Tin nhắn", icon: MessageSquare, badgeKey: "tinNhan" as const },
  { href: "/zalo/nhom", label: "Nhóm cộng đồng", icon: UsersRound },
  { href: "/seeding", label: "Broadcast", icon: Radio },
  { href: "/bao-cao-sale", label: "Báo cáo", icon: BarChart3 },
  { href: "/quy-trinh", label: "Workflow", icon: GitBranch },
  { href: "/lich-chien-dich", label: "Chiến dịch", icon: Megaphone },
  { href: "/ket-cau-ban-hang", label: "Sản phẩm", icon: Package },
  { href: "/lich-tu-van", label: "Lịch hẹn", icon: CalendarClock },
  { href: "/tasks", label: "Công việc", icon: CheckSquare, badgeKey: "viec" as const },
  { href: "/zalo/mau-tin", label: "Mẫu tin nhanh", icon: FileText },
  { href: "/zalo/ket-noi", label: "Kết nối Zalo", icon: QrCode },
  { href: "/admin/accounts", label: "Cấu hình", icon: Settings },
];

export default function ZaloNav({
  ten, chucVu, online, badge, nick = [],
}: {
  ten: string; chucVu?: string | null; online: boolean;
  badge: { tinNhan: number; viec: number };

  nick?: Array<{ ownId: string; sale: string | null; tenZalo: string | null; song: boolean | null }>;
}) {
  const { t: t } = useLang();
  const duong = usePathname() || "";
  return (
    <aside className="hidden h-screen w-[13.5rem] shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
      <Link href="/zalo" className="flex items-center gap-2.5 px-4 py-4">
        <Image src="/logo/acme-mark.svg" alt="NOVA" width={36} height={36} className="h-9 w-9 rounded-xl object-contain" priority />
        <span className="leading-tight">
          <span className="block text-base font-bold tracking-tight text-[#0068FF]">Zalo CRM</span>
          <span className="block text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">NOVA by ACME</span>
        </span>
      </Link>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5">
        {MENU.map(({ href, label, icon: Icon, chinhXac, badgeKey }) => {
          const dangMo = chinhXac ? duong === href : duong.startsWith(href);
          const so = badgeKey ? badge[badgeKey] : 0;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] transition ${
                dangMo ? "bg-[#EAF2FF] font-semibold text-[#0068FF]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className={`h-[18px] w-[18px] shrink-0 ${dangMo ? "text-[#0068FF]" : "text-slate-400"}`} />
              <span className="flex-1">{label}</span>
              {so > 0 && (
                <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                  {so > 99 ? "99+" : so}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 px-3 py-3">
        {nick.length > 0 && (
          <div className="mb-2 rounded-lg bg-slate-50 px-2.5 py-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t("Zalo đang nối (")}{nick.length})</p>
            <ul className="space-y-1">
              {nick.map((n) => (
                <li key={n.ownId} className="flex items-center gap-2 text-xs" title={n.tenZalo || n.ownId}>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${n.song === false ? "bg-rose-500" : n.song ? "bg-emerald-500" : "bg-slate-300"}`} />
                  <span className="min-w-0 flex-1 truncate text-slate-700">
                    {n.sale || n.tenZalo || n.ownId}
                    {n.sale && n.tenZalo && <span className="text-slate-400"> · {n.tenZalo}</span>}
                  </span>
                  <span className="ml-auto shrink-0 text-[10px] text-slate-400">{n.song === false ? "OFF" : n.song ? "OK" : "?"}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
          <span className={`h-2 w-2 rounded-full ${online ? "bg-emerald-500" : "bg-amber-500"}`} />
          {online ? "Online" : t("Kho đang cũ")}
          <span className="ml-auto text-slate-300">···</span>
        </div>
        <div className="flex items-center gap-2.5 px-1">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white">
            {ten.split(/\s+/).slice(-2).map((w) => w[0]).join("").toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[13px] font-semibold text-slate-900">{ten}</span>
            <span className="block truncate text-[11px] text-slate-500">{chucVu || t("Tài khoản Business")}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        </div>
        <Link href="/" className="mt-2 flex items-center gap-1.5 px-1 text-[11px] text-slate-400 hover:text-slate-600">
          <ArrowLeft className="h-3 w-3" /> {t("Về Ops Hub")}
        </Link>
      </div>
    </aside>
  );
}

export function ZaloThanhTop({ ten }: { ten: string }) {
  const { t: t } = useLang();
  const [moDienThoai, setMoDienThoai] = useState(false);
  const duong = usePathname() || "/zalo";
  const qs = useSearchParams()?.toString();
  const src = `${duong}${qs ? `?${qs}` : ""}`;
  return (<>
    <header className="hidden h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:flex">
      <form action="/zalo/khach-hang" method="get" className="relative w-full max-w-xl">
        <input
          name="q"
          placeholder={t("Tìm kiếm hội thoại, khách hàng, số điện thoại...")}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-16 text-sm outline-none focus:border-[#0068FF] focus:bg-white"
        />
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-400">Enter</kbd>
      </form>
      <span className="ml-auto text-xs text-slate-500">{ten}</span>
      <button
        type="button"
        onClick={() => setMoDienThoai((v) => !v)}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${moDienThoai ? "border-[#0068FF] bg-[#EAF2FF] text-[#0068FF]" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
        title={t("Xem bản điện thoại của đúng trang này")}
      >
        <Smartphone className="h-4 w-4" /> {t("Điện thoại")}
      </button>
      <Link href="/" className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600" title={t("Về Ops Hub")}>
        <LogOut className="h-4 w-4" />
      </Link>
    </header>
    {moDienThoai && (
      <aside className="fixed bottom-0 right-0 top-14 z-40 hidden w-[27rem] flex-col items-center border-l border-slate-200 bg-slate-100/95 px-4 pt-3 backdrop-blur lg:flex">
        <div className="mb-2 flex w-full items-center justify-between text-xs text-slate-500">
          <span>{t("Bản điện thoại ·")} {duong}</span>
          <button type="button" onClick={() => setMoDienThoai(false)} className="rounded p-1 hover:bg-slate-200" title={t("Đóng")}><X className="h-4 w-4" /></button>
        </div>
        <div className="relative h-[min(844px,calc(100vh-7rem))] w-[390px] overflow-hidden rounded-[2.5rem] border-[10px] border-slate-900 bg-white shadow-2xl">
          <div className="pointer-events-none absolute left-1/2 top-0 z-10 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-slate-900" />
          <iframe key={src} src={src} title={t("Bản điện thoại")} className="h-full w-full border-0" />
        </div>
      </aside>
    )}
  </>);
}
