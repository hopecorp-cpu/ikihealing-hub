import type { SkillCall } from "@/lib/brain-skills";
import { layModel, modelMacDinh } from "@/lib/ai-model";
import { ghiNhatKyAI } from "@/lib/ai-nhat-ky";

type Turn = { role: "user" | "model"; text: string };
const API_URL = "https://api.anthropic.com/v1/messages";
export const BRAIN_CLAUDE_MODEL = (process.env.BRAIN_CLAUDE_MODEL || modelMacDinh("chienLuoc")).trim();

export function claudeBrainConfigured(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || "").trim();
}

export async function askClaudeTools(
  system: string,
  history: Turn[],
  userText: string,
  functionDeclarations: any[],
  opts?: { maxTokens?: number; thinkingBudget?: number; timeoutMs?: number }
): Promise<{ ok: true; text: string; calls: SkillCall[] } | { ok: false; text: string; calls: SkillCall[]; error: string }> {
  const apiKey = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!apiKey) return { ok: false, text: "", calls: [], error: "missing_key" };

  const msgs: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const t of history) {
    const role = t.role === "model" ? "assistant" : "user";
    const text = (t.text || "").trim(); if (!text) continue;
    const last = msgs[msgs.length - 1];
    if (last && last.role === role) last.content += "\n\n" + text; else msgs.push({ role, content: text });
  }
  if (msgs.length && msgs[0].role === "assistant") msgs.shift();
  if (msgs.length && msgs[msgs.length - 1].role === "user") msgs[msgs.length - 1].content += "\n\n" + userText;
  else msgs.push({ role: "user", content: userText });

  const tools = (functionDeclarations || []).map((d) => ({
    name: d.name, description: d.description || "",
    input_schema: d.parameters || { type: "object", properties: {} },
  }));
  const maxTokens = opts?.maxTokens ?? 6000;

  const model = (process.env.BRAIN_CLAUDE_MODEL || "").trim() || await layModel("chienLuoc");
  const t0 = Date.now();
  const body: Record<string, unknown> = { model, max_tokens: maxTokens, system, messages: msgs };
  if (tools.length) body.tools = tools;

  const budget = opts?.thinkingBudget ?? 2048;
  if (budget > 0) { body.thinking = { type: "adaptive" }; body.output_config = { effort: budget >= 4096 ? "high" : "medium" }; }
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body), cache: "no-store",
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 120_000),
    });
    const j: any = await res.json().catch(() => ({}));
    ghiNhatKyAI({ noi: "claude-brain", model, inTok: j?.usage?.input_tokens, outTok: j?.usage?.output_tokens, ms: Date.now() - t0, ok: res.ok });
    if (!res.ok) return { ok: false, text: "", calls: [], error: j?.error?.message || `HTTP ${res.status}` };
    const blocks: any[] = Array.isArray(j?.content) ? j.content : [];
    const text = blocks.filter((b) => b?.type === "text").map((b) => String(b.text || "")).join("").trim();
    const calls: SkillCall[] = blocks.filter((b) => b?.type === "tool_use").map((b) => ({ name: String(b.name), args: (b.input && typeof b.input === "object") ? b.input : {} }));
    return { ok: true, text, calls };
  } catch (e: any) {
    ghiNhatKyAI({ noi: "claude-brain", model, ms: Date.now() - t0, ok: false });
    return { ok: false, text: "", calls: [], error: String(e?.message || e) };
  }
}
