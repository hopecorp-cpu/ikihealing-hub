import { NextResponse } from "next/server";
import { runEvals } from "@/lib/covan/evals";
import { covanSendCEO, covanTelegramConfigured } from "@/lib/covan/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

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

  const kq = await runEvals();
  const truot = kq.chiTiet.filter((c) => !c.dat);

  const dau = `KIỂM TRA SỨC KHỎE AI TUẦN: đạt ${kq.diem}/${kq.tong}`;
  const parts: string[] = [kq.diem < 16 ? `CẢNH BÁO: ${dau}` : dau];

  if (kq.lanTruoc == null) {
    parts.push("Lần chấm đầu tiên, chưa có mốc so sánh.");
  } else {
    const lech = kq.diem - kq.lanTruoc;
    parts.push(
      lech > 0
        ? `So với lần trước (${kq.lanTruoc}/${kq.tong}): TĂNG ${lech} điểm.`
        : lech < 0
          ? `So với lần trước (${kq.lanTruoc}/${kq.tong}): GIẢM ${-lech} điểm.`
          : `So với lần trước (${kq.lanTruoc}/${kq.tong}): giữ nguyên.`
    );
  }

  parts.push(
    truot.length
      ? "Ca TRƯỢT:\n" + truot.map((c) => `- ${c.id}: ${c.ghiChu}`).join("\n")
      : "Không có ca trượt."
  );

  let sent: { ok: boolean; error?: string } = { ok: false, error: "Chưa cấu hình Telegram" };
  if (covanTelegramConfigured()) {
    sent = await covanSendCEO(parts.join("\n\n"));
  }

  return NextResponse.json({
    ok: true,
    diem: kq.diem,
    tong: kq.tong,
    truot: truot.length,
    lanTruoc: kq.lanTruoc,
    lichSuLoi: kq.lichSuLoi,
    telegram: sent,
  });
}
