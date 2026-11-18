import { NextResponse } from "next/server";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { nickChoPhep } from "@/lib/hop-thu-zalo-server";
import { findBanned } from "@/lib/banned-words";
import { xepHangGuiZalo } from "@/lib/gui-zalo";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ loi: "Chưa đăng nhập" }, { status: 401 });

  const b = await req.json().catch(() => ({} as any));
  const own = String(b.own || "").trim(), uid = String(b.uid || "").trim();
  const noiDung = String(b.noiDung || "").replace(/\s+$/g, "").trim();
  if (!own || !uid) return NextResponse.json({ loi: "Thiếu own/uid" }, { status: 400 });
  if (!noiDung) return NextResponse.json({ loi: "Tin trống" }, { status: 400 });
  if (noiDung.length > 2000) return NextResponse.json({ loi: "Tin quá dài (trên 2000 ký tự)" }, { status: 400 });

  const duocXem = await nickChoPhep(user);
  if (duocXem !== null && !duocXem.includes(own)) {
    return NextResponse.json({ loi: "Không có quyền gửi từ nick này" }, { status: 403 });
  }

  const tuCam = findBanned(noiDung);
  if (tuCam.length) {
    return NextResponse.json({
      loi: `Tin có từ không được dùng với thực phẩm bổ sung: ${tuCam.join(", ")}. Sửa lại rồi gửi.`,
      tuCam,
    }, { status: 400 });
  }

  const sb = getServiceClient();
  const { data: kh } = await sb.from("zalo_bridge_contacts").select("thread_type, phone_norm").eq("own_id", own).eq("zalo_uid", uid).maybeSingle();
  if (!kh) return NextResponse.json({ loi: "Không thấy hội thoại trong kho" }, { status: 404 });

  if (!b.boQuaTuChoi) {
    const { daTuChoi } = await import("@/lib/du-lieu-ca-nhan");
    if (await daTuChoi(sb, { zaloUid: uid, phone: kh.phone_norm })) {
      return NextResponse.json({
        loi: "Khách này đã yêu cầu NGỪNG nhận tin từ NOVA. Chỉ được gửi khi đang TRẢ LỜI câu khách hỏi — không gửi mẫu tin chào hàng/ưu đãi.",
        tuChoi: true,
      }, { status: 409 });
    }
  }

  const xep = await xepHangGuiZalo(sb, {
    own, uid, kieu: kh.thread_type || "user", noiDung,
    boi: user.full_name || user.email,
  });
  if (!xep.ok) return NextResponse.json({ loi: xep.loi }, { status: 500 });
  return NextResponse.json({ ok: true, id: xep.id, luc: xep.luc });
}
