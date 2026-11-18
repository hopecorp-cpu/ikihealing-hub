import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { setConfigValue } from "@/lib/app-config";
import { quetMotLuot } from "@/lib/chi-muc";
import { saConfigured } from "@/lib/google-sa";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sb = getServiceClient();
  const secret = (process.env.CRON_SECRET || "").trim();
  const key = (url.searchParams.get("key") || "").trim();
  const tokenCfg = String((await sb.from("config").select("value").eq("key", "ads_report_token").maybeSingle()).data?.value || "").trim();
  const oke = req.headers.get("authorization") === `Bearer ${secret}` || (!!secret && key === secret) || (!!tokenCfg && key === tokenCfg);
  if (!oke) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!saConfigured()) {
    return NextResponse.json({ ok: true, boQua: "chưa có GOOGLE_OAUTH_JSON — chạy scripts/google-oauth-setup.mjs --day-len" });
  }

  const soLuong = Math.min(120, Number(url.searchParams.get("so")) || 60);
  try {
    const kq = await quetMotLuot(soLuong, Date.now() + 240_000);
    await setConfigValue("chi_muc_quet_last", JSON.stringify({ at: new Date().toISOString(), ...kq }),
      "Nhip tim may quet chi muc Google");
    return NextResponse.json({ ok: true, ...kq });
  } catch (e: any) {

    return NextResponse.json({ error: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}
