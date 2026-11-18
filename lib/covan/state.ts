import { createHash } from "node:crypto";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { maskPIIDay } from "./pii-ten";

export type CovanMemory = { kind: string; content: string; at: string };

export type CovanRec = {
  id: number;
  title: string;
  evidence: string[];
  action: string;
  metric: string | null;
  baseline: number | null;
  measure_at: string | null;
  outcome: string | null;
  status: "proposed" | "approved" | "measured";
};

export type PendingBrief = {
  title: string;
  description: string;
  assignee_name: string;
  assignee_id: string;
  assignee_position: string;
  priority: string;
  due_days: number;
};

export type CampaignItem = {
  id: number;
  title: string;
  kind: "ai" | "human";
  detail: string;
  assignee_name?: string;
  kpi?: string;
  phong_ban?: string;
};
export type CampaignPlan = { goal: string; items: CampaignItem[] };

export type LiveItem = {
  id: number;
  title: string;
  kind: "ai" | "human";
  phong_ban: string;
  status: "cho" | "dang_lam" | "xong" | "loi";
  score?: number;
  note?: string;
  task_id?: string;
};
export type LiveCampaign = {
  goal: string;
  started_at: string;
  done: boolean;
  items: LiveItem[];
  events: Array<{ at: string; text: string }>;
};

const KEY_LIVE = "covan_campaign_live";

export async function loadLiveCampaign(): Promise<LiveCampaign | null> {
  const c = await loadJson<LiveCampaign | null>(KEY_LIVE, null);
  return c && c.goal && Array.isArray(c.items) ? c : null;
}

export async function saveLiveCampaign(c: LiveCampaign | null): Promise<void> {
  await saveJson(KEY_LIVE, c, "Bảng chiến dịch sống — trạng thái từng đầu việc + diễn biến");
}

const KEY_MEMORIES = "covan_memories";
const KEY_RECS = "covan_recs";
const KEY_CHAT = "covan_chat_log";
const KEY_BRIEF = "covan_pending_brief";
const KEY_CAMPAIGN = "covan_pending_campaign";

const MAX_MEMORIES = 300;
const MAX_CHAT_PAIRS = 50;

const MEMORY_KINDS = new Set(["core", "episodic", "semantic", "procedural"]);

async function loadJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await getConfigValue(key);
    if (raw == null || raw === "") return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function saveJson(key: string, value: unknown, description: string): Promise<void> {
  await setConfigValue(key, JSON.stringify(value), description);
}

export async function loadMemories(): Promise<CovanMemory[]> {
  const rows = await loadJson<CovanMemory[]>(KEY_MEMORIES, []);
  return Array.isArray(rows) ? rows.filter((m) => m && typeof m.content === "string") : [];
}

export async function addMemories(items: Array<{ kind?: string; content: string }>): Promise<number> {
  const clean = items
    .map((f) => ({
      kind: MEMORY_KINDS.has((f.kind || "").trim()) ? (f.kind || "").trim() : "semantic",
      content: (f.content || "").trim().slice(0, 2000),
      at: new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 16).replace("T", " "),
    }))
    .filter((f) => f.content);
  if (!clean.length) return 0;
  const all = [...(await loadMemories()), ...clean].slice(-MAX_MEMORIES);
  await saveJson(KEY_MEMORIES, all, "Trí nhớ AI Cố vấn kinh doanh (tối đa 300 mẩu)");
  return clean.length;
}

export async function recallMemories(query: string, limit = 20): Promise<string[]> {
  try {
    const rows = await loadMemories();
    const terms = (query || "")
      .toLowerCase()
      .replace(/,/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2);
    const scored = rows.map((m, i) => {
      const c = m.content.toLowerCase();
      return { score: terms.reduce((s, t) => s + (c.includes(t) ? 1 : 0), 0), i, m };
    });
    scored.sort((a, b) => b.score - a.score || b.i - a.i);
    const picked = scored.filter((s) => s.score > 0).slice(0, limit).map((s) => s.m.content);
    if (picked.length) return picked;
    return scored.slice(0, limit).map((s) => s.m.content);
  } catch {
    return [];
  }
}

