import { requireAdmin, tuChoiBod } from "@/lib/auth-server";
import { getSecretsForAdmin } from "./actions";
import { ApiKeysClient } from "./client";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  tuChoiBod(await requireAdmin());
  const { ready, hasKey, rows } = await getSecretsForAdmin();
  return <ApiKeysClient rows={rows} ready={ready} hasKey={hasKey} />;
}
