import { getServiceClient } from "@/lib/supabase-server";
import { getConfigValue } from "@/lib/app-config";
import { gopLichSu, type MucGui } from "./email-nhip-luat";
import { lichSuChuoi, type LeadLuat } from "./blog-nurture-luat";

export const BANG = "email_gui_nhat_ky";
export const chuanEmail = (e: string) => (e || "").trim().toLowerCase();

export type SoCoSan = { leads?: LeadLuat[]; soMoi?: Record<string, { at?: string }>; now?: number };

export function tuSoMoiMuaDau(soMoi: Record<string, { at?: string }> | null | undefined, email: string): MucGui[] {
  const m = soMoi?.[email];
  const t = m?.at ? Date.parse(m.at) : NaN;
  return Number.isFinite(t) ? [{ luc: t, luong: "thu-moi-mua-dau", mau: "moi-mua-dau", neuSanPham: true }] : [];
}

export async function layLichSuGui(email: string, co: SoCoSan = {}): Promise<MucGui[] | null> {
  const norm = chuanEmail(email);
  const now = co.now ?? Date.now();
  const sb = getServiceClient();
  const { data, error } = await sb.from(BANG).select("gui_luc,luong,mau,neu_san_pham").eq("email_chuan", norm).order("gui_luc", { ascending: false }).limit(200);
  if (error) { console.error("[email-nhip] khong doc duoc nhat ky gui:", error.message); return null; }
  const bang: MucGui[] = (data || []).map((r: any) => ({ luc: Date.parse(r.gui_luc), luong: String(r.luong), mau: String(r.mau), neuSanPham: !!r.neu_san_pham }));
  let soMoi = co.soMoi;
  if (soMoi === undefined) { try { soMoi = JSON.parse((await getConfigValue("thu_moi_mua_dau_so")) || "{}"); } catch { soMoi = {}; } }
  let leads = co.leads;
  if (leads === undefined) { const { getLeads } = await import("@/lib/blog-nurture"); leads = await getLeads(); }
  const l = leads.find((x: any) => x.email === norm);
  return gopLichSu(bang, tuSoMoiMuaDau(soMoi, norm), l ? lichSuChuoi(l, now) : []);
}

export async function ghiNhatKyGui(o: { email: string; luong: string; mau: string; neuSanPham?: boolean; resendId?: string; meta?: any }): Promise<boolean> {
  try {
    const sb = getServiceClient();
    const { error } = await sb.from(BANG).insert({ email_chuan: chuanEmail(o.email), luong: o.luong, mau: o.mau, neu_san_pham: !!o.neuSanPham, resend_id: o.resendId || null, meta: o.meta ?? null });
    if (error) { console.error("[email-nhip] ghi nhat ky gui hong:", error.message); return false; }
    return true;
  } catch (e: any) { console.error("[email-nhip] ghi nhat ky gui hong:", e?.message || e); return false; }
}
