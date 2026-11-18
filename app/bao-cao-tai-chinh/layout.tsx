import { requireUser } from "@/lib/auth-server";
import { inFinanceWL, isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function BaoCaoTaiChinhLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!isAdmin(user.role) && !inFinanceWL(user.email)) redirect("/?denied=finance_restricted");
  return <>{children}</>;
}
