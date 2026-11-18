import { requireUser, tuChoiBod } from "@/lib/auth-server";
import { redirect } from "next/navigation";

export const ACCOUNTS_WHITELIST = (process.env.ACCOUNTS_VAULT_EMAILS || "")
  .split(",").map(e => e.trim()).filter(Boolean);

export default async function AccountsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  tuChoiBod(user);
  const email = user.email?.toLowerCase().trim() || "";
  if (!ACCOUNTS_WHITELIST.map(e => e.toLowerCase()).includes(email)) {
    redirect("/?denied=accounts_restricted");
  }
  return <>{children}</>;
}
