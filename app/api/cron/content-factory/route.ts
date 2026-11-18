import { NextResponse } from "next/server";
import { runFactory, runResearch, pushDraftsToCEO } from "@/lib/content-factory";
import { sendBrainTelegram, brainBotConfigured, sendTelegram, telegramConfigured, tgEscape } from "@/lib/telegram";
import { ghiViecMay } from "@/lib/viec-may";
import { appLink } from "@/lib/app-url";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

async function notify(text: string) {
  const ceo = (process.env.TELEGRAM_CHAT_ID || "").trim();
  if (brainBotConfigured() && ceo) return sendBrainTelegram(ceo, text);
  if (telegramConfigured()) return sendTelegram(text);
  return { ok: false, error: "no telegram" };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;

  if (url.searchParams.get("mode") === "research") {
    const tR = Date.now();
    const r = await runResearch();
    await ghiViecMay({
      agent: "mkt-research", agentTen: "Agent Research",
      viec: "Quét thị trường, đối thủ, nỗi đau khách → brief cho nhà máy content",
      trangThai: !r.ok ? "hong" : (r.summary?.length ? "xong" : "khong_co_gi"),
      soLuong: r.summary?.length ? 1 : 0, donVi: "brief",
      chiTiet: r.ok ? null : r.error, link: "/chien-luoc-mkt", giay: (Date.now() - tR) / 1000,
    });
    if (!r.ok) {
      await notify(`\u{26A0} <b>Agent Research chưa chạy được</b> — ${tgEscape(r.error || "")}`);

      return NextResponse.json({ ok: false, error: r.error }, { status: 500 });
    }
    await notify(
      `\u{1F50E} <b>Agent Research vừa quét thị trường xong</b>\n\n${tgEscape(String(r.summary).slice(0, 2500))}\n\n<i>Nhà máy Content sẽ dùng cái này làm brief viết bài tuần tới.</i>`
    );
    return NextResponse.json({ ok: true, mode: "research", chars: r.summary?.length || 0 });
  }

  const n = Math.min(6, Math.max(1, Number(url.searchParams.get("n")) || 5));
  const fParam = (url.searchParams.get("funnel") || "").toUpperCase();
  const funnel = (["TOFU", "MOFU", "BOFU"].includes(fParam) ? fParam : undefined) as ("TOFU" | "MOFU" | "BOFU" | undefined);
  const t0 = Date.now();
  const r = await runFactory(n, funnel ? { funnel } : undefined);
  await ghiViecMay({
    agent: "content-factory", agentTen: "Nhà máy Content",
    viec: `Viết ${n} bài khung ${funnel ?? "trộn phễu"}`,
    trangThai: !r.ok ? "hong" : (r.saved ? "xong" : "khong_co_gi"),
    soLuong: r.saved ?? 0, donVi: "bài", chiTiet: r.ok ? null : r.error,
    link: "/content", giay: (Date.now() - t0) / 1000, canDuyet: !!r.saved,
  });
  if (!r.ok) {

    return NextResponse.json({ ok: false, error: r.error }, { status: 500 });
  }

  const pushed = await pushDraftsToCEO(r.items, url.searchParams.get("khung") || undefined);
  if (!pushed) {

    await notify(`\u{1F4DD} <b>Nhà máy Content: ${r.saved} bài nháp đã tạo</b> — mở <a href="${appLink("/content")}">/content</a> để duyệt.`);
  }
  return NextResponse.json({ ok: true, saved: r.saved, pushed, flagged: r.flagged });
}
