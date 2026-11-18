"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { appLink } from "@/lib/app-url";
import { trangThaiSauDuyet } from "@/lib/xuong-video";
import { capMa, thuHoiMa, docViec, ghiViec, tuCam } from "@/lib/xuong-video-server";

type KQ = { ok: boolean; loi?: string; thongBao?: string; link?: string };

async function nguoiDuyet(): Promise<{ ten: string } | { cam: string }> {
  const u = await getCurrentUser();
  if (!u) return { cam: "Phiên đăng nhập đã hết, anh đăng nhập lại giúp em" };
  if (!isManagerOrAbove(u.role)) return { cam: "Chỉ quản lý trở lên mới dùng được Xưởng video" };
  return { ten: (u as any).full_name || (u as any).email || "quản lý" };
}

export async function capMaMoi(ten: string): Promise<KQ> {
  const n = await nguoiDuyet();
  if ("cam" in n) return { ok: false, loi: n.cam };
  try {
    const r = await capMa(ten, n.ten);
    revalidatePath("/xuong-video");
    return { ok: true, link: appLink(`/xuong/${r.ma}`), thongBao: `Đã cấp mã cho ${r.ban.ten}. Đường link chỉ hiện một lần, hãy chép ngay.` };
  } catch (e: any) { return { ok: false, loi: String(e?.message || e) }; }
}

export async function thuHoi(id: string): Promise<KQ> {
  const n = await nguoiDuyet();
  if ("cam" in n) return { ok: false, loi: n.cam };
  try { await thuHoiMa(id); revalidatePath("/xuong-video"); return { ok: true, thongBao: "Đã thu hồi, đường link cũ hết hiệu lực" }; }
  catch (e: any) { return { ok: false, loi: String(e?.message || e) }; }
}

export async function quyetVideo(id: string, k: number, dat: boolean): Promise<KQ> {
  const n = await nguoiDuyet();
  if ("cam" in n) return { ok: false, loi: n.cam };
  try {
    const v = await docViec(id);
    const kq = v?.ket_qua?.[k];
    if (!v || !kq) return { ok: false, loi: "Không thấy video này" };
    if (!["cho_duyet", "da_duyet", "tu_choi"].includes(v.trang_thai)) return { ok: false, loi: "Việc này chưa dựng xong" };
    if (dat) {
      const cam = tuCam(kq.chu);
      if (cam.length) return { ok: false, loi: `Video có từ cấm (${cam.join(", ")}) nên không duyệt được` };
    }
    kq.duyet = dat;
    v.trang_thai = trangThaiSauDuyet(v.ket_qua!);
    v.duyet_boi = n.ten;
    await ghiViec(v);
    revalidatePath("/xuong-video");
    return { ok: true, thongBao: dat ? "Đã duyệt, đại lý tải được bản này" : "Đã đánh dấu không đạt" };
  } catch (e: any) { return { ok: false, loi: String(e?.message || e) }; }
}

export async function dungLai(id: string): Promise<KQ> {
  const n = await nguoiDuyet();
  if ("cam" in n) return { ok: false, loi: n.cam };
  try {
    const v = await docViec(id);
    if (!v || v.trang_thai !== "loi") return { ok: false, loi: "Chỉ dựng lại được việc đang lỗi" };
    await ghiViec({ ...v, trang_thai: "cho_dung", loi: undefined, lan_thu: 0 });
    revalidatePath("/xuong-video");
    return { ok: true, thongBao: "Đã đưa lại vào hàng chờ dựng" };
  } catch (e: any) { return { ok: false, loi: String(e?.message || e) }; }
}
