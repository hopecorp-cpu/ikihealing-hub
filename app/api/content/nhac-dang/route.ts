import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { pushDraftsToCEO, type SavedDraft } from "@/lib/content-factory";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const sb = getServiceClient();
  const b = await req.json().catch(() => ({} as any));

  const tokenCfg = String((await sb.from("config").select("value").eq("key", "ads_report_token").maybeSingle()).data?.value || "").trim();
  const cron = (process.env.CRON_SECRET || "").trim();
  const dua = String(b.token || req.headers.get("x-ads-token") || "").trim();
  if (!(dua && ((tokenCfg && dua === tokenCfg) || (cron && dua === cron)))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const n = Math.max(1, Math.min(10, Number(b.n) || 3));
  const { data, error } = await sb.from("content_items")
    .select("id,title,content_brief,tags,status")
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(n);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const items: SavedDraft[] = (data || []).map((d: any) => ({
    id: d.id, title: d.title, pillar: "", content_brief: d.content_brief || "", flagged: false,
  }));
  if (!items.length) return NextResponse.json({ ok: true, pushed: 0, note: "Không còn bài nháp nào tồn." });
  if (b.dry) return NextResponse.json({ ok: true, dry: true, se_ban: items.map((i) => i.title) });

  const pushed = await pushDraftsToCEO(items);

  if (!pushed) return NextResponse.json({ ok: false, error: "khong_ban_duoc", note: "Kiểm content_tg_chat / TELEGRAM_CONTENT_CHAT_ID" }, { status: 500 });
  return NextResponse.json({ ok: true, pushed, titles: items.slice(0, pushed).map((i) => i.title) });
}
