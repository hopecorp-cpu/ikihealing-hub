"use client";
import { ReactNode, useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import type { AppUser } from "@/lib/supabase-client";

export function AppShell({ user, badges, children }: { user: AppUser; badges?: any; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} badges={badges} open={open} onClose={() => setOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={user} onToggleSidebar={() => setOpen(true)} />
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
