import { requireUser } from "@/lib/auth-server";
import { isManagerOrAbove } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getServiceClient } from "@/lib/supabase-server";
import { listTemplates } from "./actions";
import { listDepartmentsWithMembers } from "../actions";
import { RecurringClient } from "./client";
import { Repeat } from "lucide-react";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function RecurringTasksPage() {
  const user = await requireUser();
  if (!isManagerOrAbove(user.role)) redirect("/tasks");

  const sb = getServiceClient();
  const [templates, { data: users }, departments] = await Promise.all([
    listTemplates(),
    sb.from("users").select("id, full_name, position").eq("active", true).order("full_name"),
    listDepartmentsWithMembers(),
  ]);

  const { t } = getT();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Repeat className="w-6 h-6 text-brand-600" /> {t("Task lặp lại tự động")}
        </h1>
        <a href="/tasks" className="text-sm text-brand-600 hover:underline">{t("← Về Task Board")}</a>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
        <b>{t("Cách dùng:")}</b> {t("Tạo template task lặp lại (vd: \"Báo cáo cuối ngày\" mỗi T2–T6).")}
        {t("Hệ thống tự động sinh task mỗi sáng 06:00. Bấm")} <b>{t("\"Generate ngay\"")}</b> {t("để chạy thử.")}
      </div>

      <RecurringClient templates={templates} users={users ?? []} departments={departments} />
    </div>
  );
}
