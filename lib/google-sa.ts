import { createSign } from "crypto";

type SaKey = { client_email: string; private_key: string };

let cache: { token: string; hetHan: number; scope: string } | null = null;

export function saConfigured(): boolean {
  return !!(process.env.GOOGLE_OAUTH_JSON || "").trim() || !!(process.env.GOOGLE_SA_JSON || "").trim();
}

type OauthKey = { client_id: string; client_secret: string; refresh_token: string };

function docOauth(): OauthKey | null {
  const raw = (process.env.GOOGLE_OAUTH_JSON || "").trim();
  if (!raw) return null;
  let j: any;
  try { j = JSON.parse(raw); } catch { throw new Error("GOOGLE_OAUTH_JSON không phải JSON hợp lệ"); }
  if (!j.client_id || !j.client_secret || !j.refresh_token) {
    throw new Error("GOOGLE_OAUTH_JSON thiếu client_id / client_secret / refresh_token");
  }
  return { client_id: String(j.client_id), client_secret: String(j.client_secret), refresh_token: String(j.refresh_token) };
}

async function tokenTuOauth(o: OauthKey): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: o.client_id,
      client_secret: o.client_secret,
      refresh_token: o.refresh_token,
    }),
    cache: "no-store",
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) {
    throw new Error(`Google từ chối cấp vé qua OAuth (${res.status}): ${String(j.error_description || j.error || "?").slice(0, 160)} — chạy lại scripts/google-oauth-setup.mjs để cấp lại quyền`);
  }
  return j.access_token as string;
}

function docKhoa(): SaKey {
  const raw = (process.env.GOOGLE_SA_JSON || "").trim();
  if (!raw) throw new Error("Chưa có GOOGLE_SA_JSON (khoá tài khoản máy Google)");
  let j: any;
  try { j = JSON.parse(raw); } catch { throw new Error("GOOGLE_SA_JSON không phải JSON hợp lệ"); }
  if (!j.client_email || !j.private_key) throw new Error("GOOGLE_SA_JSON thiếu client_email hoặc private_key");

  return { client_email: String(j.client_email), private_key: String(j.private_key).replace(/\\n/g, "\n") };
}

export function saEmail(): string {
  try { return docKhoa().client_email; } catch { return ""; }
}

function b64url(s: string | Buffer): string {
  return Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function googleToken(scopes: string[]): Promise<string> {
  const scope = scopes.join(" ");
  if (cache && cache.scope === scope && cache.hetHan > Date.now() + 60_000) return cache.token;

  const oauth = docOauth();
  if (oauth) {
    const token = await tokenTuOauth(oauth);
    cache = { token, hetHan: Date.now() + 55 * 60_000, scope };
    return token;
  }

  const { client_email, private_key } = docKhoa();
  const iat = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({
    iss: client_email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat,
    exp: iat + 3600,
  }));
  const sig = b64url(createSign("RSA-SHA256").update(`${head}.${body}`).sign(private_key));

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${head}.${body}.${sig}`,
    }),
    cache: "no-store",
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) {
    throw new Error(`Google từ chối cấp vé (${res.status}): ${String(j.error_description || j.error || "?").slice(0, 160)}`);
  }
  cache = { token: j.access_token, hetHan: Date.now() + 55 * 60_000, scope };
  return j.access_token;
}
