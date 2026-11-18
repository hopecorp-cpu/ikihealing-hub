import { NextResponse } from "next/server";
import { buildProfitSnapshot, pickTopPlays, LEVERS } from "@/lib/profit-playbook";
import { sendTelegramWithButtons, telegramConfigured, tgEscape } from "@/lib/telegram";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { appLink } from "@/lib/app-url";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n || 0)) + "đ";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;
  if (!telegramConfigured()) return NextResponse.json({ ok: false, error: "telegram chưa cấu hình" }, { status: 500 });

  const S = await buildProfitSnapshot();
  const sentKey = `profit_playbook_sent_${S.today}`;
  if (!url.searchParams.get("force") && (await getConfigValue(sentKey))) {
    return NextResponse.json({ ok: true, skipped: "đã gửi hôm nay" });
  }

  const picks = await pickTopPlays(S, 3);
  if (!picks.length) {
    return NextResponse.json({ ok: true, note: "không có play nào kích hoạt (hoặc đều vừa đề xuất/đang đo)" });
  }

  const L = S.loop;
  const head = `<b>PROFIT PLAYBOOK — ${S.today}</b>\n` +
    `Tháng ${S.month}: ${fmt(L.monthActual)}/${fmt(L.monthTarget)} (${L.pacePct}%, nhịp chuẩn ${L.expectedPct}%). Còn ${S.daysLeft} ngày.\n` +
    `Máy soi toàn bộ số liệu và chọn ${picks.length} nước đi đáng làm NHẤT hôm nay:`;

  const body = picks.map((x, i) => {
    const p = x.play;
    return `\n\n<b>${i + 1}. [${tgEscape(LEVERS[p.lever])}] ${tgEscape(p.ten)}</b>\n` +
      `Vì sao: ${tgEscape(x.evidence)}\n` +
      `Việc cụ thể: ${tgEscape(p.viec)}\n` +
      `Đo bằng: ${p.kpi} (${p.kpiDir === "up" ? "tăng" : "giảm"} là thắng) sau ${p.doSauNgay} ngày.`;
  }).join("");

  const foot = `\n\nBấm nút để GIAO VIỆC — em ghi vào Kanban, chốt số nền hôm nay và tự đo lại sau kỳ đo.\nToàn bộ danh mục: ${appLink("/playbook-loi-nhuan")}`;

  const buttons = picks.map((x, i) => ([{ text: `Giao việc ${i + 1}: ${x.play.id}`, callback_data: `pp:${x.play.id}` }]));
  const sent = await sendTelegramWithButtons(head + body + foot, buttons);
  if (!(sent as any).ok) {
    return NextResponse.json({ ok: false, error: "gửi Telegram hỏng", resp: sent }, { status: 500 });
  }
  await setConfigValue(sentKey, new Date().toISOString(), "chống gửi trùng profit playbook");
  return NextResponse.json({ ok: true, sent: picks.map(x => x.play.id) });
}
