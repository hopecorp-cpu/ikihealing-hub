import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { findBanned } from "@/lib/banned-words";
import { lyDoDung } from "@/lib/dung-khan-cap";

const G = "https://graph.facebook.com/v21.0";
const CFG_KEY = "fb_autoreply";
const LOG_KEY = "fb_autoreply_log";
const TOKEN_KEY = "fb_page_tokens";
export const STATUS_KEY = "fb_autoreply_status";

export type AutoReplyConfig = {
  enabled: boolean;
  text: string;
  buttons: { title: string; url: string }[];
  cooldownHours: number;
};

export const DEFAULT_CONFIG: AutoReplyConfig = {
  enabled: false,
  text: [
    "Cảm ơn anh/chị đã nhắn tin cho NOVA - ACME Corp. Em có thể hỗ trợ gì cho mình ạ?",
    "",
    "Trong lúc chờ tư vấn viên, anh/chị có thể:",
    "- Làm bài kiểm tra thể trạng (miễn phí, 2 phút) để nhận gợi ý ăn uống hợp với mình",
    "- Ghé cửa hàng xem sản phẩm và giá niêm yết",
    "",
    "Bọn em trả lời trong giờ hành chính (8h-17h30). Ngoài giờ, mình để lại số điện thoại nhé, sáng mai em gọi lại ạ.",
  ].join("\n"),
  buttons: [
    { title: "Kiểm tra thể trạng", url: "https://example.com/quiz?utm_source=facebook&utm_medium=social&utm_campaign=autoreply" },
    { title: "Xem cửa hàng", url: "https://example.com/shop?utm_source=facebook&utm_medium=social&utm_campaign=autoreply" },
  ],
  cooldownHours: 12,
};

