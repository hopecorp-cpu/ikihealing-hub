import { NextResponse } from "next/server";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove, isMktPosition } from "@/lib/auth";
import { findBanned } from "@/lib/banned-words";
import { addComment, approve, clearApproval, getReview, daDuyet } from "@/lib/content-review";
import { addAgentLearning } from "@/lib/agent-learning";
import { cauBaiHoc, phanLoaiTraBai } from "@/lib/phan-loai-tra-bai";

export const dynamic = "force-dynamic";

const FLOW = ["idea", "draft", "review", "scheduled", "published", "archived"];

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isManagerOrAbove(user.role) && !isMktPosition((user as any).position)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const sb = getServiceClient();

  if (b.action === "create") {
    const title = String(b.title || "").trim();
    if (!title) return NextResponse.json({ error: "Thiếu tiêu đề" }, { status: 400 });
    const { data, error } = await sb.from("content_items").insert({
      title, channel: b.channel || "Facebook", type: b.type || "Post",
      content_brief: b.content_brief || null, status: "idea", author_id: user.id,
      publish_date: b.publish_date || null, notes: b.notes || null,
    }).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data.id });
  }

  if (b.action === "move") {
    const id = String(b.id || ""); const status = String(b.status || "");
    if (!id || !FLOW.includes(status)) return NextResponse.json({ error: "bad input" }, { status: 400 });
    const { data: item } = await sb.from("content_items").select("title, content_brief, notes, published_url").eq("id", id).maybeSingle();
    if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });

    if (status === "scheduled" || status === "published") {
      const hits = findBanned([item.title, item.content_brief, item.notes].filter(Boolean).join("\n"));
      if (hits.length) return NextResponse.json({ error: "banned", banned: hits }, { status: 422 });
    }

    if (status === "published" && !(b.published_url || item.published_url)) {
      return NextResponse.json({ error: "need_url" }, { status: 422 });
    }

    if (status === "scheduled" || status === "published") {
      const laQuanLy = isManagerOrAbove(user.role);
      const rv = await getReview(id);
      if (!daDuyet(rv)) {
        if (!laQuanLy) return NextResponse.json({ error: "chua_duyet" }, { status: 422 });
        await approve(id, user.id, (user as any).full_name || user.email || "quản lý");
      }
    }
    const patch: any = { status };
    if (b.published_url) patch.published_url = String(b.published_url).trim();
    if (status === "published" && !item.published_url && !patch.publish_date) patch.publish_date = new Date().toISOString();
    const { error } = await sb.from("content_items").update(patch).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.action === "update") {
    const id = String(b.id || "");
    if (!id) return NextResponse.json({ error: "bad input" }, { status: 400 });
    const allowed = ["title", "channel", "type", "content_brief", "publish_date", "published_url", "notes"];
    const patch: any = {};
    for (const k of allowed) if (k in b) patch[k] = b[k] === "" ? null : b[k];
    if (!Object.keys(patch).length) return NextResponse.json({ error: "nothing to update" }, { status: 400 });

    const doiRuot = ["title", "content_brief", "notes"].some((k) => k in patch);
    const { error } = await sb.from("content_items").update(patch).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (doiRuot) await clearApproval(id, `Nội dung được sửa sau khi duyệt (${(user as any).full_name || user.email}) — cần duyệt lại.`).catch(() => { });
    return NextResponse.json({ ok: true });
  }

  if (b.action === "comment") {
    const id = String(b.id || ""); const text = String(b.text || "").trim();
    if (!id || !text) return NextResponse.json({ error: "bad input" }, { status: 400 });
    const r = await addComment(id, user.id, (user as any).full_name || user.email || "?", text);

    if (isManagerOrAbove(user.role) && !daDuyet(r)) {
      const nhom = phanLoaiTraBai(text);
      if (nhom) {
        const { data: it } = await sb.from("content_items").select("title").eq("id", id).maybeSingle();
        await addAgentLearning("content", cauBaiHoc(nhom, it?.title || "", text), "fail").catch(() => { });
      }
    }
    return NextResponse.json({ ok: true, review: r });
  }

  if (b.action === "approve" || b.action === "unapprove") {
    const id = String(b.id || "");
    if (!id) return NextResponse.json({ error: "bad input" }, { status: 400 });
    if (!isManagerOrAbove(user.role)) return NextResponse.json({ error: "chi_quan_ly_duyet" }, { status: 403 });
    if (b.action === "unapprove") {
      await clearApproval(id, `Thu hồi duyệt bởi ${(user as any).full_name || user.email}.`);
      return NextResponse.json({ ok: true, review: await getReview(id) });
    }

    const { data: item } = await sb.from("content_items").select("title, content_brief, notes").eq("id", id).maybeSingle();
    if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
    const hits = findBanned([item.title, item.content_brief, item.notes].filter(Boolean).join("\n"));
    if (hits.length) return NextResponse.json({ error: "banned", banned: hits }, { status: 422 });
    const r = await approve(id, user.id, (user as any).full_name || user.email || "quản lý");
    return NextResponse.json({ ok: true, review: r });
  }

  if (b.action === "delete") {
    const id = String(b.id || "");
    if (!id) return NextResponse.json({ error: "bad input" }, { status: 400 });

    const { data: item } = await sb.from("content_items").select("author_id").eq("id", id).maybeSingle();
    if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!isManagerOrAbove(user.role) && item.author_id !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const { error } = await sb.from("content_items").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
