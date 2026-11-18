import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { getConfigValue } from "@/lib/app-config";
import { ttsConfigured } from "@/lib/tiktok-shop/config";
import { kiemCron, ghiNhip } from "@/lib/tiktok-shop/cron-guard";
import { docTokenRow, gioConLai } from "@/lib/tiktok-shop/token-store";
import { guiNhomTts, tgEscape } from "@/lib/tiktok-shop/telegram";
import { sendTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const docJson = async (k: string) => { try { return JSON.parse((await getConfigValue(k)) || "null"); } catch { return null; } };
const tuoiGio = (iso?: string | null) => (iso ? (Date.now() - new Date(iso).getTime()) / 3600e3 : Infinity);

export async function GET(req: Request) {
  const chan = kiemCron(req); if (chan) return chan;
  if (!ttsConfigured()) return NextResponse.json({ ok: false, error: "chưa cấu hình TTS_APP_KEY/TTS_APP_SECRET" });
  const u = new URL(req.url);
  const nguongGio = Number(u.searchParams.get("gio")) || 6;
  const dry = u.searchParams.get("dry") === "1";
  try {
    const sb = getServiceClient();
    const row = await docTokenRow();
    if (!row) { await ghiNhip("tts_heartbeat_last", { ok: true, chuaUyQuyen: true }); return NextResponse.json({ ok: true, chuaUyQuyen: true }); }
    const vanDe: string[] = [];

    if (row.last_refresh_error) vanDe.push(`refresh token LỖI: ${row.last_refresh_error.slice(0, 160)}`);
    const conAccess = gioConLai(row.access_token_expires_at), conRefresh = gioConLai(row.refresh_token_expires_at);
    if (conAccess < 24) vanDe.push(`access token còn ${Math.round(conAccess)}h (cron tts-token-refresh có chạy không?)`);
    if (conRefresh < 7 * 24) vanDe.push(`refresh token còn ${Math.round(conRefresh / 24)} ngày — phải uỷ quyền lại`);

    const { data: evMoi } = await sb.from("tts_events").select("received_at").order("received_at", { ascending: false }).limit(1).maybeSingle();
    const poll = await docJson("tts_poll_last");
    const tuoiWebhook = tuoiGio(evMoi?.received_at), tuoiPoll = poll?.ok ? tuoiGio(poll.at) : Infinity;
    if (tuoiWebhook > nguongGio && tuoiPoll > nguongGio) {
      vanDe.push(`không có webhook mới (${isFinite(tuoiWebhook) ? Math.round(tuoiWebhook) + "h" : "chưa từng"}) lẫn poll thành công (${isFinite(tuoiPoll) ? Math.round(tuoiPoll) + "h" : "chưa từng"}) trong ${nguongGio}h${poll?.loi ? " · poll lỗi: " + String(poll.loi).slice(0, 120) : ""}`);
    }

    const { count: soLoi } = await sb.from("tts_events").select("id", { count: "exact", head: true }).eq("status", "error");
    const { count: soKet } = await sb.from("tts_events").select("id", { count: "exact", head: true }).eq("status", "pending").lt("received_at", new Date(Date.now() - 3600e3).toISOString());
    if (soLoi) vanDe.push(`${soLoi} sự kiện xử lý LỖI (xem tts_events.error)`);
    if (soKet) vanDe.push(`${soKet} sự kiện chờ quá 1h — cron tts-process đứng?`);
    const proc = await docJson("tts_process_last");
    if (tuoiGio(proc?.at) > 1) vanDe.push(`cron tts-process không ghi nhịp ${isFinite(tuoiGio(proc?.at)) ? Math.round(tuoiGio(proc?.at)) + "h" : "(chưa từng)"}`);

    const { data: donKet } = await sb.from("tts_orders").select("order_id, ship_status, ship_note, updated_at").eq("status", "AWAITING_SHIPMENT").in("ship_status", ["manual", "error"]).lt("updated_at", new Date(Date.now() - 2 * 3600e3).toISOString()).limit(10);
    if (donKet?.length) vanDe.push(`${donKet.length} đơn chờ xử lý tay quá 2h: ${donKet.map((d: any) => d.order_id).join(", ")}`);

    const ok = vanDe.length === 0;
    let daBao = false;
    if (!ok && !dry) {
      const truoc = await docJson("tts_heartbeat_last");
      const dauVet = vanDe.map((v) => v.replace(/\d+h|\d+ ngày|\(.*?\)/g, "")).join("|");
      const lapLai = truoc?.dauVet === dauVet && tuoiGio(truoc?.baoLuc) < 6;
      if (!lapLai) {
        const text = `<b>HEARTBEAT TIKTOK SHOP — ${vanDe.length} vấn đề</b>\n${vanDe.map((v) => "• " + tgEscape(v)).join("\n")}\nChữa: xem docs/tiktok-shop-api.md mục "Khi hỏng".`;
        await guiNhomTts(text);
        await sendTelegram(text);
        daBao = true;
      }
      await ghiNhip("tts_heartbeat_last", { ok, vanDe, dauVet, baoLuc: daBao ? new Date().toISOString() : truoc?.baoLuc || null });
    } else if (!dry) {
      await ghiNhip("tts_heartbeat_last", { ok, vanDe });
    }
    return NextResponse.json({ ok, vanDe, daBao, token: { accessConGio: Math.round(conAccess), refreshConGio: Math.round(conRefresh) } }, { status: ok ? 200 : 500 });
  } catch (e: any) {
    const msg = String(e?.message || e);
    console.error("[tts-heartbeat]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
