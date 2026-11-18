import { getT } from "@/lib/i18n-server";
import "./globals.css";
import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AIAssistant } from "@/components/ai-assistant";
import { AttendanceReminder } from "@/components/attendance-reminder";
import { headers } from "next/headers";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isAdmin, isBodRole } from "@/lib/auth";
import { quyetDinhDuong } from "@/lib/bod-quyen";
import { getMyAttendanceReminderStatus } from "@/lib/attendance-status";
import { vnDateStr } from "@/lib/payroll";
import { getMyNewAssignedCount } from "@/lib/sale-suggestions";
import { getMySaleUrgent } from "@/lib/sale-urgent";
import { SaleAlertBar } from "@/components/sale-alert-bar";
import DungKhanCapBar from "@/components/dung-khan-cap-bar";
import { LangProvider } from "@/components/lang-provider";
import { getLocale } from "@/lib/i18n-server";

export function generateMetadata() {
  const { t } = getT();
  return {
  title: "IKIHEALING Hub",
  description: t("Quản trị nội bộ — Chấm công · Lương · KPI · Insights"),
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png"
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "ACME Corp" },
};
}

export const viewport = {
  themeColor: "#0B1F14",
  width: "device-width",
  initialScale: 1
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const duongDan = headers().get("x-acme-path") || "";
  if (user && duongDan && quyetDinhDuong(user.role, duongDan) === "cam") redirect("/?denied=bod");
  const khuRieng = duongDan === "/zalo" || duongDan.startsWith("/zalo/");
  const bod = !!user && isBodRole(user.role);

  const sbBadge = user ? getServiceClient() : null;
  const [attReminder, saleUrgent, myAssigned, onlineOrders, adminCounts] = await Promise.all([

    user && !bod ? getMyAttendanceReminderStatus() : Promise.resolve(null),

    user && !bod ? getMySaleUrgent(user).catch(() => null) : Promise.resolve(null),

    user ? getMyNewAssignedCount(user.id).catch(() => 0) : Promise.resolve(0),

    sbBadge
      ? Promise.resolve(sbBadge.from("orders").select("id", { count: "exact", head: true })
          .eq("source_platform", "salepage").in("status", ["pending", "confirmed"]))
          .then(({ count }) => count ?? 0).catch(() => 0)
      : Promise.resolve(0),

    sbBadge && user && isAdmin(user.role)
      ? Promise.all([
          sbBadge.from("leaves").select("id", { count: "exact", head: true }).eq("status", "pending"),
          sbBadge.from("attendance_correction_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),

          sbBadge.from("daily_reports").select("id", { count: "exact", head: true })
            .eq("report_date", vnDateStr()).neq("status", "reviewed"),
        ]).then(([lv, cr, rp]) => ({ leaves: lv.count ?? 0, corrections: cr.count ?? 0, reports: rp.count ?? 0 })).catch(() => null)
      : Promise.resolve(null),
  ]);

  const badges = adminCounts
    ? { ...adminCounts, total: adminCounts.leaves + adminCounts.corrections + adminCounts.reports, myAssigned, onlineOrders }
    : { leaves: 0, corrections: 0, reports: 0, total: 0, myAssigned, onlineOrders };

  const locale = getLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem("acme_theme")!=="light")document.documentElement.classList.add("dark")}catch(e){document.documentElement.classList.add("dark")}` }} />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" href="/favicon.png" />
      </head>
      <body>
        <LangProvider locale={locale}>
          {user && khuRieng ? (

            <>
              {children}
              <AIAssistant user={user} />
            </>
          ) : user ? (
            <>
              <AppShell user={user} badges={badges}>
                <DungKhanCapBar />
                <SaleAlertBar data={saleUrgent} />
                <AttendanceReminder status={attReminder} />
                {children}
              </AppShell>
              <AIAssistant user={user} />
            </>
          ) : (
            <main className="min-h-screen flex items-center justify-center">{children}</main>
          )}
        </LangProvider>
      </body>
    </html>
  );
}
