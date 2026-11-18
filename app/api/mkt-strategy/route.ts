import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove, isMktPosition } from "@/lib/auth";
import { saveStrategy } from "@/lib/mkt-strategy";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(isManagerOrAbove(user.role) || isMktPosition((user as any).position))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const content: Record<string, string> = {};
  if (b.content && typeof b.content === "object") for (const [k, v] of Object.entries(b.content)) content[k] = String(v || "");
  await saveStrategy(content, user.email || user.full_name || "");
  return NextResponse.json({ ok: true });
}
