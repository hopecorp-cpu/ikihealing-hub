import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { sendBrainTelegram, brainBotConfigured, sendTelegram, telegramConfigured, dichCuaMay, ghiLogMayNgam } from "@/lib/telegram";
import { appLink } from "@/lib/app-url";
import { chanMay, khoaCron } from "@/lib/kiem-cron";
import { tongDoanhThu } from "@/lib/doanh-thu";
import { vnDateStr } from "@/lib/payroll";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function notify(text: string, riengCEO = false) {

  const dich = riengCEO ? undefined : await dichCuaMay("may-hong");
  if (dich && brainBotConfigured()) {
    const r = await sendBrainTelegram(dich, text);
    await ghiLogMayNgam("misa-watch", "gửi thẳng nhóm máy", text);
    return r;
  }
  const ceo = (process.env.TELEGRAM_CHAT_ID || "").trim();
  if (brainBotConfigured() && ceo) return sendBrainTelegram(ceo, text);
  if (telegramConfigured()) return sendTelegram(text);
  return { ok: false as const, error: "no telegram" };
}

async function currentMonthRevenue(sb: any): Promise<{ dt: number; orders: number; latest: string } | null> {
  const homNay = vnDateStr();
  const { net, soDon, theoNgay } = await tongDoanhThu(sb, `${homNay.slice(0, 7)}-01`, homNay);
  return { dt: net, orders: soDon, latest: theoNgay[theoNgay.length - 1]?.ngay || "" };
}

const fmtM = (n: number) => (n / 1_000_000).toFixed(1) + "tr";

export async function GET(req: Request) {
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;

  const sb = getServiceClient();
  let mr: any = null;
  try { mr = JSON.parse((await sb.from("config").select("value").eq("key", "misa_recrawl").maybeSingle()).data?.value || "null"); } catch {}
  if (!mr || !mr.status) return NextResponse.json({ ok: true, skip: "no_flag" });

  const terminal = ["need_otp", "error", "done"];
  if (!terminal.includes(mr.status)) return NextResponse.json({ ok: true, skip: mr.status });

  const stamp = `${mr.status}@${mr.at || ""}`;
  const notified = (await sb.from("config").select("value").eq("key", "misa_recrawl_notified").maybeSingle()).data?.value || "";
  if (notified === stamp) return NextResponse.json({ ok: true, skip: "already_notified" });

  let text = "";
  if (mr.status === "need_otp") {
    text =
      "\u{1F510} <b>Cào MISA đang chờ mã OTP</b>\n" +
      "Phiên đăng nhập MISA hết hạn — MISA vừa gửi mã về điện thoại/email của anh.\n\n" +
      "\u{1F449} Anh <b>nhắn mã (4-8 số) thẳng vào đây</b> cho em, em đăng nhập lại & cào tiếp ngay (1-2 phút).\n" +
      "Không cần mở web. Nếu không nhận được mã, anh mở MISA bấm gửi lại mã nhé.";
  } else if (mr.status === "error") {
    text = "\u{26A0} <b>Cào MISA lỗi</b> — " + (mr.msg || "kiểm tra lại.") + `\n\nAnh xem <a href="${appLink("/kho")}">Kho</a> hoặc bảo em thử lại.`;
  } else if (mr.status === "done") {
    const rev = await currentMonthRevenue(sb);
    text =
      "\u{2705} <b>Đã cào xong MISA</b> (đơn + tồn kho) — số liệu đã tươi.\n" +
      (rev ? `Doanh thu tháng này: <b>${fmtM(rev.dt)}</b> · ${rev.orders} đơn · đơn mới nhất ${rev.latest}.` : "") +
      `\n\n\u{1F449} <a href="${appLink("/vong-lap-doanh-thu")}">Xem vòng lặp doanh thu</a>`;
  }

  const sent = await notify(text, mr.status === "need_otp");

  if ((sent as any).ok !== false) {
    await sb.from("config").upsert({ key: "misa_recrawl_notified", value: stamp }, { onConflict: "key" });
  }
  return NextResponse.json({ ok: true, status: mr.status, sent: (sent as any).ok !== false });
}
