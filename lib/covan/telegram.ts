import { maskPIIDay } from "./pii-ten";

const MAX_LEN = 3900;

export function stripMarkdown(t: string): string {
  return (t || "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^#{1,4}\s*/gm, "")
    .replace(/^\|[-\s|:]+\|$/gm, "")
    .replace(/^\s*\|/gm, "")
    .replace(/\|\s*$/gm, "")
    .replace(/\s\|\s/g, "  -  ");
}

export const COVAN_FALLBACK_TEXT =
  "Em gặp trục trặc khi soạn câu trả lời, anh nhắn lại giúp em.";

export function covanTelegramConfigured(): boolean {
  return !!(process.env.COVAN_BOT_TOKEN || "").trim() && !!(process.env.COVAN_CHAT_ID || "").trim();
}

export async function covanSend(chatId: string | number, text: string): Promise<{ ok: boolean; error?: string }> {
  const token = (process.env.COVAN_BOT_TOKEN || "").trim();
  if (!token) return { ok: false, error: "Chưa cấu hình COVAN_BOT_TOKEN" };

  if (String(chatId) === (process.env.COVAN_CHAT_ID || "").trim()) {
    const { locCEO } = await import("../telegram");
    const g = await locCEO(text);
    if (g.chan) return { ok: true };
  }

  let body = stripMarkdown(await maskPIIDay((text || "").trim()));
  if (!body) body = COVAN_FALLBACK_TEXT;
  let lastError = "";
  for (let i = 0; i < body.length; i += MAX_LEN) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: body.slice(i, i + MAX_LEN),
          disable_web_page_preview: true,
        }),
        cache: "no-store",
      });
      if (!res.ok) lastError = `Telegram ${res.status}`;
    } catch (e) {
      lastError = String(e instanceof Error ? e.message : e);
    }
  }
  return lastError ? { ok: false, error: lastError } : { ok: true };
}

export async function covanSendCEO(text: string): Promise<{ ok: boolean; error?: string }> {
  const chatId = (process.env.COVAN_CHAT_ID || "").trim();
  if (!chatId) return { ok: false, error: "Chưa cấu hình COVAN_CHAT_ID" };
  return covanSend(chatId, text);
}

export async function covanSendDocumentCEO(
  filename: string,
  content: string
): Promise<{ ok: boolean; error?: string }> {
  const token = (process.env.COVAN_BOT_TOKEN || "").trim();
  const chatId = (process.env.COVAN_CHAT_ID || "").trim();
  if (!token || !chatId) return { ok: false, error: "Chưa cấu hình COVAN_BOT_TOKEN/COVAN_CHAT_ID" };
  const body = (await maskPIIDay((content || "").trim())) || COVAN_FALLBACK_TEXT;
  try {
    const fd = new FormData();
    fd.append("chat_id", chatId);
    fd.append("document", new Blob([body], { type: "text/markdown" }), filename);
    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: "POST",
      body: fd,
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: `Telegram ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e instanceof Error ? e.message : e) };
  }
}
