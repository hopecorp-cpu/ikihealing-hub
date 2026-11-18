import { NextResponse } from "next/server";
import {
  TEN_KY,
  docKimChiNam,
  ghiMoc,
  ghiNhip,
  kyDenHan,
  soanRaSoat,
  type Ky,
} from "@/lib/covan/nhip-tien-bo";
import { covanSendCEO, covanTelegramConfigured } from "@/lib/covan/telegram";
import { vnToday } from "@/lib/covan/pnl";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return false;
  const url = new URL(req.url);
  return req.headers.get("authorization") === `Bearer ${secret}` || url.searchParams.get("key") === secret;
}

const HOP_LE: Ky[] = ["tuan", "thang", "quy", "nam"];

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const ngay = vnToday();
  const ep = url.searchParams.get("ky") as Ky | null;
  const ky: Ky | null = ep && HOP_LE.includes(ep) ? ep : kyDenHan(ngay);

  if (url.searchParams.get("dry") === "1") {
    return NextResponse.json({ ok: true, dry: true, ngay, kyDenHan: kyDenHan(ngay), seChay: ky });
  }
  if (!ky) {

    await ghiNhip("khong-den-han");
    return NextResponse.json({ ok: true, ngay, kyDenHan: null });
  }

  let kq;
  try {
    kq = await soanRaSoat(ky);
  } catch (e) {
    const loi = String(e instanceof Error ? e.message : e).slice(0, 300);
    await ghiNhip(`loi ${ky}: ${loi}`);
    return NextResponse.json({ ok: false, ky, error: loi }, { status: 500 });
  }

  const kcn = await docKimChiNam();
  const dau = `RÀ SOÁT ${TEN_KY[ky]} — ${ngay}`;
  const than = kcn ? kq.text : `${kq.text}\n\nGhi chú của em: anh chưa chốt kim chỉ nam nên phần đánh giá "đi đúng đường chưa" em còn thiếu thước đo.`;

  let sent: { ok: boolean; error?: string } = { ok: false, error: "Chưa cấu hình Telegram" };
  if (covanTelegramConfigured()) sent = await covanSendCEO(`${dau}\n\n${than}`);

  await ghiMoc({ ky, ngay, soLieu: kq.soLieu, camKet: kq.camKet });
  await ghiNhip(`ok ${ky}`);

  return NextResponse.json({
    ok: true,
    ky,
    ngay,
    camKet: kq.camKet.length,
    coKimChiNam: !!kcn,
    telegram: sent,
  });
}
