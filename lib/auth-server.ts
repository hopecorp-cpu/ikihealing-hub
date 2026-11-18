import { redirect } from "next/navigation";
import { getCurrentUser } from "./supabase-server";
import type { AppUser } from "./supabase-types";
import { isAdmin, isBodRole, isManagerOrAbove } from "./auth";

export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<AppUser> {
  const user = await requireUser();
  if (!isAdmin(user.role)) redirect("/?denied=admin");
  return user;
}

export async function requireManager(): Promise<AppUser> {
  const user = await requireUser();
  if (!isManagerOrAbove(user.role)) redirect("/?denied=manager");
  return user;
}

export async function requireBaoCaoChung(): Promise<AppUser> {
  const user = await requireUser();
  if (!isManagerOrAbove(user.role) && !isBodRole(user.role)) redirect("/?denied=baocao");
  return user;
}

export function tuChoiBod(user: { role?: string | null } | null | undefined): void {
  if (user && isBodRole(user.role)) redirect("/?denied=bod");
}
