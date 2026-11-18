import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove, canManageDataroom } from "@/lib/auth";
import { getEmails, getRouting, getEmailLatest, CATS } from "@/lib/gmail";
import { getT } from "@/lib/i18n-server";
import EmailClient from "./EmailClient";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Email công ty | ACME Ops Hub") };
}

export default async function EmailPage() {
  const { t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const manager = isManagerOrAbove(user.role) || canManageDataroom(user as any);
  const myEmail = (user.email || "").toLowerCase().trim();

  const [emails, routing, latest] = await Promise.all([getEmails(), getRouting(), getEmailLatest()]);
  const visible = manager ? emails : emails.filter(e => (e.assignee || "").toLowerCase().trim() === myEmail);

  let staff: { email: string; name: string }[] = [];
  if (manager) {
    const sb = getServiceClient();
    const { data } = await sb.from("users").select("email, full_name").eq("active", true).order("full_name");
    staff = (data ?? []).filter(u => u.email).map(u => ({ email: u.email.toLowerCase().trim(), name: u.full_name || u.email }));
  }

  if (!manager && visible.length === 0) {
    return (
      <div className="max-w-3xl mx-auto mt-10 bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-8 text-center text-gray-500">
        <div className="text-4xl mb-3"></div>
        <h1 className="text-lg font-bold text-gray-800">{t("Chưa có email nào được giao cho bạn")}</h1>
        <p className="mt-1 text-sm">{t("Khi có email cần bạn xử lý, hệ thống sẽ thông báo qua chuông .")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">{t("Email công ty")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {manager ? t("Phân loại + giao người phụ trách email đổ về hộp thư chung.") : t("Email được giao cho bạn xử lý.")}
          {latest?.generatedAt ? ` · ${t("cập nhật")} ${String(latest.generatedAt).slice(0, 16).replace("T", " ")}` : ""}
        </p>
      </div>
      <EmailClient emails={visible} routing={routing} staff={staff} manager={manager} myEmail={myEmail} cats={CATS} />
    </div>
  );
}
