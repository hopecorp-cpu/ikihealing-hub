import { NextResponse } from "next/server";
import { chayMotLuot, docSo, ghiNhip, ghiSo, huongCuaLuot, soanTin } from "@/lib/covan/hoc-the-gioi";
import { covanSendCEO, covanTelegramConfigured } from "@/lib/covan/telegram";
import { ghiViecMay } from "@/lib/viec-may";
import { vnToday } from "@/lib/covan/pnl";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return false;
  const url = new URL(req.url);
  return req.headers.get("authorization") === `Bearer ${secret}` || url.searchParams.get("key") === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const luot = Math.max(0, Math.min(2, Number(url.searchParams.get("luot") || 0) || 0));
  const ngay = vnToday();

  if (url.searchParams.get("dry") === "1") {
    const so = await docSo();
    return NextResponse.json({ ok: true, dry: true, ngay, luot, huong: huongCuaLuot(ngay, luot), daHoc: so.luot });
  }

  const t0 = Date.now();
  let kq;
  try {
    kq = await chayMotLuot(luot);
  } catch (e) {
    const loi = String(e instanceof Error ? e.message : e).slice(0, 300);
    await ghiNhip(`loi: ${loi}`);
    await ghiViecMay({
      agent: "hoc-the-gioi", agentTen: "Máy học thế giới", viec: `Lượt ${luot} — học và soi lại ACME`,
      trangThai: "hong", chiTiet: loi, giay: (Date.now() - t0) / 1000,
    });
    return NextResponse.json({ ok: false, luot, error: loi }, { status: 500 });
  }

  if (!kq.ok) {
    await ghiNhip(`khong-ra-chuyen: ${kq.loi || ""}`.slice(0, 200));

    await ghiViecMay({
      agent: "hoc-the-gioi", agentTen: "Máy học thế giới", viec: `Lượt ${luot} — hướng ${kq.huong}`,
      trangThai: "khong_co_gi", chiTiet: kq.loi || "không tìm được chuyện đáng kể",
      giay: (Date.now() - t0) / 1000,
    });
    return NextResponse.json({ ok: true, luot, huong: kq.huong, guiCEO: false, lyDo: kq.loi });
  }

  let sent: { ok: boolean; error?: string } = { ok: false, error: "Chưa cấu hình Telegram" };
  if (covanTelegramConfigured()) sent = await covanSendCEO(soanTin(kq, luot));

  await ghiSo(luot);
  await ghiNhip("ok");
  await ghiViecMay({
    agent: "hoc-the-gioi", agentTen: "Máy học thế giới",
    viec: `Lượt ${luot} — hướng ${kq.huong}, soi lại ACME bằng số thật`,
    trangThai: "xong", soLuong: kq.nguyenLy.length, donVi: "nguyên lý",
    chiTiet: kq.nguon || null, giay: (Date.now() - t0) / 1000,
  });
  return NextResponse.json({
    ok: true,
    luot,
    huong: kq.huong,
    nguyenLy: kq.nguyenLy.length,
    nguon: kq.nguon,
    telegram: sent,
  });
}
