import { createHmac, timingSafeEqual } from "crypto";

export function chuKyFbHopLe(raw: string, header: string | null | undefined, appSecret: string | null | undefined): boolean {
  const khoa = (appSecret || "").trim();
  const sig = header || "";
  if (!khoa || !sig) return false;
  const dung = "sha256=" + createHmac("sha256", khoa).update(raw).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(dung);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
