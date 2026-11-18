import { NextResponse } from "next/server";
import { timMa, viecCongKhai } from "@/lib/xuong-video-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  try {
    const ma = await timMa(String(body?.ma || ""));
    if (!ma) return NextResponse.json({ ok: false, loi: "Mã không đúng hoặc đã bị thu hồi" }, { status: 401 });
    return NextResponse.json({ ok: true, ten: ma.ten, viec: await viecCongKhai(ma.id) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, loi: "Máy chủ đang lỗi, thử lại sau" }, { status: 500 });
  }
}
