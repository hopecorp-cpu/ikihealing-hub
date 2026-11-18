import { getServiceClient } from "@/lib/supabase-server";
import { layNick } from "@/lib/hop-thu-zalo-server";
import type { HopThuNick } from "@/lib/hop-thu-zalo";
import { isManagerOrAbove } from "@/lib/auth";

export type NickOff = HopThuNick & { slug: string | null };

async function bangSlug(): Promise<Record<string, string>> {
  const sb = getServiceClient();
  const { data } = await sb.from("config").select("value").eq("key", "zalo_bridge_nick").maybeSingle();
  const ra: Record<string, string> = {};
  try {
    for (const [ownId, v] of Object.entries(JSON.parse(data?.value || "{}") as Record<string, any>)) {
      const slug = String(v?.nick || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
      if (ownId && slug) ra[ownId] = slug;
    }
  } catch {  }
  return ra;
}

function doanSlug(sale: string | null): string | null {
  const cuoi = String(sale || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").split(/\s+/).pop() || "";
  if (!cuoi || cuoi.length > 20) return null;
  return cuoi.replace(/[^a-z0-9-]/g, "") || null;
}

export async function nickOffCuaUser(user: {
  role?: string | null; full_name?: string | null;
} | null): Promise<NickOff[]> {
  if (!user) return [];
  const [nick, slugMap] = await Promise.all([layNick(), bangSlug()]);
  const role = String(user.role || "").toLowerCase();
  const quanLy = role === "admin" || role === "ceo" || isManagerOrAbove(user.role);
  const ten = String(user.full_name || "").trim().toLowerCase();
  const off = nick.filter((n) => n.song === false);
  const cuaToi = quanLy ? off : off.filter((n) => String(n.sale || "").trim().toLowerCase() === ten);
  return cuaToi.map((n) => ({
    ...n,
    slug: slugMap[n.ownId] || doanSlug(n.sale),
  }));
}

export async function duocXinReconnect(
  user: { role?: string | null; full_name?: string | null } | null,
  slug: string,
): Promise<boolean> {
  if (!user) return false;
  const role = String(user.role || "").toLowerCase();
  if (role === "admin" || role === "ceo" || isManagerOrAbove(user.role)) return true;

  const [nick, slugMap] = await Promise.all([layNick(), bangSlug()]);
  const ten = String(user.full_name || "").trim().toLowerCase();
  const cuaToi = nick.filter((n) => String(n.sale || "").trim().toLowerCase() === ten);
  const slugs = new Set(
    cuaToi.map((n) => slugMap[n.ownId] || doanSlug(n.sale)).filter(Boolean) as string[],
  );
  return slugs.has(slug);
}
