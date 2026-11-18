export async function exchangePhone(phoneToken: string, accessToken: string): Promise<string | null> {
  const secret = (process.env.ZALO_MINIAPP_SECRET || "").trim();
  if (!secret || !phoneToken || !accessToken) return null;
  try {
    const res = await fetch("https://graph.zalo.me/v2.0/me/info", {
      headers: { access_token: accessToken, code: phoneToken, secret_key: secret },
      cache: "no-store",
    });
    const j: any = await res.json().catch(() => ({}));
    const num = j?.data?.number || "";
    return num ? num : null;
  } catch { return null; }
}
