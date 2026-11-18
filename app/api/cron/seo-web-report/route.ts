import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { setConfigValue } from "@/lib/app-config";
import { chayMotLuot } from "@/lib/seo-web";
import { sendTelegramMay, tgEscape } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sb = getServiceClient();
  const secret = (process.env.CRON_SECRET || "").trim();
  const key = (url.searchParams.get("key") || "").trim();

  const tokenCfg = String((await sb.from("config").select("value").eq("key", "ads_report_token").maybeSingle()).data?.value || "").trim();
  const oke = req.headers.get("authorization") === `Bearer ${secret}`
    || (key && ((secret && key === secret) || (tokenCfg && key === tokenCfg)));
  if (!oke) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dry = url.searchParams.get("dry") === "1";
  try {
    const { text, nay } = await chayMotLuot();
    if (!dry) await sendTelegramMay("seo-web", tgEscape(text));
    await setConfigValue("seo_web_last", JSON.stringify({
      at: new Date().toISOString(), ky: nay.ky, clicks: nay.gsc.clicks, impressions: nay.gsc.impressions, dry,
    }), "Nhịp tim báo cáo website hằng tuần (Search Console + GA4)");
    return NextResponse.json({ ok: true, dry, ky: nay.ky, clicks: nay.gsc.clicks, text });
  } catch (e: any) {
    const loi = String(e?.message || e).slice(0, 300);

    await setConfigValue("seo_web_status", JSON.stringify({ at: new Date().toISOString(), ok: false, error: loi }),
      "Trạng thái nguồn Search Console / GA4").catch(() => {});
    return NextResponse.json({ ok: false, error: loi }, { status: 500 });
  }
}
