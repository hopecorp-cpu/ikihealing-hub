import { NextResponse } from "next/server";
import { nhipTruc, caiDatMayTruc } from "@/lib/tra-loi-nhu-nguoi";
import { sendTelegramMay, telegramConfigured, tgEscape } from "@/lib/telegram";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;

  try {
    const cai = await caiDatMayTruc();
    const kq = await nhipTruc();

    if (url.searchParams.get("bao") === "1" && telegramConfigured() && (kq.gui || kq.chuyenSale || kq.ngoaiCuaSo)) {
      const L = [
        `\u{1F916} <b>MÁY TRỰC FACEBOOK</b> — nhịp ${new Date().toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" })}`,
        `Máy trả lời <b>${kq.gui}</b> · nhường người <b>${kq.nhuongNguoi}</b> · chuyển sale <b>${kq.chuyenSale}</b>`
        + (kq.ngoaiCuaSo ? ` · quá 24h phải dán tay <b>${kq.ngoaiCuaSo}</b>` : ``)
        + (kq.loi ? ` · lỗi ${kq.loi}` : ``),
        ...(kq.chuyenSale ? [``, `Việc cần người:`, ...kq.chiTiet.filter((c) => c.ket === "chuyển sale" || c.ket === "ngoài cửa sổ 24h")
          .slice(0, 6).map((c) => `• ${tgEscape(c.ten)} — ${tgEscape(c.lyDo || c.ket)}`)] : []),
      ];
      await sendTelegramMay("phan-hoi-khach", L.join("\n")).catch(() => null);
    }

    return NextResponse.json({ ok: true, bat: cai.bat, ...kq, chiTiet: kq.chiTiet.slice(0, 12) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}
