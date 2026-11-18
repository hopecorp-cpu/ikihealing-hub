import { getConfigValue, setConfigValue } from "@/lib/app-config";

export type BgChecklistItem = {
  id: string; title: string; group: string; group_label: string;
  importance: string; deal_killer: boolean; completed: boolean;
};
export type BgFile = {
  file_type: string; file_name: string; uploaded_at: string;
  score: number; download_url: string; download_url_expires_in: number;
};
export type BgReview = {
  company_name: string; overall_score: number; last_reviewed_at: string;
  checklist: BgChecklistItem[]; files: BgFile[];
};
export type BgResult =
  | { ok: true; data: BgReview; fetchedAt: string; stale: boolean }
  | { ok: false; error: string; code?: number };

type BgCache = { fetchedAt: string; data: BgReview };

const ENDPOINT = "https://agent.beginguru.com/api/public/dataroom";
const CACHE_KEY = "beginguru_cache";
const TOGGLE_KEY = "beginguru_show_investor";
const CACHE_TTL_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 12000;

export function isBeginguruConfigured(): boolean {
  return !!(process.env.BEGINGURU_API_KEY && process.env.BEGINGURU_WORKSPACE_ID);
}

export async function getBeginguruInvestorVisible(): Promise<boolean> {
  return (await getConfigValue(TOGGLE_KEY)) === "1";
}

function normalize(raw: any): BgReview {
  return {
    company_name: String(raw?.company_name || ""),
    overall_score: Number(raw?.overall_score) || 0,
    last_reviewed_at: String(raw?.last_reviewed_at || ""),
    checklist: Array.isArray(raw?.checklist) ? raw.checklist : [],
    files: Array.isArray(raw?.files) ? raw.files : [],
  };
}

async function fetchLive(): Promise<BgResult> {
  const key = process.env.BEGINGURU_API_KEY;
  const ws = process.env.BEGINGURU_WORKSPACE_ID;
  if (!key || !ws) return { ok: false, error: "Thiếu BEGINGURU_API_KEY / BEGINGURU_WORKSPACE_ID" };
  try {
    const res = await fetch(`${ENDPOINT}/${encodeURIComponent(ws)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.status === 401) return { ok: false, code: 401, error: "API key BeginGuru sai hoặc đã bị thu hồi" };
    if (res.status === 404) return { ok: false, code: 404, error: "Workspace BeginGuru không tồn tại" };
    if (res.status >= 500) return { ok: false, code: 500, error: "BeginGuru tạm lỗi, thử lại sau" };
    if (!res.ok) return { ok: false, code: res.status, error: `BeginGuru lỗi (HTTP ${res.status})` };
    const data = normalize(await res.json());
    const fetchedAt = new Date().toISOString();
    await setConfigValue(CACHE_KEY, JSON.stringify({ fetchedAt, data } as BgCache), "BeginGuru dataroom review cache");
    return { ok: true, data, fetchedAt, stale: false };
  } catch (e: any) {
    const msg = e?.name === "TimeoutError" || e?.name === "AbortError" ? "BeginGuru timeout" : "Không kết nối được BeginGuru";
    return { ok: false, error: msg };
  }
}

async function readCache(): Promise<BgCache | null> {
  try {
    const raw = await getConfigValue(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as BgCache;
    if (!c?.data || !c?.fetchedAt) return null;
    return c;
  } catch { return null; }
}

export async function getBeginguruReview(opts?: { force?: boolean }): Promise<BgResult> {
  if (!isBeginguruConfigured()) return { ok: false, error: "BeginGuru chưa cấu hình" };
  const cache = await readCache();
  const fresh = cache && Date.now() - new Date(cache.fetchedAt).getTime() < CACHE_TTL_MS;

  if (cache && fresh && !opts?.force) {
    return { ok: true, data: cache.data, fetchedAt: cache.fetchedAt, stale: false };
  }
  const live = await fetchLive();
  if (live.ok) return live;

  if (cache) return { ok: true, data: cache.data, fetchedAt: cache.fetchedAt, stale: true };
  return live;
}
