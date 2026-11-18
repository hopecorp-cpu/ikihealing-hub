import { requireUser } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { isAdmin, FINANCE_WHITELIST } from "@/lib/auth";

export default async function DoanhThuLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const email = user.email?.toLowerCase().trim() || "";
  if (!isAdmin(user.role) && !FINANCE_WHITELIST.includes(email)) {
    redirect("/?denied=finance_restricted");
  }
  return <>{children}</>;
}
