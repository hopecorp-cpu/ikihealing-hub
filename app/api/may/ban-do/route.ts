import { NextResponse } from "next/server";
import { getServiceClient, getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { layBanDoMay } from "@/lib/may-chay-ngam";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = (url.searchParams.get("key") || url.searchParams.get("token") || "").trim();
  const secret = (process.env.CRON_SECRET || "").trim();

  let oke = false;
  if (key) {
    const sb = getServiceClient();
    const tokenCfg = String((await sb.from("config").select("value").eq("key", "ads_report_token").maybeSingle()).data?.value || "").trim();
    oke = (!!secret && key === secret) || (!!tokenCfg && key === tokenCfg);
  } else {
    const user = await getCurrentUser();
    oke = !!user && isManagerOrAbove(user.role);
  }
  if (!oke) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const banDo = await layBanDoMay();

  return NextResponse.json({
    luc: new Date().toISOString(),
    dem: banDo.dem,
    nhipMac: banDo.nhipMac,
    choXuLy: banDo.hangDoi.filter((h) => !h.xong).length,
    chuoi: banDo.chuoi.map((c) => ({
      ma: c.ma, ten: c.ten, moTa: c.moTa,
      may: c.may.map((m) => ({
        key: m.key, ten: m.ten, noiChay: m.noiChay, trangThai: m.trangThai,
        tuoiGio: m.tuoiGio, tranGio: m.tranGio, chiThamKhao: m.chiThamKhao,
        chayLai: m.chayLai.kieu,
      })),
    })),
  });
}
