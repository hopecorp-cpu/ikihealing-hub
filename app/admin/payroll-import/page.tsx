import { requireAdmin, tuChoiBod } from "@/lib/auth-server";
import { PayrollImportClient } from "./client";

export const dynamic = "force-dynamic";

export default async function PayrollImportPage() {
  tuChoiBod(await requireAdmin());
  return <PayrollImportClient />;
}
