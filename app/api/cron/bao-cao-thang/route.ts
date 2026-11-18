import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { sendTelegramMay } from "@/lib/telegram";
import { appLink } from "@/lib/app-url";
import { vnDateStr } from "@/lib/payroll";
import { taoBaoCaoThang } from "@/lib/bao-cao-thang";
import { computePnl, tr } from "@/lib/covan/pnl";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;

  const sb = getServiceClient();
  const homNay = vnDateStr();
  const thangNay = homNay.slice(0, 7);
  const mChon = url.searchParams.get("m");

  const out: any = { ok: true };

  const d = new Date(`${thangNay}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1);
  const thangBc = mChon || d.toISOString().slice(0, 7);
  const bc = await taoBaoCaoThang(sb, thangBc);
  await setConfigValue(`bao_cao_thang_${thangBc}`, JSON.stringify(bc), `Báo cáo tháng ${thangBc} (máy soạn)`);
  out.baoCao = `${thangBc}: ${bc.md.length} ký tự, lưu config bao_cao_thang_${thangBc}`;

  const sentKey = `bao_cao_thang_sent_${thangBc}`;
  if ((await getConfigValue(sentKey)) === "1") {
    out.telegram = "đã gửi báo cáo tháng này rồi";
  } else {
    const t = await sendTelegramMay("tai-chinh",
      bc.tomTatTelegram.split("\n").map((l, i) => i === 0 ? `<b>${l}</b>` : l).join("\n")
      + (await khoiPnl(thangBc))
      + `\n\nBản đầy đủ: <a href="${appLink(`/bao-cao-thang?m=${thangBc}`)}">/bao-cao-thang</a>`);
    out.telegram = t.ok ? "đã gửi TGĐ" : t;
    if (t.ok) await setConfigValue(sentKey, "1", `Đã gửi Telegram báo cáo tháng ${thangBc}`);
  }

  return NextResponse.json(out);
}

async function khoiPnl(thang: string): Promise<string> {
  try {
    const p = (await computePnl()).pnl.find((x) => x.month === thang);
    if (!p) return `\n\nP&L ${thang}: chưa có số.`;
    const bg = p.gross != null && p.revenue ? `${Math.round((p.gross / p.revenue) * 1000) / 10}%` : "chưa có giá vốn";
    return [``, ``, `<b>P&L ${thang.slice(5)}/${thang.slice(0, 4)}</b> (sổ sách, tham khảo)`,
      `Doanh thu: ${tr(p.revenue)} · biên gộp ${bg}`,
      `Lương (tổng): ${tr(p.payroll)} · Ads: ${tr(p.ads)} · Ship: ${tr(p.ship)}`,
      `Chi vận hành: ${tr(p.opex)} · Lãi vay: ${tr(p.interest)}`,
      `Lãi vận hành: <b>${tr(p.net_operating)}</b>`,
      `Lưu ý: ads và ship đang ghi thiếu, giá vốn còn đọc MISA — lãi thật thấp hơn số này.`].join("\n");
  } catch (e: any) {
    return `\n\nP&L ${thang}: lỗi khi tính (${String(e?.message || e).slice(0, 80)}).`;
  }
}
