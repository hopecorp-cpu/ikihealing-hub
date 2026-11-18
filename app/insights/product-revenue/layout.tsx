import { requireUser } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { isAdmin, BOD_EMAILS } from "@/lib/auth";

export default async function ProductRevenueLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const email = user.email?.toLowerCase().trim() || "";
  if (!isAdmin(user.role) && !BOD_EMAILS.includes(email)) {
    redirect("/?denied=product_revenue_restricted");
  }
  return <>{children}</>;
}
