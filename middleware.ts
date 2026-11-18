import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { quyetDinhDuong } from "@/lib/bod-quyen";

export async function middleware(req: NextRequest) {

  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-acme-path", req.nextUrl.pathname);
  const res = NextResponse.next({ request: { headers: reqHeaders } });
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list: { name: string; value: string; options?: any }[]) =>
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
      }
    }
  );

  let user: unknown = null;
  try {
    const { data } = await sb.auth.getClaims();
    user = data?.claims?.sub ? data.claims : null;
  } catch {
    user = (await sb.auth.getUser()).data.user;
  }
  const path = req.nextUrl.pathname;
  const isPublic = path === "/login" || path === "/reset-password" || path.startsWith("/auth/callback") || path.startsWith("/_next") || path.startsWith("/api/auth") || path.startsWith("/api/external-orders")
    || path.startsWith("/api/cron/")
    || path === "/api/cuoc-goi/tai-len"
    || path === "/api/bang-viec/day"
    || path === "/api/may/ban-do"
    || path.startsWith("/api/leads/")
    || path.startsWith("/api/zalo/")
    || path.startsWith("/api/zalo-bot/")
    || path.startsWith("/api/telegram/")
    || path.startsWith("/api/covan/")
    || path.startsWith("/api/cc")
    || path.startsWith("/api/content/nhac-dang")
    || path.startsWith("/api/blog-lead")
    || path.startsWith("/api/ebook-lead")
    || path.startsWith("/api/web-lead")
    || path.startsWith("/api/quiz-submit")
    || path.startsWith("/api/survey-submit")
    || path.startsWith("/api/quiz-data")
    || path.startsWith("/api/huy-nhan")
    || path.startsWith("/api/quyen-du-lieu")
    || path.startsWith("/quet-zalo/")
    || path.startsWith("/api/hop-thu-zalo/quet/")
    || path.startsWith("/api/quiz-pay/")
    || path.startsWith("/api/fb/")
    || path.startsWith("/api/tiktok/")
    || path === "/api/shopee/callback"
    || path.startsWith("/api/shop/pinterest-feed")
    || path.startsWith("/api/shop/san-pham")
    || path.startsWith("/api/flash-deal")
    || path.startsWith("/api/funnel")
    || path.startsWith("/api/track")
    || path.startsWith("/di/")
    || path.startsWith("/api/resend-webhook")
    || path.startsWith("/api/tro-ly-voice")
    || path.startsWith("/xuong/")
    || path.startsWith("/api/xuong-video/")
    || path.startsWith("/ung-tuyen/");
  if (!user && !isPublic) return NextResponse.redirect(new URL("/login", req.url));
  if (user && path === "/login") return NextResponse.redirect(new URL("/", req.url));
  if (user) {
    const role = await docRoleBod(sb, user.id);
    if (quyetDinhDuong(role, path) === "cam") {
      const denied = path.startsWith("/api/")
        ? NextResponse.json({ error: "forbidden" }, { status: 403 })
        : NextResponse.redirect(new URL("/?denied=bod", req.url));
      for (const c of res.cookies.getAll()) denied.cookies.set(c);
      return denied;
    }
  }
  return res;
}

async function docRoleBod(sb: { from: (table: string) => any }, userId: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    try {
      const r = await fetch(`${url}/rest/v1/users?id=eq.${userId}&select=role`, {
        headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
        cache: "no-store",
      });
      if (r.ok) {
        const rows = await r.json();
        if (Array.isArray(rows)) return rows[0]?.role ?? null;
      }
    } catch {  }
  }
  const { data } = await sb.from("users").select("role").eq("id", userId).maybeSingle();
  return data?.role ?? null;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.|icon-.*|apple-touch-icon|manifest\\.webmanifest|logo/.*|sw\\.js).*)"
  ]
};
