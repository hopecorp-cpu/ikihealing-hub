import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { chayLaiMay } from "@/lib/may-chay-ngam";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ loi: "Chưa đăng nhập" }, { status: 401 });
  if (!isManagerOrAbove(user.role)) return NextResponse.json({ loi: "Chỉ quản lý trở lên được chạy lại máy" }, { status: 403 });

  const body = await req.json().catch(() => ({} as any));
  const key = String(body.key || "").trim();
  if (!key) return NextResponse.json({ loi: "Thiếu khoá máy" }, { status: 400 });

  const kq = await chayLaiMay(key, user.email || user.id || "?");
  return NextResponse.json({ ...kq, loi: kq.canNguoi ? kq.thongBao : undefined });
}
