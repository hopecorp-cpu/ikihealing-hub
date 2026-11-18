import { NextResponse } from "next/server";
import { runRepeatCycle } from "@/lib/repeat-cycle";
import { covanSendCEO, covanTelegramConfigured } from "@/lib/covan/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorized(req: Request): boolean {
  const url = new URL(req.url);
  const secret = (process.env.CRON_SECRET || "").trim();
  if (secret) {
    if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
    if (url.searchParams.get("key") === secret) return true;
  }
  const blogSecret = (process.env.BLOG_WRITER_SECRET || "").trim();
  if (blogSecret && req.headers.get("x-blog-secret") === blogSecret) return true;
  return false;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const kq = await runRepeatCycle();
    if (kq.tasked > 0 && covanTelegramConfigured()) {
      const lines = [
        `MÁY NHẮC ĐẶT LẠI: ${kq.tasked} khách đến chu kỳ 30-45 ngày, đã giao việc gọi lại:`,
        ...Object.entries(kq.perSale).map(([sale, n]) => `- ${sale}: ${n} khách`),
      ];
      if (kq.unmatched) lines.push(`(${kq.unmatched} khách chưa khớp sale — nằm trong task của anh để phân công)`);
      lines.push("Danh sách chi tiết trong /tasks của ikihealing-hub, tag chu-ky-dat-lai.");
      await covanSendCEO(lines.join("\n"));
    }
    return NextResponse.json({ ok: true, ...kq });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e instanceof Error ? e.message : e).slice(0, 300) },
      { status: 500 }
    );
  }
}
