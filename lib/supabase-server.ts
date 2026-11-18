import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import * as React from "react";

const cache: <T extends (...a: any[]) => any>(f: T) => T = (React as any).cache ?? ((f: any) => f);
import type { AppUser } from "./supabase-types";

export function getServerClient() {
  const cookieStore = cookies();
  return createServerClient(
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
}

export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },

      global: { fetch: (url: any, opts: any = {}) => fetch(url, { ...opts, cache: "no-store" }) },
    }
  );
}

export const getCurrentUser = cache(async function getCurrentUser(): Promise<AppUser | null> {
  const sb = getServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const admin = getServiceClient();
  const { data } = await admin.from("users").select("*").eq("id", user.id).maybeSingle();

  if (data && (data as any).active === false) return null;
  return data as AppUser | null;
});

export type { AppUser } from "./supabase-types";
