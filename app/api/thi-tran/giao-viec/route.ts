import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { addTask } from "@/lib/cc-queue";
import { duAnPhong, timPhong, type MaPhong } from "@/lib/thi-tran";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!isManagerOrAbove(user.role)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const phong = timPhong(String(body?.phong ?? "") as MaPhong);
  const viec = String(body?.viec ?? "").replace(/\s+/g, " ").trim();
  if (!phong) return NextResponse.json({ ok: false, error: "Không rõ phòng" }, { status: 400 });
  if (viec.length < 8) return NextResponse.json({ ok: false, error: "Việc quá ngắn, anh ghi rõ hơn giúp em" }, { status: 400 });
  if (viec.length > 500) return NextResponse.json({ ok: false, error: "Việc dài quá 500 ký tự" }, { status: 400 });

  const ten = (user as any).full_name || user.email || "Thị trấn máy";
  const t = await addTask(`[${phong.ten}] ${viec}`, duAnPhong(phong.id), `web:${user.id}`, ten);
  return NextResponse.json({ ok: true, id: t.id, trangThai: t.status });
}
