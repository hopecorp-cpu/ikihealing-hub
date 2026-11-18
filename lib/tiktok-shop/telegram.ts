import { sendTelegramDocumentMay, sendTelegramTrucTiep, tgEscape } from "@/lib/telegram";
import { ttsConfig } from "./config";

export { tgEscape };

export async function guiNhomTts(text: string): Promise<{ ok: boolean; loi?: string }> {
  const c = ttsConfig();
  if (!c.telegramGroupId) return { ok: false, loi: "thiếu TTS_TELEGRAM_GROUP_ID" };
  const r = await sendTelegramTrucTiep(c.telegramGroupId, text);
  return { ok: !!r.ok, loi: (r as any).loi || (r as any).error };
}

export async function guiFileTts(file: { ten: string; noiDung: Buffer; kieu?: string }, caption: string): Promise<{ nhom: boolean; tien: boolean; loi: string[] }> {
  const c = ttsConfig();
  const loi: string[] = [];
  let nhom = false, tien = false;
  if (c.telegramGroupId) {
    const r = await sendTelegramDocumentMay("tiktok-shop", file, { caption, chatIdOverride: c.telegramGroupId });
    nhom = !!r.ok; if (!r.ok) loi.push(`nhóm: ${(r as any).loi || (r as any).error || "?"}`);
  } else loi.push("thiếu TTS_TELEGRAM_GROUP_ID");
  if (c.tienChatId) {
    const r = await sendTelegramDocumentMay("tiktok-shop", file, { caption, chatIdOverride: c.tienChatId });
    tien = !!r.ok; if (!r.ok) loi.push(`Sơn: ${(r as any).loi || (r as any).error || "?"}`);
  }
  return { nhom, tien, loi };
}
