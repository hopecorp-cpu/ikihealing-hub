export const ZALO_BOT_API = "https://bot-api.zaloplatforms.com";

export const TRAN_KY_TU = 2000;

export type QuyenChat = "ceo" | "mo";

export function quyenChat(chatId: string, ceoId: string | null | undefined, allowCsv: string | null | undefined): QuyenChat | null {
  const id = String(chatId || "").trim();
  if (!id) return null;
  if (id === String(ceoId || "").trim()) return "ceo";
  const allow = String(allowCsv || "").split(",").map((s) => s.trim()).filter(Boolean);
  return allow.includes(id) ? "mo" : null;
}

export function chiaTin(text: string, max = TRAN_KY_TU): string[] {
  const out: string[] = [];
  let rest = String(text || "").trim();
  while (rest.length > max) {
    let cut = rest.lastIndexOf("\n", max);
    if (cut < max * 0.5) cut = rest.lastIndexOf(" ", max);
    if (cut < max * 0.5) cut = max;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

export function zaloBotConfigured(): boolean {
  return !!(process.env.ZALO_BOT_TOKEN || "").trim() && !!(process.env.ZALO_BOT_SECRET || "").trim();
}

async function goi(method: string, body?: unknown): Promise<any> {
  const token = (process.env.ZALO_BOT_TOKEN || "").trim();
  if (!token) return { ok: false, description: "thiếu ZALO_BOT_TOKEN" };
  const res = await fetch(`${ZALO_BOT_API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  return res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }));
}

export async function sendZaloBot(chatId: string, text: string): Promise<boolean> {
  let ok = true;
  for (const phan of chiaTin(text)) {
    const r = await goi("sendMessage", { chat_id: chatId, text: phan, parse_mode: "markdown" });
    if (!r?.ok) { ok = false; console.error("[zalo-bot] sendMessage hỏng:", r?.description || r?.error_code); }
  }
  return ok;
}

export async function zaloBotTyping(chatId: string): Promise<void> {
  await goi("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});
}

export async function zaloBotSetWebhook(url: string): Promise<any> {
  return goi("setWebhook", { url, secret_token: (process.env.ZALO_BOT_SECRET || "").trim() });
}

export async function zaloBotGetMe(): Promise<any> {
  return goi("getMe");
}
