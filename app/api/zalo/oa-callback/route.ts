import { NextResponse } from "next/server";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { docTokenOa, ghiTokenOa } from "@/lib/zalo-oa-token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const OK_HTML = (title: string, body: string, good = true) => `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;font:16px/1.6 system-ui,-apple-system,sans-serif;background:#FBFAF7;color:#16211B;display:grid;place-items:center;min-height:100vh">
<div style="max-width:34rem;padding:2rem;background:#fff;border:1px solid #E2E6E1;border-radius:14px;box-shadow:0 6px 24px rgba(0,0,0,.06)">
<div style="font-size:2.5rem;line-height:1">${good ? "\u{2705}" : "\u{26A0}"}</div>
<h1 style="font-size:1.35rem;margin:.6rem 0 .5rem">${title}</h1>
<div style="color:#6B7A72">${body}</div>
</div></body></html>`;

const escHtml = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET(req: Request) {
  const url = new URL(req.url);
  const appId = (process.env.ZALO_OA_APP_ID || "").trim();
  const appSecret = (process.env.ZALO_OA_APP_SECRET || "").trim();
  const redirectUri = `${url.origin}/api/zalo/oa-callback`;

  if (!appId || !appSecret) {
    return new NextResponse(
      OK_HTML("Chưa cấu hình", "Thiếu <code>ZALO_OA_APP_ID</code> hoặc <code>ZALO_OA_APP_SECRET</code> trên Vercel.", false),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  if (url.searchParams.get("start")) {
    const to = `https://oauth.zaloapp.com/v4/oa/permission?app_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    return NextResponse.redirect(to);
  }

  if (url.searchParams.get("status")) {
    let c: any = {};
    try { c = await docTokenOa(); } catch { }
    return NextResponse.json({
      ok: !!c.access_token,
      hasAccessToken: !!c.access_token,
      hasRefreshToken: !!c.refresh_token,
      updatedAt: c.updatedAt || null,
      redirectUri,
    });
  }

  const code = url.searchParams.get("code");
  const oaId = url.searchParams.get("oa_id") || "";
  if (!code) {
    return new NextResponse(
      OK_HTML(
        "Chưa có mã cấp quyền",
        `Mở <a href="${url.origin}/api/zalo/oa-callback?start=1">đường dẫn cấp quyền</a> rồi bấm <b>Cho phép</b>.<br><br>
         Nhớ khai <code>${redirectUri}</code> làm redirect URI trong app Zalo.`,
        false
      ),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  try {
    const res = await fetch("https://oauth.zaloapp.com/v4/oa/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", secret_key: appSecret },
      body: new URLSearchParams({ app_id: appId, grant_type: "authorization_code", code }),
      cache: "no-store",
    });
    const j: any = await res.json().catch(() => ({}));
    if (!j.access_token) {
      return new NextResponse(
        OK_HTML(
          "Đổi mã không thành công",
          `Zalo báo: <code>${escHtml(String(j.error_description || j.error || JSON.stringify(j)).slice(0, 300))}</code><br><br>
           Mã cấp quyền chỉ sống vài phút và dùng được 1 lần — mở lại
           <a href="${url.origin}/api/zalo/oa-callback?start=1">đường dẫn cấp quyền</a> để thử lại.`,
          false
        ),
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }
    await ghiTokenOa(
      {
        access_token: j.access_token,
        refresh_token: j.refresh_token || "",
        expires_in: j.expires_in,
        oa_id: oaId,
        updatedAt: new Date().toISOString(),
      },
      "Token Zalo OA (tự làm mới mỗi 12h qua cron oa-refresh)"
    );
    return new NextResponse(
      OK_HTML(
        "Xong rồi CEO!",
        `Trợ lý đã kết nối được với Zalo OA${oaId ? ` (mã OA ${escHtml(oaId)})` : ""}.<br><br>
         Token đã cất an toàn vào kho. Hệ thống <b>tự làm mới mỗi 12 tiếng</b> — anh không phải đụng lại lần nữa.<br><br>
         Anh đóng tab này và báo em một câu là được.`
      ),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  } catch (e: any) {
    return new NextResponse(OK_HTML("Lỗi mạng", String(e?.message || e), false), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}
