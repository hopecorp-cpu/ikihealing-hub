import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.startsWith("/\\")
    ? rawNext
    : "/";

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (list: { name: string; value: string; options?: any }[]) =>
            list.forEach(({ name, value, options }) => {
              try { cookieStore.set(name, value, options); } catch {}
            })
        }
      }
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
