import { isManagerOrAbove, isSalePosition } from "@/lib/auth";

export function canProcessOnlineOrders(user: any): boolean {
  if (!user) return false;
  if (isManagerOrAbove(user.role)) return true;
  if (isSalePosition(user.position)) return true;
  return /kho|warehouse|h[oỗ]\s*tr[oợ]/i.test(user.position || "");
}
