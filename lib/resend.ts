const FROM = process.env.RESEND_FROM || "NOVA <cam-nang@example.com>";

export function resendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendResend(
  to: string,
  subject: string,
  html: string,
  opts?: {
    replyTo?: string;

    listUnsubscribe?: string;
    headers?: Record<string, string>;
  }
): Promise<{ ok: boolean; skipped?: boolean; id?: string; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, skipped: true, error: "RESEND_API_KEY chưa cấu hình" };
  try {
    const headers: Record<string, string> = { ...(opts?.headers || {}) };
    if (opts?.listUnsubscribe) {
      headers["List-Unsubscribe"] = `<${opts.listUnsubscribe}>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject,
        html,
        reply_to: opts?.replyTo || "contact@example.com",
        ...(Object.keys(headers).length ? { headers } : {}),
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: j?.message || `HTTP ${r.status}` };
    return { ok: true, id: j?.id };
  } catch (e: any) {
    return { ok: false, error: e?.message || "network" };
  }
}
