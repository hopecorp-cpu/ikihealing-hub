import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { layDoanChat, layHoSoKhach, layHoatDong, nickChoPhep } from "@/lib/hop-thu-zalo-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ loi: "Chưa đăng nhập" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const own = (searchParams.get("own") || "").trim();
  const uid = (searchParams.get("uid") || "").trim();
  const phone = (searchParams.get("phone") || "").trim() || null;
  const ten = (searchParams.get("ten") || "").trim();

  const truoc = (searchParams.get("truoc") || "").trim() || null;
  if (!own || !uid) return NextResponse.json({ loi: "Thiếu own/uid" }, { status: 400 });

  const duocXem = await nickChoPhep(user);
  if (duocXem !== null && !duocXem.includes(own)) {
    return NextResponse.json({ loi: "Không có quyền xem hộp thư này" }, { status: 403 });
  }

  try {

    if (truoc) {
      const tin = await layDoanChat(own, uid, 200, truoc);
      return NextResponse.json({ tin });
    }
    const [tin, hoSo, hoatDong] = await Promise.all([
      layDoanChat(own, uid),
      layHoSoKhach(phone, ten),
      layHoatDong(phone),
    ]);
    return NextResponse.json({ tin, hoSo, hoatDong });
  } catch (e: any) {

    return NextResponse.json({ loi: String(e?.message || e) }, { status: 500 });
  }
}
