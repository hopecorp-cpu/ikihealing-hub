import { requireAdmin } from "@/lib/auth-server";
import { getSaleUsers } from "./actions";
import { ImportWizard } from "./client";

export const dynamic = "force-dynamic";

export default async function ImportOrdersPage() {
  await requireAdmin();
  const sales = await getSaleUsers();
  return <ImportWizard sales={sales} />;
}
