"use client";
import { LogOut, RefreshCw, Menu, Key } from "lucide-react";
import { getBrowserClient, type AppUser } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { NotificationBell } from "./notification-bell";
import { PushToggle } from "./push-toggle";
import { LangToggle } from "./lang-toggle";
import { PrivacyToggle } from "./privacy-toggle";
import { ThemeToggle } from "./theme-toggle";
import { CommandPalette } from "./command-palette";
import { useLang } from "./lang-provider";

export function Topbar({ user, onToggleSidebar }: { user: AppUser; onToggleSidebar?: () => void }) {
  const router = useRouter();
  const { t } = useLang();

  const logout = async () => {
    const sb = getBrowserClient();
    await sb.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="h-14 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-4 md:px-6 sticky top-0 z-30">
      <div className="flex items-center gap-2 text-gray-500">
        {onToggleSidebar && (
          <button onClick={onToggleSidebar} className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition">
            <Menu className="w-5 h-5" />
          </button>
        )}
        <button onClick={() => router.refresh()} title={t("Làm mới")} className="p-2 hover:bg-gray-100 rounded-lg hidden md:block transition text-gray-500 hover:text-gray-700">
          <RefreshCw className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium text-gray-700 hidden md:inline">{user.full_name}</span>
        <CommandPalette user={user} />
      </div>
      <div className="flex items-center gap-1">
        <PrivacyToggle />
        <ThemeToggle />
        <LangToggle />
        <PushToggle user={user} />
        <NotificationBell />
        <div className="w-px h-5 bg-gray-200 mx-1 hidden md:block" />
        <Link href="/change-password" className="p-2 hover:bg-gray-100 rounded-lg transition" title={t("Đổi mật khẩu")}>
          <Key className="w-4 h-4 text-gray-600" />
        </Link>
        <button onClick={logout} className="p-2 hover:bg-red-50 hover:text-red-600 rounded-lg transition text-gray-600" title={t("Đăng xuất")}>
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
