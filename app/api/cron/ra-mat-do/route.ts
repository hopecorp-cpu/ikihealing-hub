import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { doTatCa } from "@/lib/ra-mat-san-pham";
import { sendTelegramMay, telegramConfigured } from "@/lib/telegram";
import { appLink } from "@/lib/app-url";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;
  const sb = getServiceClient();
  const r = await doTatCa(sb);
  const canBao = r.ketQua.filter((k) => k.ngayThu === 3 || k.ngayThu === 7);
  let telegram: any = null;
  if (canBao.length && telegramConfigured()) {
    const lines = canBao.map((k) =>
      `${k.ten} — ngày ${k.ngayThu}: ${k.do.soBaiDaDang}/${k.do.soBai} bài đã đăng · ${k.do.soKhachDaBao} khách đã báo · ${k.do.soDon} đơn` +
      (k.do.soBaiDaDang === 0 ? " — CHƯA CÓ BÀI NÀO LÊN, đúng bệnh mẫu về rồi im." : ""));
    telegram = await sendTelegramMay("bao-cao-ban-hang", `ĐO RA MẮT SẢN PHẨM MỚI\n\n${lines.join("\n")}\n\nPhiếu: ${appLink("/ra-mat-san-pham")}`);
  }
  return NextResponse.json({ ok: true, ...r, telegram });
}
