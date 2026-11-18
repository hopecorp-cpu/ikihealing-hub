"use server";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { getOffers, saveOffers, computeOfferEconomics, DEFAULT_OFFERS, type Offer } from "@/lib/offer-architecture";
import { revalidatePath } from "next/cache";

export async function listOffers() {
  const { offers, fromConfig } = await getOffers();
  const eco = await computeOfferEconomics(offers);
  return { offers, fromConfig, eco };
}

export async function setOfferStatus(code: string, status: "draft" | "chot"): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user || !isManagerOrAbove(user.role)) return { ok: false, error: "Không có quyền" };
    const { offers } = await getOffers();
    const next = offers.map(o => o.code === code ? { ...o, status } : o);
    await saveOffers(next, user.full_name || user.id);
    revalidatePath("/ket-cau-ban-hang");
    return { ok: true };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}

export async function saveOffersJson(json: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user || !isManagerOrAbove(user.role)) return { ok: false, error: "Không có quyền" };
    const arr = JSON.parse(json);
    if (!Array.isArray(arr) || !arr.length) return { ok: false, error: "JSON phải là mảng offer" };
    for (const o of arr) {
      if (!o.code || !o.ten || !o.loai) return { ok: false, error: `Offer thiếu code/ten/loai: ${JSON.stringify(o).slice(0, 80)}` };
      if (typeof o.gia_niem_yet !== "number" || o.gia_niem_yet < 0) return { ok: false, error: `Giá không hợp lệ ở ${o.code}` };
      if (!Array.isArray(o.qua_tang)) o.qua_tang = [];
      if (!Array.isArray(o.ruot)) o.ruot = [];
      if (o.status !== "chot") o.status = "draft";
      if (/cost|gia_von|giá vốn/i.test(JSON.stringify(o))) return { ok: false, error: `KHÔNG được nhét giá vốn vào offer (${o.code}) — biên tính runtime.` };
    }
    await saveOffers(arr as Offer[], user.full_name || user.id);
    revalidatePath("/ket-cau-ban-hang");
    return { ok: true };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}

export async function resetToDefault(): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user || !isManagerOrAbove(user.role)) return { ok: false, error: "Không có quyền" };
    await saveOffers(DEFAULT_OFFERS, user.full_name || user.id);
    revalidatePath("/ket-cau-ban-hang");
    return { ok: true };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}
