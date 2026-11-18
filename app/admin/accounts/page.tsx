import { getPlatformAccounts } from "./actions";
import { AccountsClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const { ready, rows, hasKey } = await getPlatformAccounts();
  return <AccountsClient rows={rows} ready={ready} hasKey={hasKey} />;
}
