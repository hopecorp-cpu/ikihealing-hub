import { NextResponse } from "next/server";
import crypto from "crypto";
import { logEventByEmail } from "@/lib/blog-nurture";
import { soKhopAnToan } from "@/lib/kiem-cron";

function verifySvix(raw: string, headers: Headers): boolean {
  const secret = (process.env.RESEND_WEBHOOK_SECRET || "").trim();
  if (!secret) return false;
  const id = headers.get("svix-id"), ts = headers.get("svix-timestamp"), sig = headers.get("svix-signature");
  if (!id || !ts || !sig) return false;
  try {
    const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
    const expected = crypto.createHmac("sha256", key).update(`${id}.${ts}.${raw}`).digest("base64");
    return sig.split(" ").some((p) => soKhopAnToan(p.split(",")[1] || "", expected));
  } catch { return false; }
}

export async function POST(req: Request) {
  if (!(process.env.RESEND_WEBHOOK_SECRET || "").trim()) {
    return NextResponse.json({ ok: false, error: "webhook chưa cấu hình bảo mật (thiếu RESEND_WEBHOOK_SECRET)" }, { status: 503 });
  }
  const raw = await req.text();
  if (!verifySvix(raw, req.headers)) return NextResponse.json({ ok: false }, { status: 401 });
  let ev: any;
  try { ev = JSON.parse(raw); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const type = ev?.type || "";
  const to = Array.isArray(ev?.data?.to) ? ev.data.to[0] : ev?.data?.to;
  if (to) {
    if (type === "email.opened") await logEventByEmail(to, "open");
    else if (type === "email.clicked") await logEventByEmail(to, "click", ev?.data?.click?.link);
  }
  return NextResponse.json({ ok: true });
}
