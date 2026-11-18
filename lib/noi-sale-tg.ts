import { createHmac, timingSafeEqual } from "crypto";

function ky(id32: string): string {
  const khoa = (process.env.CRON_SECRET || "").trim();
  if (!khoa) return "";
  return createHmac("sha256", `noi-sale-tg:${khoa}`).update(id32).digest("hex").slice(0, 16);
}

export function maNoiSale(userId: string): string {
  const id32 = userId.replace(/-/g, "").toLowerCase();
  const sig = ky(id32);
  return sig ? `${id32}_${sig}` : "";
}

export function giaiMaNoiSale(ma: string): string | null {
  const m = /^([0-9a-f]{32})_([0-9a-f]{16})$/i.exec(ma.trim());
  if (!m) return null;
  const id32 = m[1].toLowerCase();
  const dung = ky(id32);
  if (!dung) return null;
  const a = Buffer.from(dung), b = Buffer.from(m[2].toLowerCase());
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return `${id32.slice(0, 8)}-${id32.slice(8, 12)}-${id32.slice(12, 16)}-${id32.slice(16, 20)}-${id32.slice(20)}`;
}
