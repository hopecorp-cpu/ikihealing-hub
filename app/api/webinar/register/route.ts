import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { insertAndAssign } from "@/lib/leads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOW_ORIGIN = (process.env.WEBINAR_ALLOW_ORIGIN || "*").trim();

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOW_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: Request) {
  let body: any = {};
  try { body = await req.json(); } catch { }

  const name = String(body.name || body.customer || "").trim();
  const phoneRaw = String(body.phone || "").trim();
  const phone = phoneRaw.replace(/[^\d+]/g, "");
  const email = String(body.email || "").trim();
  const slug = String(body.slug || body.source || "webinar").replace(/[^a-z0-9\-:]/gi, "").slice(0, 40) || "webinar";

  if (!name || phone.replace(/\D/g, "").length < 9) {
    return NextResponse.json({ ok: false, error: "Thiếu tên hoặc số điện thoại hợp lệ" }, { status: 400, headers: corsHeaders() });
  }

  const source = slug.startsWith("webinar") ? slug : `webinar:${slug}`;
  const sb = getServiceClient();

  const r = await insertAndAssign(sb, {
    customer_name: name,
    phone,
    channel: "Webinar",
    source,
    external_id: `${source}:${phone}`,
    note: email ? `Đăng ký webinar · email: ${email}` : "Đăng ký webinar",
  });

  if (!r.ok) {
    return NextResponse.json(
      { ok: false, error: r.error || "Không ghi được đăng ký (đã chạy migration 036 leads chưa?)" },
      { status: 200, headers: corsHeaders() },
    );
  }

  return NextResponse.json(
    { ok: true, id: r.id, dedup: r.dedup || false },
    { status: 200, headers: corsHeaders() },
  );
}
