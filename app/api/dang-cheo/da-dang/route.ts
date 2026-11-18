import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { ghiDaDang, timNenTang } from "@/lib/dang-cheo";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isManagerOrAbove(user.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const ma = String(b.ma || "").trim();
  const slug = String(b.slug || "").trim();
  if (!ma || !slug) return NextResponse.json({ error: "thiếu ma hoặc slug" }, { status: 400 });
  if (!timNenTang(ma)) return NextResponse.json({ error: "nền tảng lạ: " + ma }, { status: 400 });

  const so = await ghiDaDang(ma, slug);
  return NextResponse.json({ ok: true, daDang: Object.keys(so[ma] || {}).length });
}
