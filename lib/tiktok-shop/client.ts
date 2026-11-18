import { TTS_API_BASE, ttsConfig } from "./config";
import { dungUrlDaKy, timestampTts, type QueryParams } from "./sign";

export class TtsApiError extends Error {
  code: number;
  requestId: string;
  httpStatus: number;
  path: string;
  constructor(msg: string, o: { code: number; requestId?: string; httpStatus: number; path: string }) {
    super(msg);
    this.name = "TtsApiError";
    this.code = o.code;
    this.requestId = o.requestId || "";
    this.httpStatus = o.httpStatus;
    this.path = o.path;
  }
}

export type TtsResponse<T> = { code: number; message: string; request_id?: string; data: T };

export type TtsCallOpts = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  accessToken?: string;
  shopCipher?: string;
  query?: QueryParams;
  body?: unknown;
  timeoutMs?: number;
};

export async function ttsCall<T = any>(o: TtsCallOpts): Promise<T> {
  const c = ttsConfig();
  if (!c.appKey || !c.appSecret) throw new Error("TikTok Shop chưa cấu hình TTS_APP_KEY/TTS_APP_SECRET");
  const query: QueryParams = { ...(o.query || {}), app_key: c.appKey, timestamp: timestampTts() };
  if (o.shopCipher) query.shop_cipher = o.shopCipher;
  const bodyStr = o.body !== undefined && o.body !== null && o.method !== "GET" ? JSON.stringify(o.body) : "";
  const { url } = dungUrlDaKy(TTS_API_BASE, o.path, query, c.appSecret, bodyStr);

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (o.accessToken) headers["x-tts-access-token"] = o.accessToken;

  const res = await fetch(url, {
    method: o.method,
    headers,
    body: bodyStr || undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(o.timeoutMs ?? 20_000),
  });
  const j = (await res.json().catch(() => null)) as TtsResponse<T> | null;
  const reqId = j?.request_id || res.headers.get("x-tt-logid") || "";
  if (!res.ok) {
    throw new TtsApiError(`TikTok ${o.path} HTTP ${res.status}: ${j?.message || "(không đọc được body)"} [request_id ${reqId}]`, {
      code: j?.code ?? -1, requestId: reqId, httpStatus: res.status, path: o.path,
    });
  }
  if (!j || typeof j.code !== "number") {
    throw new TtsApiError(`TikTok ${o.path}: body không đúng khung {code,message,data} [request_id ${reqId}]`, { code: -2, requestId: reqId, httpStatus: res.status, path: o.path });
  }
  if (j.code !== 0) {
    throw new TtsApiError(`TikTok ${o.path} code ${j.code}: ${j.message} [request_id ${reqId}]`, { code: j.code, requestId: reqId, httpStatus: res.status, path: o.path });
  }
  return j.data;
}

export function laLoiToken(e: unknown): boolean {
  if (!(e instanceof TtsApiError)) return false;

  return /^(105|36004)/.test(String(e.code)) || /access.?token|unauthori[sz]ed|token.*(expired|invalid)/i.test(e.message);
}
