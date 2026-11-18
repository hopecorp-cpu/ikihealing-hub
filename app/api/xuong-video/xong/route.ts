import { NextResponse } from "next/server";
import { timMa, docViec, ghiViec, manhDaLen } from "@/lib/xuong-video-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  try {
    const ma = await timMa(String(body?.ma || ""));
    if (!ma) return NextResponse.json({ ok: false, loi: "Mã không đúng hoặc đã bị thu hồi" }, { status: 401 });
    const viec = await docViec(String(body?.id || ""));
    if (!viec || viec.ma_id !== ma.id) return NextResponse.json({ ok: false, loi: "Không thấy clip này" }, { status: 404 });
    if (viec.trang_thai !== "cho_tai") return NextResponse.json({ ok: true });
    const kho = await manhDaLen(viec.id);
    if (kho.so !== viec.file.manh || kho.bytes !== viec.file.bytes) {
      return NextResponse.json({ ok: false, loi: "Clip tải lên chưa đủ, hãy gửi lại" }, { status: 409 });
    }
    await ghiViec({ ...viec, trang_thai: "cho_dung" });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, loi: "Máy chủ đang lỗi, thử lại sau" }, { status: 500 });
  }
}