export async function loadRecs(): Promise<CovanRec[]> {
  const rows = await loadJson<CovanRec[]>(KEY_RECS, []);
  return Array.isArray(rows) ? rows.filter((r) => r && typeof r.id === "number") : [];
}

export async function saveRecs(recs: CovanRec[]): Promise<void> {
  await saveJson(KEY_RECS, recs, "Đề xuất AI Cố vấn: proposed -> approved (baseline) -> measured");
}

export type ChatLogRow = {
  q: string;
  a: string;
  at: string;
  chat_id_hash?: string;
  loai_chat?: "rieng" | "nhom" | null;
  nguon?: "nguoi" | "eval";
};
export type ChatLogMeta = Pick<ChatLogRow, "chat_id_hash" | "loai_chat" | "nguon">;

export function bamChatId(chatId: string | number | null | undefined): string {
  if (chatId === null || chatId === undefined || chatId === "") return "";

  const muoi = (process.env.COVAN_LOG_SALT || process.env.COVAN_TG_SECRET || "").trim();
  if (!muoi) throw new Error("Thiếu COVAN_LOG_SALT (hoặc COVAN_TG_SECRET): muối băm chat_id, đặt trên môi trường chạy.");
  return createHash("sha256").update(`${muoi}|${String(chatId)}`).digest("hex").slice(0, 16);
}

export async function appendChat(question: string, answer: string, meta: ChatLogMeta = {}): Promise<void> {
  try {

    const [q, a] = await Promise.all([maskPIIDay((question || "").slice(0, 2000)), maskPIIDay((answer || "").slice(0, 4000))]);
    const log = await loadJson<ChatLogRow[]>(KEY_CHAT, []);
    log.push({
      q,
      a,
      at: new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 16).replace("T", " "),
      chat_id_hash: meta.chat_id_hash || "",
      loai_chat: meta.loai_chat ?? null,
      nguon: meta.nguon || "nguoi",
    });
    await saveJson(KEY_CHAT, log.slice(-MAX_CHAT_PAIRS), "Nhật ký hội thoại AI Cố vấn (50 cặp gần nhất, đã che PII, chat_id băm)");
  } catch {

  }
}

export function locLichSuChat(rows: unknown, n: number, chatHash: string): ChatLogRow[] {
  const arr = Array.isArray(rows) ? (rows as ChatLogRow[]) : [];
  const h = (chatHash || "").trim();
  if (!h) return [];
  return arr
    .filter((r) => r && typeof r.q === "string" && typeof r.a === "string" && r.nguon === "nguoi" && r.chat_id_hash === h)
    .slice(-n);
}

export async function loadRecentChat(n: number, chatHash: string): Promise<ChatLogRow[]> {
  const log = await loadJson<ChatLogRow[]>(KEY_CHAT, []);
  return locLichSuChat(log, n, chatHash);
}

export async function loadPendingBrief(): Promise<PendingBrief | null> {
  const b = await loadJson<PendingBrief | null>(KEY_BRIEF, null);
  return b && b.title && b.assignee_id ? b : null;
}

export async function savePendingBrief(brief: PendingBrief | null): Promise<void> {
  await saveJson(KEY_BRIEF, brief, "Brief giao việc AI Cố vấn đang chờ CEO xác nhận /ok");
}

export async function loadPendingCampaign(): Promise<CampaignPlan | null> {
  const p = await loadJson<CampaignPlan | null>(KEY_CAMPAIGN, null);
  return p && p.goal && Array.isArray(p.items) && p.items.length ? p : null;
}

export async function savePendingCampaign(plan: CampaignPlan | null): Promise<void> {
  await saveJson(KEY_CAMPAIGN, plan, "Kế hoạch chiến dịch /chiendich đang chờ CEO xác nhận /ok");
}
