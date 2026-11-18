import { requireManager } from "@/lib/auth-server";

export default async function InsightsLayout({ children }: { children: React.ReactNode }) {

  await requireManager();
  return <>{children}</>;
}
