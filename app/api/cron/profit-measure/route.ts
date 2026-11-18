import { NextResponse } from "next/server";
import { measureDuePlays, LEVERS } from "@/lib/profit-playbook";
import { sendTelegram, sendTelegramMay, telegramConfigured, tgEscape } from "@/lib/telegram";
import { addAgentLearning } from "@/lib/agent-learning";
import { appLink } from "@/lib/app-url";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: Request) {
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;

  const { measured } = await measureDuePlays();
  if (!measured.length) return NextResponse.json({ ok: true, note: "chưa có play nào tới hạn đo" });

  const label: Record<string, string> = { thang: "THẮNG", thua: "THUA", "chua-ro": "CHƯA RÕ (đi ngang/thiếu số)" };
  const lines = measured.map(a =>
    `- [${tgEscape(LEVERS[a.lever])}] ${tgEscape(a.ten)} -> <b>${label[a.status] || a.status}</b>\n  ${tgEscape(a.resultNote || "")} (giao ${a.assignedAt})`
  );

  for (const a of measured) {
    try {
      await addAgentLearning(
        "director",
        `Play ${a.id} "${a.ten}" ${label[a.status]}: ${a.resultNote || ""}`,
        a.status === "thang" ? "win" : a.status === "thua" ? "fail" : "insight",
      );
    } catch { }
  }

  if (telegramConfigured()) {
    await sendTelegramMay("hoi-dong",
      `<b>KẾT QUẢ CÁC NƯỚC ĐI ĐÃ GIAO</b>\n${lines.join("\n")}\n\n` +
      `Play THUA: xem lại cách làm hoặc đổi nước khác — số không tự tốt lên.\nChi tiết: ${appLink("/playbook-loi-nhuan")}`
    );
  }
  return NextResponse.json({ ok: true, measured: measured.map(a => ({ id: a.id, status: a.status, note: a.resultNote })) });
}
