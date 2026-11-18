import { requireAdmin } from "@/lib/auth-server";
import { getT } from "@/lib/i18n-server";
import { getContract } from "../../actions";
import { getServiceClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { EditContractForm } from "./client";

export const dynamic = "force-dynamic";

export default async function EditContractPage({ params }: { params: { id: string } }) {
  await requireAdmin();
  const { t } = getT();
  const contract = await getContract(params.id);
  if (!contract) redirect("/admin/contracts");

  const sb = getServiceClient();
  const { data: depts } = await sb.from("departments").select("id, name").order("name");

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">{t("Sửa hợp đồng —")} {contract.contract_number}</h1>
      <EditContractForm contract={contract} departments={depts ?? []} />
    </div>
  );
}
