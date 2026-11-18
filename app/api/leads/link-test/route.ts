import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { sendTelegram, telegramConfigured, tgEscape } from "@/lib/telegram";
import { khoaCron, xacThucMay } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {

  if ((await xacThucMay(req, [khoaCron({ query: ["key"] })])) !== "ok") {

    const { getCurrentUser } = await import("@/lib/supabase-server");
    const u = await getCurrentUser(); if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!telegramConfigured()) return NextResponse.json({ ok: false, error: "chưa cắm TELEGRAM_BOT_TOKEN/CHAT_ID" });

  const sb = getServiceClient();
  const { data } = await sb.from("leads")
    .select("customer_name, pancake_link, external_id")
    .like("external_id", "fb:%").not("pancake_link", "is", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data?.pancake_link) return NextResponse.json({ ok: false, error: "chưa có lead FB nào có link để test" });

  const u2 = new URL(data.pancake_link);
  const pageId = u2.searchParams.get("asset_id") || "";
  const threadId = u2.searchParams.get("selected_item_id") || "";
  if (!pageId || !threadId) return NextResponse.json({ ok: false, error: "link cũ thiếu asset_id/selected_item_id" });

  const A = `https://business.facebook.com/latest/inbox/all/?asset_id=${pageId}&mailbox_id=${pageId}&selected_item_id=${threadId}&thread_type=FB_MESSAGE`;
  const B = `https://business.facebook.com/latest/inbox/?asset_id=${pageId}&selected_item_id=${threadId}&thread_type=FB_MESSAGE`;
  const C = `https://www.facebook.com/messages/t/${threadId}`;

  const text = [
    `\u{1F517} <b>TEST LINK MỞ CHAT</b> — khách: ${tgEscape(data.customer_name || "(không tên)")}`,
    `Anh bấm lần lượt 3 link, cái nào mở ĐÚNG cuộc trò chuyện thì nhắn em số (A/B/C):`,
    ``,
    `<b>A</b> (Business Suite + mailbox_id):\n${tgEscape(A)}`,
    ``,
    `<b>B</b> (Business Suite gọn):\n${tgEscape(B)}`,
    ``,
    `<b>C</b> (Messenger trực tiếp):\n${tgEscape(C)}`,
  ].join("\n");

  const r = await sendTelegram(text);
  return NextResponse.json({ ok: !!r.ok, sent: r.ok, pageId, threadId });
}
