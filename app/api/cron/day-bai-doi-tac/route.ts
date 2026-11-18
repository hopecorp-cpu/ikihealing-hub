import { NextResponse } from "next/server";
import { setConfigValue } from "@/lib/app-config";
import { chanMay, khoaCron } from "@/lib/kiem-cron";
import { baiDaDuyet, dayBaiSangCtv } from "@/lib/bo-bai-doi-tac-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const chan = await chanMay(req, [khoaCron()]);
  if (chan) return chan;
  if (new URL(req.url).searchParams.get("dry") === "1") {
    const bai = await baiDaDuyet();
    return NextResponse.json({ ok: true, dry: true, bai: bai.length, mau: bai.slice(0, 2) });
  }
  const r = await dayBaiSangCtv().catch((e) => ({ ok: false, bai: 0, loi: String(e?.message || e) }));
  await setConfigValue("bo_bai_doi_tac_day", JSON.stringify({ at: new Date().toISOString(), ok: r.ok, bai: r.bai, loi: r.loi || null }),
    "Lần đẩy bộ bài đối tác sang app CTV gần nhất (watchdog đọc)");
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
