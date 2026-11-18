import { requireAdmin } from "@/lib/auth-server";
import { getT } from "@/lib/i18n-server";
import { getUsersForContractDropdown } from "../actions";
import { getServiceClient } from "@/lib/supabase-server";
import { NewContractForm } from "./client";

export const dynamic = "force-dynamic";

export default async function NewContractPage({ searchParams }: { searchParams: { user?: string } }) {
  await requireAdmin();
  const { t } = getT();
  const users = await getUsersForContractDropdown();
  const sb = getServiceClient();
  const { data: depts } = await sb.from("departments").select("id, name").order("name");

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">{t("Tạo hợp đồng lao động mới")}</h1>
      <NewContractForm users={users} departments={depts ?? []} preSelectedUserId={searchParams.user || null} />
    </div>
  );
}
