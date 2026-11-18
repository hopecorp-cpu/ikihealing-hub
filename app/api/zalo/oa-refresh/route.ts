import { NextResponse } from "next/server";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { docTokenOa, ghiTokenOa } from "@/lib/zalo-oa-token";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const chanKhoa = await chanMay(req, [khoaCron({ bearer: true })]);
  if (chanKhoa) return chanKhoa;
  const appId = (process.env.ZALO_OA_APP_ID || "").trim();
  const appSecret = (process.env.ZALO_OA_APP_SECRET || "").trim();
  if (!appId || !appSecret) return NextResponse.json({ ok: false, error: "thiếu ZALO_OA_APP_ID/APP_SECRET" });

  let cur: any = {};
  try { cur = await docTokenOa(); } catch { }
  const refresh = (cur.refresh_token || process.env.ZALO_OA_REFRESH_TOKEN || "").trim();
  if (!refresh) return NextResponse.json({ ok: false, error: "chưa có refresh_token trong config zalo_oa_token" });

  try {
    const res = await fetch("https://oauth.zaloapp.com/v4/oa/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", secret_key: appSecret },
      body: new URLSearchParams({ app_id: appId, grant_type: "refresh_token", refresh_token: refresh }),
      cache: "no-store",
    });
    const j: any = await res.json().catch(() => ({}));
    if (!j.access_token) return NextResponse.json({ ok: false, error: j.error_description || j.error || "refresh lỗi", raw: j });
    await ghiTokenOa({
      access_token: j.access_token, refresh_token: j.refresh_token || refresh,
      expires_in: j.expires_in, updatedAt: new Date().toISOString(),
    }, "Token Zalo OA (tự làm mới)");
    return NextResponse.json({ ok: true, refreshedAt: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) });
  }
}
