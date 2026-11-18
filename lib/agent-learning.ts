import { getConfigValue, setConfigValue } from "@/lib/app-config";

export type LearningKind = "win" | "fail" | "insight";
export type AgentLearning = { lesson: string; kind: LearningKind; at: string };
const MAX = 30;
const keyOf = (agent: string) => `agent_learnings_${agent}`;

export async function getAgentLearnings(agent: string): Promise<AgentLearning[]> {
  try { const raw = await getConfigValue(keyOf(agent)); if (raw) { const o = JSON.parse(raw); if (Array.isArray(o?.items)) return o.items; } } catch { }
  return [];
}

export async function addAgentLearning(agent: string, lesson: string, kind: LearningKind = "insight"): Promise<void> {
  try {
    const l = String(lesson || "").trim().slice(0, 220);
    if (!l) return;
    const items = await getAgentLearnings(agent);
    if (items.some((x) => x.lesson === l)) return;
    items.unshift({ lesson: l, kind, at: new Date().toISOString() });
    await setConfigValue(keyOf(agent), JSON.stringify({ items: items.slice(0, MAX), updatedAt: new Date().toISOString() }), `Bài học tích luỹ của agent ${agent}`);
  } catch {  }
}

export async function agentLearningBrief(agent: string): Promise<string> {
  const items = await getAgentLearnings(agent);
  if (!items.length) return "";
  const wins = items.filter((x) => x.kind === "win").slice(0, 6).map((x) => `+ ${x.lesson}`);
  const fails = items.filter((x) => x.kind === "fail").slice(0, 6).map((x) => `- ${x.lesson}`);
  const ins = items.filter((x) => x.kind === "insight").slice(0, 6).map((x) => `· ${x.lesson}`);
  const blocks: string[] = [];
  if (wins.length) blocks.push(`ĐÃ CHỨNG MINH HIỆU QUẢ (làm tiếp hướng này):\n${wins.join("\n")}`);
  if (fails.length) blocks.push(`ĐÃ THẤT BẠI (đừng lặp):\n${fails.join("\n")}`);
  if (ins.length) blocks.push(`GHI NHẬN:\n${ins.join("\n")}`);
  return `BÀI HỌC TÍCH LUỸ CỦA AGENT "${agent.toUpperCase()}" — tự rút từ kết quả thật, BÁM THEO:\n${blocks.join("\n\n")}`;
}

export async function agentLearningSummary(agent: string): Promise<{ win: number; fail: number; insight: number; total: number }> {
  const items = await getAgentLearnings(agent);
  return {
    win: items.filter((x) => x.kind === "win").length,
    fail: items.filter((x) => x.kind === "fail").length,
    insight: items.filter((x) => x.kind === "insight").length,
    total: items.length,
  };
}
