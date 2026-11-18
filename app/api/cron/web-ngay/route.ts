import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { setConfigValue } from "@/lib/app-config";
import { chayMotLuot } from "@/lib/web-ngay";
import { sendTelegramMay, tgEscape } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sb = getServiceClient();
  const secret = (process.env.CRON_SECRET || "").trim();
  const key = (url.searchParams.get("key") || url.searchParams.get("token") || "").trim();
  const tokenCfg = String((await sb.from("config").select("value").eq("key", "ads_report_token").maybeSingle()).data?.value || "").trim();
  const oke = req.headers.get("authorization") === `Bearer ${secret}`
    || (key && ((secret && key === secret) || (tokenCfg && key === tokenCfg)));
  if (!oke) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dry = url.searchParams.get("dry") === "1";
  const ngay = url.searchParams.get("ngay") || undefined;
  const bu = Math.min(60, Math.max(0, Number(url.searchParams.get("bu") || 0)));
  try {
    const { text, anh } = await chayMotLuot({ ngay, soNgayBu: bu });
    if (!dry) await sendTelegramMay("web-ngay", tgEscape(text));
    await setConfigValue("web_ngay_last", JSON.stringify({
      at: new Date().toISOString(), ngay: anh.ngay, nguoiDung: anh.ga4?.nguoiDung ?? null,
      lienHe: anh.cd.sdt + anh.cd.emailKhongSdt, dry,
    }), "Nhịp tim báo cáo web theo ngày (GA4 + chuyển đổi), 09:15");
    return NextResponse.json({ ok: true, dry, ngay: anh.ngay, ga4: anh.ga4, cd: anh.cd, text });
  } catch (e: any) {
    const loi = String(e?.message || e).slice(0, 300);
    await setConfigValue("web_ngay_status", JSON.stringify({ at: new Date().toISOString(), ok: false, error: loi }),
      "Trạng thái báo cáo web theo ngày").catch(() => {});
    return NextResponse.json({ ok: false, error: loi }, { status: 500 });
  }
}
