"use server";
import { revalidatePath } from "next/cache";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/auth";
import { ghiCongNo, laySoDaiLy, luuSoDaiLy } from "@/lib/dai-ly-server";
import { BAC_CHON, LOAI_DAI_LY, type DaiLy } from "@/lib/dai-ly";
import type { MaSanPham } from "@/lib/gia-v4";

type KQ = { ok: boolean; error?: string };

async function nguoiGhi(): Promise<{ ten: string } | { error: string }> {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { error: "Chưa đăng nhập" };
  const { data: me } = await getServiceClient().from("users").select("role, full_name, email").eq("id", user.id).maybeSingle();
  if (!me || !isAdmin((me as any).role)) return { error: "Chỉ admin mới được sửa sổ đại lý" };
  return { ten: (me as any).full_name || (me as any).email || "" };
}

export type FormDaiLy = {
  ma: string; ho_ten: string; loai: string; bac: string; vung: string; doc_quyen_vung: boolean; doc_quyen_tu: string;
  dia_chi: string; dien_thoai: string; dien_thoai_khac: string; freeship_tu: string; hop_dong_so: string; ngay_ky: string; ghi_chu: string;
  cam_ket: { san_pham: string; han: string; moc_giua: string; da_lay: number; can_lay: number } | null;
  ghi_de: Array<{ ma: MaSanPham; pct: number; ly_do: string }>;

  cccd_moi?: string;
};

const sach = (s: unknown) => String(s ?? "").trim();
const sdt = (s: unknown) => sach(s).replace(/\D/g, "");

export async function luuDaiLyAction(f: FormDaiLy): Promise<KQ> {
  const ai = await nguoiGhi();
  if ("error" in ai) return { ok: false, error: ai.error };
  const ma = sach(f.ma).toUpperCase();
  if (!/^[A-Z0-9-]{3,30}$/.test(ma)) return { ok: false, error: "Mã đại lý chỉ gồm chữ/số/gạch ngang (vd ACME-DL-002)" };
  if (!sach(f.ho_ten)) return { ok: false, error: "Thiếu họ tên" };
  if (!(LOAI_DAI_LY as string[]).includes(f.loai)) return { ok: false, error: "Loại không hợp lệ" };
  if (!(BAC_CHON as readonly string[]).includes(f.bac)) return { ok: false, error: "Bậc không hợp lệ" };
  if (f.doc_quyen_vung && !sach(f.vung)) return { ok: false, error: "Bật độc quyền thì phải ghi vùng" };
  for (const g of f.ghi_de || []) {
    if (!(g.pct >= 0 && g.pct <= 100)) return { ok: false, error: `Chiết khấu ghi đè ${g.ma} phải trong 0–100` };
    if (!sach(g.ly_do)) return { ok: false, error: `Ghi đè chiết khấu ${g.ma} phải có lý do` };
  }
  try {
    const list = await laySoDaiLy();
    const i = list.findIndex((d) => d.ma === ma);
    const cu = i >= 0 ? list[i] : undefined;
    const ghiDe: DaiLy["chiet_khau_ghi_de"] = {};
    for (const g of f.ghi_de || []) ghiDe[g.ma] = { pct: Number(g.pct), ly_do: sach(g.ly_do) };
    const moi: DaiLy = {
      ...(cu || {}),
      ma, ho_ten: sach(f.ho_ten), loai: f.loai as DaiLy["loai"], bac: f.bac,
      vung: sach(f.vung) || undefined, doc_quyen_vung: !!f.doc_quyen_vung, doc_quyen_tu: f.doc_quyen_vung ? sach(f.doc_quyen_tu) || undefined : undefined,
      dia_chi: sach(f.dia_chi) || undefined, dien_thoai: sdt(f.dien_thoai) || undefined,
      dien_thoai_khac: sach(f.dien_thoai_khac).split(/[,;\s]+/).map(sdt).filter((p) => p.length >= 9),
      freeship_tu: sach(f.freeship_tu) || undefined, hop_dong_so: sach(f.hop_dong_so) || undefined, ngay_ky: sach(f.ngay_ky) || undefined,
      ghi_chu: sach(f.ghi_chu) || undefined,
      chiet_khau: cu?.chiet_khau || {},
      chiet_khau_ghi_de: Object.keys(ghiDe).length ? ghiDe : undefined,
      cam_ket: f.cam_ket && sach(f.cam_ket.san_pham) ? {
        san_pham: sach(f.cam_ket.san_pham), han: sach(f.cam_ket.han), moc_giua: sach(f.cam_ket.moc_giua) || undefined,
        da_lay: Number(f.cam_ket.da_lay) || 0, can_lay: Number(f.cam_ket.can_lay) || 0,
      } : undefined,

      cccd: sach(f.cccd_moi) ? sdt(f.cccd_moi) : cu?.cccd,
      createdAt: cu?.createdAt || new Date().toISOString(),
    };
    if (i >= 0) list[i] = moi; else list.push(moi);
    await luuSoDaiLy(list, ai.ten);
    revalidatePath("/dai-ly");
    return { ok: true };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}

export async function ghiCongNoAction(f: { ma_dai_ly: string; loai: "no" | "tra"; ngay: string; so_tien: number; ma_don?: string; kenh?: string; ghi_chu?: string }): Promise<KQ> {
  const ai = await nguoiGhi();
  if ("error" in ai) return { ok: false, error: ai.error };
  try {
    const list = await laySoDaiLy();
    if (!list.some((d) => d.ma === f.ma_dai_ly)) return { ok: false, error: "Không có đại lý " + f.ma_dai_ly };
    const chung = { ma_dai_ly: f.ma_dai_ly, ngay: sach(f.ngay), so_tien: Math.round(Number(f.so_tien) || 0), ghi_chu: sach(f.ghi_chu) || undefined };
    await ghiCongNo(f.loai === "tra" ? { ...chung, loai: "tra", kenh: sach(f.kenh) || undefined } : { ...chung, loai: "no", ma_don: sach(f.ma_don) || undefined }, ai.ten);
    revalidatePath("/dai-ly");
    return { ok: true };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}
