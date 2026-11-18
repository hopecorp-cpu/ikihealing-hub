export type LopChat = "ceo" | "bgd" | "noi_bo";

export type ChatAllow = { bgd: Set<string>; noi_bo: Set<string>; dangMoi: boolean };

const toIds = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];

export function docChatAllow(raw: unknown): ChatAllow {
  let v: unknown = raw;
  if (typeof raw === "string") {
    try { v = JSON.parse(raw); } catch { v = null; }
  }
  if (Array.isArray(v)) return { bgd: new Set(), noi_bo: new Set(toIds(v)), dangMoi: false };
  if (v && typeof v === "object") {
    const o = v as { bgd?: unknown; noi_bo?: unknown };
    return { bgd: new Set(toIds(o.bgd)), noi_bo: new Set(toIds(o.noi_bo)), dangMoi: true };
  }
  return { bgd: new Set(), noi_bo: new Set(), dangMoi: false };
}

export function lopCuaChat(chatId: string | number, ceoChatId: string, allow: ChatAllow): LopChat | null {
  const id = String(chatId).trim();
  if (!id) return null;
  if (ceoChatId && id === ceoChatId.trim()) return "ceo";
  if (allow.bgd.has(id)) return "bgd";
  if (allow.noi_bo.has(id)) return "noi_bo";
  return null;
}
