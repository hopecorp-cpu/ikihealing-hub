import { requireAdmin } from "@/lib/auth-server";
import { getContract } from "../actions";
import { ContractDetailClient } from "./client";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ContractDetailPage({ params }: { params: { id: string } }) {
  await requireAdmin();
  const contract = await getContract(params.id);
  if (!contract) redirect("/admin/contracts");
  return <ContractDetailClient contract={contract} />;
}
