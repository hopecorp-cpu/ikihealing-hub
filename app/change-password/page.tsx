import { requireUser } from "@/lib/auth-server";
import { ChangePasswordForm } from "./client";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const user = await requireUser();
  return <ChangePasswordForm email={user.email} name={user.full_name} />;
}
