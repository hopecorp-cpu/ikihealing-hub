import { NextResponse } from "next/server";
import { harvestAsk, ingestStories } from "@/lib/case-study";
import { covanSendCEO, covanTelegramConfigured } from "@/lib/covan/telegram";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;
  try {
    const ingest = await ingestStories();
    const ask = await harvestAsk();
    if (covanTelegramConfigured() && (ingest.ingested > 0 || ask.tasked > 0)) {
      const parts: string[] = ["MÁY GẶT CASE STUDY"];
      if (ingest.ingested) parts.push(`Vừa gặt được ${ingest.ingested} câu chuyện khách mới (kho hiện có ${ingest.total}) — Nhà máy Content sẽ dùng làm bài "Câu chuyện khách hàng".`);
      if (ask.tasked) parts.push(`Đã giao ${ask.tasked} việc xin cảm nhận cho sale (khách vừa quay lại mua lần 2+, tổng ${ask.due} khách đủ điều kiện).`);
      await covanSendCEO(parts.join("\n"));
    }
    return NextResponse.json({ ok: true, ...ingest, ...ask });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
