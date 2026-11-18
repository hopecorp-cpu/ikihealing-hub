import { NextResponse } from "next/server";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { nickChoPhep } from "@/lib/hop-thu-zalo-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ loi: "Chưa đăng nhập" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const msg = (searchParams.get("msg") || "").trim();
  const nho = searchParams.get("thumb") === "1";
  if (!msg) return NextResponse.json({ loi: "Thiếu msg" }, { status: 400 });

  const sb = getServiceClient();
  const { data: tin, error } = await sb.from("zalo_bridge_messages")
    .select("own_id, media_url, media_thumb, media_type")
    .eq("msg_id", msg).maybeSingle();
  if (error) return NextResponse.json({ loi: error.message }, { status: 500 });
  if (!tin) return NextResponse.json({ loi: "Không có tin này" }, { status: 404 });

  const duocXem = await nickChoPhep(user);
  if (duocXem !== null && !duocXem.includes(String(tin.own_id))) {
    return NextResponse.json({ loi: "Không có quyền xem hộp thư này" }, { status: 403 });
  }

  const duongDan = (nho ? tin.media_thumb || tin.media_url : tin.media_url || tin.media_thumb) as string | null;
  if (!duongDan) {
    return NextResponse.json({ loi: "Tin này chưa có ảnh trong kho (link Zalo đã hết hạn)" }, { status: 404 });
  }

  const kho = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${encodeURI(`zalo-media/${duongDan}`)}`;
  const khoa = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const range = req.headers.get("range");
  const rTep = await fetch(kho, {
    headers: { apikey: khoa, Authorization: `Bearer ${khoa}`, ...(range ? { Range: range } : {}) },
  });
  if (!rTep.ok && rTep.status !== 206) {
    return NextResponse.json({ loi: `Không tải được tệp (HTTP ${rTep.status})` }, { status: 404 });
  }

  const theoLoai: Record<string, string> = {
    anh: "image/jpeg", sticker: "image/png", video: "video/mp4", ghiam: "audio/mp4",
  };
  const kieuKho = rTep.headers.get("content-type") || "";
  const kieu =
    (nho ? "image/jpeg" : theoLoai[String(tin.media_type)] || "") ||
    (kieuKho && kieuKho !== "application/octet-stream" ? kieuKho : "") ||
    "application/octet-stream";

  const dau = new Headers({ "Content-Type": kieu, "Accept-Ranges": "bytes" });
  const vungTra = rTep.headers.get("content-range");
  if (vungTra) dau.set("Content-Range", vungTra);

  dau.set("Cache-Control", "private, max-age=86400");

  const than = await rTep.arrayBuffer();
  return new NextResponse(than, { status: rTep.status, headers: dau });
}
