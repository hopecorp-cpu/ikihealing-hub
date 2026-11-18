import { NextResponse } from "next/server";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { publishToPage } from "@/lib/fb-publish";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !isManagerOrAbove(user.role)) return NextResponse.json({ error: "Không có quyền" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "").trim();
  if (!id) return NextResponse.json({ error: "Thiếu mã bài" }, { status: 400 });

  const sb = getServiceClient();
  const { data: item, error } = await sb.from("content_items").select("id,title,content_brief,status,published_url").eq("id", id).maybeSingle();
  if (error || !item) return NextResponse.json({ error: "Không thấy bài" }, { status: 404 });
  if (item.published_url) return NextResponse.json({ error: "Bài này đã đăng rồi" }, { status: 400 });

  const message = String(item.content_brief || "").trim();
  if (!message) return NextResponse.json({ error: "Bài chưa có nội dung" }, { status: 400 });

  const r = await publishToPage(message, String(b.imageUrl || "").trim() || undefined);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error, banned: r.banned }, { status: 200 });

  await sb.from("content_items").update({
    status: "published",
    published_url: r.url,
    publish_date: new Date().toISOString(),
    notes: `Đăng bởi ${user.full_name || user.email} lúc ${new Date().toLocaleString("vi-VN")}`,
  }).eq("id", id);

  return NextResponse.json({ ok: true, url: r.url, postId: r.postId });
}
