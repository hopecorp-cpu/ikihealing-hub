import { NextResponse } from "next/server";
import { setConfigValue } from "@/lib/app-config";
import { sendTelegram } from "@/lib/telegram";
import { appLink } from "@/lib/app-url";
import { chanMay, khoaCron } from "@/lib/kiem-cron";
import { soanBoBai } from "@/lib/bo-bai-doi-tac-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: Request) {
  const chan = await chanMay(req, [khoaCron()]);
  if (chan) return chan;
  const r = await soanBoBai().catch((e) => ({ ok: false, luu: 0, coLoi: 0, loi: String(e?.message || e) }));
  await setConfigValue("bo_bai_doi_tac_soan", JSON.stringify({ at: new Date().toISOString(), ok: r.ok, luu: r.luu, coLoi: r.coLoi, loi: r.loi || null }),
    "Lần máy soạn bộ bài đối tác gần nhất (watchdog đọc)");
  const chu = r.ok
    ? `<b>Bộ bài đối tác hôm nay</b>\nMáy đã soạn ${r.luu} bài mẫu cho CTV / đại lý chép đăng${r.coLoi ? `, ${r.coLoi} bài dính từ cấm cần sửa` : ""}.\nBài chỉ sang app CTV sau khi anh duyệt: ${appLink("/bo-bai-doi-tac")}`
    : `<b>Bộ bài đối tác — HỎNG</b>\nSáng nay máy không soạn được bài (${r.loi}). Đối tác sẽ không có bài mới.\nThử lại: ${appLink("/bo-bai-doi-tac")}`;
  const t = await sendTelegram(chu).catch(() => null);
  return NextResponse.json({ ...r, telegram: !!t?.ok }, { status: r.ok ? 200 : 500 });
}
