import { NextResponse } from "next/server";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function gate() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!(user.role === "admin" || user.role === "ceo" || isManagerOrAbove(user.role))) return null;
  return user;
}

export async function POST(req: Request) {
  if (!(await gate())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const sb = getServiceClient();
  let prev: any = {}; try { prev = JSON.parse((await sb.from("config").select("value").eq("key", "misa_recrawl").maybeSingle()).data?.value || "{}"); } catch { }
  const otp = (body.otp || "").toString().trim();
  const rec = {
    requestedAt: new Date().toISOString(),
    handledAt: null,
    status: "queued",
    msg: otp ? "Đã nhận OTP — đang xử lý…" : "Đã yêu cầu — watcher sẽ chạy trong ~1 phút.",
    ...(otp ? { otp } : {}),
  };
  await sb.from("config").upsert({ key: "misa_recrawl", value: JSON.stringify(rec) }, { onConflict: "key" });
  return NextResponse.json({ ok: true, status: rec.status });
}

export async function GET() {
  if (!(await gate())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  const sb = getServiceClient();
  let rec: any = {}, sess: any = {};
  try { rec = JSON.parse((await sb.from("config").select("value").eq("key", "misa_recrawl").maybeSingle()).data?.value || "{}"); } catch { }
  try { sess = JSON.parse((await sb.from("config").select("value").eq("key", "misa_session_status").maybeSingle()).data?.value || "{}"); } catch { }
  const { data: fresh } = await sb.from("mshopkeeper_line_items").select("order_date").order("order_date", { ascending: false }).limit(1);

  const { otp, ...safe } = rec;
  return NextResponse.json({ ok: true, recrawl: safe, session: sess, latestData: fresh?.[0]?.order_date || null });
}
