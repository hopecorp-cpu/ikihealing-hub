import { NextResponse } from "next/server";
import { handleWebhookBody, subscribePages, listPages, getAutoReplyConfig } from "@/lib/fb-autoreply";
import { chuKyFbHopLe } from "@/lib/fb-chu-ky";

export const dynamic = "force-dynamic";

const verifyToken = () => (process.env.FB_VERIFY_TOKEN || process.env.CRON_SECRET || "").trim();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.CRON_SECRET;
  const key = url.searchParams.get("key");

  const authed = !!secret && (key === secret || req.headers.get("authorization") === `Bearer ${secret}`);

  if (url.searchParams.get("setup") === "go") {
    if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
      return NextResponse.json({ ok: true, pages: await subscribePages() });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
    }
  }
  if (url.searchParams.get("status") === "go") {
    if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const cfg = await getAutoReplyConfig();
    return NextResponse.json({
      ok: true,
      enabled: cfg.enabled,
      cooldownHours: cfg.cooldownHours,
      buttons: cfg.buttons,
      verifyTokenSet: !!verifyToken(),
      pages: await listPages().catch(() => []),
    });
  }

  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === verifyToken()) {
    return new NextResponse(challenge || "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  if (mode === "subscribe") return NextResponse.json({ error: "verify_token sai" }, { status: 403 });
  return NextResponse.json({ ok: true, note: "Webhook tin nhắn fanpage NOVA. Facebook gọi POST vào đây." });
}

export async function POST(req: Request) {

  const raw = await req.text();
  if (!chuKyFbHopLe(raw, req.headers.get("x-hub-signature-256"), process.env.FB_APP_SECRET)) {
    return NextResponse.json({ ok: false, error: "chữ ký không hợp lệ" }, { status: 401 });
  }
  let body: any = null;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "body không phải JSON" }, { status: 400 });
  }

  if (body?.object !== "page") return NextResponse.json({ ok: true, ignored: true });

  try {
    const r = await handleWebhookBody(body);

    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    return NextResponse.json({ ok: true, error: String(e?.message || e) });
  }
}
