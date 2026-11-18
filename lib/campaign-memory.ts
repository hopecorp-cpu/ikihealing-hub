import { getConfigValue, setConfigValue } from "@/lib/app-config";

export type CampaignFail = { title: string; reason: string; at: string };
const KEY = "campaign_memory";
const MAX = 40;

export async function getFails(): Promise<CampaignFail[]> {
  try { const raw = await getConfigValue(KEY); if (raw) { const o = JSON.parse(raw); if (Array.isArray(o?.fails)) return o.fails; } } catch { }
  return [];
}

export async function recordFail(title: string, reason: string): Promise<void> {
  try {
    const fails = await getFails();
    fails.unshift({ title: String(title || "(không tên)").slice(0, 120), reason: String(reason || "").slice(0, 160), at: new Date().toISOString() });
    await setConfigValue(KEY, JSON.stringify({ fails: fails.slice(0, MAX), updatedAt: new Date().toISOString() }));
  } catch { }
}

export async function campaignMemoryContext(): Promise<string> {
  const fails = await getFails();
  if (!fails.length) return "";
  const lines = fails.slice(0, 12).map((f) => `- "${f.title}" — ${f.reason}`);
  return `CAMPAIGN MEMORY — NHỮNG BÀI/HƯỚNG ĐÃ FAIL (người duyệt bỏ hoặc dính luật). ĐỪNG viết lại kiểu này:\n${lines.join("\n")}`;
}
