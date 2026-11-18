import { getServiceClient } from "@/lib/supabase-server";
import { chuanHoaTenKhach, maskPIIVoiTen } from "./pii";

const SO_DON = 500;
const CACHE_MS = 10 * 60e3;

let cache: { ten: string[]; luc: number } | null = null;

export async function danhSachTenKhach(): Promise<string[]> {
  if (cache && Date.now() - cache.luc < CACHE_MS) return cache.ten;
  try {
    const { data, error } = await getServiceClient()
      .from("tg_orders")
      .select("khach")
      .order("ngay", { ascending: false })
      .limit(SO_DON);
    if (error) throw error;
    const ten = [...new Set((data || []).map((r) => chuanHoaTenKhach(r.khach)).filter((x): x is string => !!x))];
    cache = { ten, luc: Date.now() };
    return ten;
  } catch {

    return cache?.ten ?? [];
  }
}

export async function maskPIIDay(text: string): Promise<string> {
  if (!text) return text;
  return maskPIIVoiTen(text, await danhSachTenKhach());
}