export async function getAutoReplyConfig(): Promise<AutoReplyConfig> {
  try {
    const raw = await getConfigValue(CFG_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const j = JSON.parse(raw);
    return {
      enabled: !!j.enabled,
      text: String(j.text || DEFAULT_CONFIG.text),
      buttons: Array.isArray(j.buttons) ? j.buttons.slice(0, 3) : DEFAULT_CONFIG.buttons,
      cooldownHours: Number(j.cooldownHours) > 0 ? Number(j.cooldownHours) : 12,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveAutoReplyConfig(c: AutoReplyConfig): Promise<void> {
  const bad = findBanned(c.text);
  if (bad.length) throw new Error(`Lời chào có từ cấm (${bad.join(", ")}) — sửa trước khi lưu. Luật thực phẩm bổ sung.`);
  await setConfigValue(CFG_KEY, JSON.stringify(c), "Trả lời tự động tin nhắn fanpage");
}

const userToken = () => (process.env.FB_USER_TOKEN || process.env.FB_ADS_TOKEN || "").trim();

export async function pageToken(pageId: string): Promise<string | null> {
  let map: Record<string, string> = {};
  try {
    map = JSON.parse((await getConfigValue(TOKEN_KEY)) || "{}");
  } catch {  }
  if (map[pageId]) return map[pageId];

  const ut = userToken();
  if (!ut) return null;
  const r = await fetch(`${G}/${pageId}?fields=access_token&access_token=${encodeURIComponent(ut)}`, { cache: "no-store" });
  const j: any = await r.json();
  const tok = j?.access_token;
  if (!tok) return null;
  map[pageId] = tok;
  await setConfigValue(TOKEN_KEY, JSON.stringify(map), "Token từng fanpage (cache cho trả lời tự động)");
  return tok;
}

async function inCooldown(psid: string, hours: number): Promise<boolean> {
  try {
    const log = JSON.parse((await getConfigValue(LOG_KEY)) || "{}");
    const last = log[psid];
    if (!last) return false;
    return Date.now() - new Date(last).getTime() < hours * 3600e3;
  } catch {
    return false;
  }
}

async function markReplied(psid: string): Promise<void> {
  let log: Record<string, string> = {};
  try {
    log = JSON.parse((await getConfigValue(LOG_KEY)) || "{}");
  } catch {  }
  log[psid] = new Date().toISOString();

  const cut = Date.now() - 7 * 864e5;
  for (const [k, v] of Object.entries(log)) {
    if (new Date(v).getTime() < cut) delete log[k];
  }
  await setConfigValue(LOG_KEY, JSON.stringify(log), "Mốc đã trả lời tự động từng khách (chống nhắc lại)");
}

export async function sendAutoReply(pageId: string, psid: string, cfg: AutoReplyConfig): Promise<{ ok: boolean; error?: string }> {
  const dung = await lyDoDung("nhan_khach");
  if (dung) return { ok: false, error: dung };
  const tok = await pageToken(pageId);
  if (!tok) return { ok: false, error: `Không lấy được token của page ${pageId} (kiểm FB_USER_TOKEN)` };

  const safe = cfg.text;
  const bad = findBanned(safe);
  if (bad.length) return { ok: false, error: `Lời chào dính từ cấm: ${bad.join(", ")}` };

  const message = cfg.buttons.length
    ? {
        attachment: {
          type: "template",
          payload: {
            template_type: "button",

            text: safe.slice(0, 630),
            buttons: cfg.buttons.slice(0, 3).map((b) => ({ type: "web_url", url: b.url, title: b.title.slice(0, 20) })),
          },
        },
      }
    : { text: safe.slice(0, 1900) };

  const r = await fetch(`${G}/${pageId}/messages?access_token=${encodeURIComponent(tok)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: psid }, messaging_type: "RESPONSE", message }),
    cache: "no-store",
  });
  const j: any = await r.json().catch(() => ({}));
  if (j?.error) return { ok: false, error: j.error.message };
  return { ok: r.ok };
}

export const KHOA_REF_PSID = "fb_ref_psid";
async function ghiRefMessenger(body: any): Promise<void> {
  const moi: Record<string, { ref: string; at: string }> = {};
  for (const entry of body?.entry || []) {
    for (const m of entry?.messaging || []) {
      const ref = String(m?.referral?.ref || m?.postback?.referral?.ref || m?.message?.referral?.ref || "").trim().slice(0, 60);
      const psid = String(m?.sender?.id || "");
      if (ref && psid && psid !== String(entry?.id || "")) moi[psid] = { ref, at: new Date().toISOString() };
    }
  }
  if (!Object.keys(moi).length) return;
  let kho: Record<string, { ref: string; at: string }> = {};
  try { kho = JSON.parse((await getConfigValue(KHOA_REF_PSID)) || "{}") || {}; } catch { kho = {}; }
  const cat = Date.now() - 60 * 864e5;
  const gop = Object.entries({ ...kho, ...moi })
    .filter(([, v]) => Date.parse(v?.at || "") >= cat)
    .sort((a, b) => Date.parse(b[1].at) - Date.parse(a[1].at)).slice(0, 3000);
  await setConfigValue(KHOA_REF_PSID, JSON.stringify(Object.fromEntries(gop)), "Mã nguồn m.me?ref= theo PSID (leads-sync gắn vào lead Fanpage)");
}

export async function handleWebhookBody(body: any): Promise<{ replied: number; skipped: string[]; errors: string[] }> {
  const out = { replied: 0, skipped: [] as string[], errors: [] as string[] };

  await ghiRefMessenger(body).catch(() => { });
  const cfg = await getAutoReplyConfig();
  if (!cfg.enabled) {
    out.skipped.push("tính năng đang TẮT");
    return out;
  }

  for (const entry of body?.entry || []) {
    const pageId = String(entry?.id || "");
    for (const m of entry?.messaging || []) {
      const psid = String(m?.sender?.id || "");
      if (!pageId || !psid) { out.skipped.push("thiếu pageId/psid"); continue; }
      if (m?.message?.is_echo) { out.skipped.push("tin của chính page (echo)"); continue; }
      if (psid === pageId) { out.skipped.push("người gửi là chính page"); continue; }
      if (!m?.message && !m?.postback) { out.skipped.push("không phải tin nhắn"); continue; }

      try {
        const cauKhach = String(m?.message?.text || "").trim();
        if (cauKhach) {
          const { xepHangDoi } = await import("@/lib/tra-loi-nhu-nguoi");
          await xepHangDoi(pageId, psid, cauKhach);
        }
      } catch {  }

      if (await inCooldown(psid, cfg.cooldownHours)) { out.skipped.push("đang trong thời gian nguội"); continue; }

      const r = await sendAutoReply(pageId, psid, cfg);
      if (r.ok) { out.replied++; await markReplied(psid); }
      else out.errors.push(r.error || "lỗi không rõ");
    }
  }

  await setConfigValue(
    STATUS_KEY,
    JSON.stringify({ at: new Date().toISOString(), replied: out.replied, skipped: out.skipped.length, errors: out.errors.slice(0, 3) }),
    "Nhịp tim trả lời tự động fanpage",
  ).catch(() => {  });

  return out;
}

export async function listPages(): Promise<{ id: string; name: string }[]> {
  const ut = userToken();
  if (!ut) return [];
  const r = await fetch(`${G}/me/accounts?fields=id,name&limit=100&access_token=${encodeURIComponent(ut)}`, { cache: "no-store" });
  const j: any = await r.json();
  return (j?.data || []).map((p: any) => ({ id: String(p.id), name: String(p.name || "") }));
}

export async function subscribePages(): Promise<{ page: string; ok: boolean; error?: string }[]> {
  const pages = await listPages();
  const out: { page: string; ok: boolean; error?: string }[] = [];
  for (const p of pages) {
    const tok = await pageToken(p.id);
    if (!tok) { out.push({ page: p.name, ok: false, error: "không lấy được token page" }); continue; }
    const r = await fetch(`${G}/${p.id}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,messaging_referrals&access_token=${encodeURIComponent(tok)}`, {
      method: "POST",
      cache: "no-store",
    });
    const j: any = await r.json().catch(() => ({}));
    out.push({ page: p.name, ok: !!j?.success, error: j?.error?.message });
  }
  return out;
}
