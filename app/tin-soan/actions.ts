"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { nickChoPhep } from "@/lib/hop-thu-zalo-server";
import { findBanned } from "@/lib/banned-words";
import { xepHangGuiZalo } from "@/lib/gui-zalo";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { sendOAMessage } from "@/lib/zalo";
import { docKhoNhapOa, ghiKhoNhapOa, layTokenOa } from "@/lib/zalo-oa-nhap-server";
import { nhanKhachOa } from "@/lib/zalo-oa-che-do";

async function docSoan(): Promise<{ at?: string; tin: any[] }> {
  try { const r = await getConfigValue("zalo_tin_soan"); const j = r ? JSON.parse(r) : null; return { at: j?.at, tin: j?.tin || [] }; }
  catch { return { tin: [] }; }
}
async function ghiSoan(at: string | undefined, tin: any[]) {
  await setConfigValue("zalo_tin_soan", JSON.stringify({ at: at || new Date().toISOString(), tin }), "Tin chuỗi chăm sóc chờ người duyệt");
}

async function guiTinOa(user: any, uid: string, noiDung: string) {
  const kho = await docKhoNhapOa();
  if (!kho[uid]) return { loi: "Tin này không còn trong danh sách chờ" };

  const cam = findBanned(noiDung);
  if (cam.length) return { loi: `Tin có từ không được dùng với thực phẩm bổ sung: ${cam.join(", ")}. Sửa rồi gửi lại.` };

  const token = await layTokenOa();
  if (!token) return { loi: "Chưa có token Zalo OA (cron oa-refresh chưa làm mới hoặc chưa cấu hình)" };

  const kq: any = await sendOAMessage(uid, noiDung, token);
  if (!kq?.success) return { loi: `Zalo OA từ chối gửi: ${kq?.error || "không rõ"} (quá 48 giờ từ tin khách thì OA không cho trả lời)` };

  try {
    const HKEY = `zalo_hist_${uid}`;
    const h = JSON.parse((await getConfigValue(HKEY)) || "[]");
    await setConfigValue(HKEY, JSON.stringify([...h, { role: "assistant", content: noiDung.slice(0, 500) }].slice(-8)), `Lịch sử chat Zalo ${uid}`);
  } catch {  }

  const sau = await docKhoNhapOa();
  delete sau[uid];
  await ghiKhoNhapOa(sau);
  revalidatePath("/tin-soan");
  return { ok: `Đã gửi qua Zalo OA cho ${nhanKhachOa(uid)} (người gửi: ${user.full_name || user.email}).` };
}

async function boQuaTinOa(uid: string) {
  const kho = await docKhoNhapOa();
  delete kho[uid];
  await ghiKhoNhapOa(kho);
  revalidatePath("/tin-soan");
  return { ok: `Đã bỏ tin của ${nhanKhachOa(uid)} khỏi danh sách chờ.` };
}

export async function guiTinSoan(_prev: any, form: FormData) {
  const user = await getCurrentUser();
  if (!user) return { loi: "Chưa đăng nhập" };

  const uid = String(form.get("uid") || "");
  const noiDung = String(form.get("noiDung") || "").trim();
  if (!uid || !noiDung) return { loi: "Thiếu nội dung" };
  if (noiDung.length > 2000) return { loi: "Tin quá dài (trên 2000 ký tự)" };

  if (String(form.get("kenh") || "") === "oa") return guiTinOa(user, uid, noiDung);

  const sb = getServiceClient();
  const kho = await docSoan();
  const tin = kho.tin.find((t: any) => t.zalo_uid === uid);
  if (!tin) return { loi: "Tin này không còn trong danh sách chờ" };

  const cam = findBanned(noiDung);
  if (cam.length) return { loi: `Tin có từ không được dùng với thực phẩm bổ sung: ${cam.join(", ")}. Sửa rồi gửi lại.` };

  const { data: kh } = await sb.from("zalo_bridge_contacts")
    .select("own_id, thread_type, phone_norm").eq("zalo_uid", uid).maybeSingle();
  if (!kh) return { loi: "Không thấy hội thoại trong kho" };

  const duocXem = await nickChoPhep(user);
  if (duocXem !== null && !duocXem.includes(kh.own_id)) return { loi: "Không có quyền gửi từ nick này" };

  try {
    const { daTuChoi } = await import("@/lib/du-lieu-ca-nhan");
    if (await daTuChoi(sb, { zaloUid: uid, phone: kh.phone_norm })) {
      return { loi: "Khách này đã yêu cầu NGỪNG nhận tin từ NOVA — không được gửi tin chào hàng." };
    }
  } catch {  }

  const xep = await xepHangGuiZalo(sb, {
    own: kh.own_id, uid, kieu: kh.thread_type || "user", noiDung,
    boi: `${user.full_name || user.email} (duyệt tin chuỗi ${tin.chuoi})`,
  });
  if (!xep.ok) return { loi: xep.loi };

  try {
    const raw = await getConfigValue("zalo_chuoi_lich_su");
    const ls: Record<string, any[]> = raw ? JSON.parse(raw) : {};
    (ls[uid] ||= []).push({ chuoi: tin.chuoi, buoc: tin.buoc, luc: xep.luc });
    await setConfigValue("zalo_chuoi_lich_su", JSON.stringify(ls), "Lịch sử chuỗi chăm sóc đã gửi");
  } catch {  }

  await ghiSoan(kho.at, kho.tin.filter((t: any) => t.zalo_uid !== uid));
  revalidatePath("/tin-soan");
  return { ok: `Đã xếp hàng gửi cho ${tin.ten}. Cầu nối sẽ gửi trong ít phút.` };
}

export async function boQuaTinSoan(_prev: any, form: FormData) {
  const user = await getCurrentUser();
  if (!user) return { loi: "Chưa đăng nhập" };
  const uid = String(form.get("uid") || "");
  if (String(form.get("kenh") || "") === "oa") return boQuaTinOa(uid);
  const kho = await docSoan();
  const tin = kho.tin.find((t: any) => t.zalo_uid === uid);
  await ghiSoan(kho.at, kho.tin.filter((t: any) => t.zalo_uid !== uid));
  revalidatePath("/tin-soan");
  return { ok: `Đã bỏ tin cho ${tin?.ten || "khách"} — máy sẽ không soạn lại hôm nay.` };
}
