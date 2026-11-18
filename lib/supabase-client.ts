import { createBrowserClient } from "@supabase/ssr";

let _sb: ReturnType<typeof createBrowserClient> | null = null;

export function getBrowserClient() {
  if (_sb) return _sb;
  _sb = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return _sb;
}

export type { AppUser } from "./supabase-types";
