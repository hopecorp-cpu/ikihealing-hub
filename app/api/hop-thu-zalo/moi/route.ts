import { NextResponse } from "next/server";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { layDoanChat, nickChoPhep } from "@/lib/hop-thu-zalo-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ loi: "Chưa đăng nhập" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const own = (searchParams.get("own") || "").trim();
  const uid = (searchParams.get("uid") || "").trim();
  const sau = (searchParams.get("sau") || "").trim() || null;
  const tuLuc = (searchParams.get("tuLuc") || "").trim() || null;

  const duocXem = await nickChoPhep(user);

  try {
    const sb = getServiceClient();

    let tin: unknown[] = [];
    if (own && uid && sau) {
      if (duocXem !== null && !duocXem.includes(own)) {
        return NextResponse.json({ loi: "Không có quyền xem hộp thư này" }, { status: 403 });
      }
      tin = await layDoanChat(own, uid, 100, null, sau);
    }

    let khach: unknown[] = [];
    if (tuLuc) {
      let q = sb.from("zalo_bridge_contacts")
        .select("own_id, zalo_uid, display_name, last_msg_at, last_content, unreplied, unread_count")
        .gt("last_msg_at", tuLuc)
        .order("last_msg_at", { ascending: false })
        .limit(50);
      if (duocXem !== null) q = q.in("own_id", duocXem.length ? duocXem : ["-"]);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      khach = data || [];
    }

    return NextResponse.json({ tin, khach, luc: new Date().toISOString() });
  } catch (e: any) {

    return NextResponse.json({ loi: String(e?.message || e) }, { status: 500 });
  }
}
