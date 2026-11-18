import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { chayMotLuot, guiBotSeo, seoBotToken } from "@/lib/seo-agent";
import { sendTelegramMay, tgEscape } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sb = getServiceClient();
  const secret = (process.env.CRON_SECRET || "").trim();
  const key = (url.searchParams.get("key") || url.searchParams.get("token") || "").trim();
  const tokenCfg = String((await sb.from("config").select("value").eq("key", "ads_report_token").maybeSingle()).data?.value || "").trim();
  const oke = req.headers.get("authorization") === `Bearer ${secret}`
    || (key && ((secret && key === secret) || (tokenCfg && key === tokenCfg)));
  if (!oke) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const kq = await chayMotLuot({
      dry: url.searchParams.get("dry") === "1",
      epGui: url.searchParams.get("gui") === "1" || url.searchParams.get("dry") === "1",

      gui: async (text) => {
        if (seoBotToken() && (await guiBotSeo(text)).ok) return true;
        const r: any = await sendTelegramMay("seo-agent", tgEscape(text)); return !!r?.ok;
      },
    });
    return NextResponse.json({ ok: true, ...kq });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}
