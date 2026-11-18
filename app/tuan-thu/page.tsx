import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { canViewTuanThu, canManageDataroom, isFullTruInvestor } from "@/lib/auth";
import { CHECKLIST, getCompliance, computeStatus } from "@/lib/compliance";
import { detectCompliance } from "@/lib/compliance-auto";
import { getT } from "@/lib/i18n-server";
import ComplianceClient from "./ComplianceClient";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Tuân thủ pháp lý | ACME Ops Hub") };
}

export default async function CompliancePage() {
  const { t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canViewTuanThu(user)) redirect("/?denied=tuanthu");
  const canEdit = canManageDataroom(user as any) || isFullTruInvestor(user.email);

  const c = await getCompliance();
  const summary = computeStatus(c);

  const sb = getServiceClient();
  const auto = await detectCompliance(sb).catch(() => ({}));

  const autoFillable = Object.keys(auto).filter(k => {
    const cur = (c.items as any)[k];
    return !cur?.status || cur?.reviewedBy === "auto";
  }).length;

  let staff: { email: string; name: string }[] = [];
  if (canEdit) {
    const { data } = await sb.from("users").select("email, full_name").eq("active", true).order("full_name");
    staff = (data ?? []).filter(u => u.email).map(u => ({ email: u.email.toLowerCase().trim(), name: u.full_name || u.email }));
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">{t("Checklist tuân thủ pháp lý")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("Rà soát hồ sơ pháp lý nội bộ · nhân sự · tài chính-thuế · điều kiện kinh doanh. Đánh dấu trạng thái + gắn tài liệu + giao người phụ trách.")}{c.updatedAt ? ` · ${t("cập nhật")} ${c.updatedAt.slice(0, 10)}` : ""}</p>
      </div>
      <ComplianceClient pillars={CHECKLIST.pillars} statuses={CHECKLIST.statuses} items={c.items} summary={summary} staff={staff} canEdit={canEdit} auto={auto} autoFillable={autoFillable} />
    </div>
  );
}
