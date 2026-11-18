import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { runFactory, pushDraftsToCEO } from "@/lib/content-factory";
import { sendBrainTelegram, brainBotConfigured, sendTelegram, telegramConfigured, tgEscape } from "@/lib/telegram";
import { ghiViecMay } from "@/lib/viec-may";
import { vnDateStr } from "@/lib/payroll";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const CHI_TIEU = 5;

async function baoCeo(text: string) {
  const ceo = (process.env.TELEGRAM_CHAT_ID || "").trim();
  if (brainBotConfigured() && ceo) return sendBrainTelegram(ceo, text);
  if (telegramConfigured()) return sendTelegram(text);
  return { ok: false };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sb = getServiceClient();
  const secret = (process.env.CRON_SECRET || "").trim();
  const key = (url.searchParams.get("key") || "").trim();

  const tokenCfg = String((await sb.from("config").select("value").eq("key", "ads_report_token").maybeSingle()).data?.value || "").trim();
  const oke = req.headers.get("authorization") === `Bearer ${secret}`
    || (key && ((secret && key === secret) || (tokenCfg && key === tokenCfg)));
  if (!oke) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const today = vnDateStr();
  const { count, error } = await sb.from("content_items")
    .select("id", { count: "exact", head: true })
    .gte("created_at", `${today}T00:00:00+07:00`);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const co = count || 0;
  const thieu = Math.max(0, CHI_TIEU - co);
  if (!thieu) return NextResponse.json({ ok: true, co, thieu: 0, note: "đủ chỉ tiêu, không cần bù" });

  if (url.searchParams.get("dry") === "1") {
    return NextResponse.json({ ok: true, dry: true, co, thieu, se_viet: Math.min(3, thieu) });
  }

  const n = Math.min(3, thieu);
  const t0 = Date.now();
  const items: any[] = [];
  const loi: string[] = [];
  let saved = 0, flagged: string[] = [];
  for (let i = 0; i < n; i++) {
    const x = await runFactory(1);
    if (!x.ok) { loi.push(x.error || "?"); continue; }
    items.push(...x.items); saved += x.saved; flagged = flagged.concat(x.flagged || []);
  }

  const r = { ok: items.length > 0, items, saved, flagged, error: loi.join(" · ") };

  await ghiViecMay({
    agent: "content-bu", agentTen: "Lớp bù bài fanpage",
    viec: `Bù ${n} bài (mới có ${co}/${CHI_TIEU} trong ngày)`,
    trangThai: !r.ok ? "hong" : (r.saved ? "xong" : "khong_co_gi"),
    soLuong: r.saved, donVi: "bài", chiTiet: r.ok ? null : r.error,
    link: "/content", giay: (Date.now() - t0) / 1000, canDuyet: !!r.saved,
  });

  if (!r.ok) {

    await baoCeo(
      `\u{26A0} <b>Máy viết bù cũng không ra bài</b> — hôm nay mới có ${co}/${CHI_TIEU} bài.\n` +
      `Lý do: ${tgEscape(r.error || "")}\n\nEm đã thử lại, vẫn hỏng — chỗ này cần người xem.`
    );
    return NextResponse.json({ ok: false, co, thieu, error: r.error }, { status: 500 });
  }

  const pushed = await pushDraftsToCEO(r.items);
  return NextResponse.json({ ok: true, co, thieu, viet_bu: r.saved, pushed, flagged: r.flagged });
}
