import { getConfigValue, getConfigNumber, setConfigValue } from "@/lib/app-config";
import { computeRevenueLoop } from "@/lib/revenue-loop";
import { vnDateStr } from "@/lib/payroll";
import { setCampaignStatus, adjustCampaignBudget, adsControlConfigured } from "@/lib/ads-control";
import { sendTelegramWithButtons, sendBrainTelegram, brainBotConfigured, tgEscape } from "@/lib/telegram";

const SCALE_STEP_PCT = 15;
const MIN_ORDERS_TO_SCALE = 5;
const MAX_ACTIONS_PER_RUN = 6;
const DEFAULT_MAX_BUDGET = 1_000_000;
const vnd = (n: number) => Math.round(n).toLocaleString("vi-VN") + "đ";

type Campaign = { id?: string; name: string; status: string; dailyBudget?: number; spend: number; ctr?: number; results: number; rtype: string; cpo: number };
export type AutoAction = { id: string; name: string; kind: "pause" | "scale"; reason: string; deltaPct?: number; curBudget?: number };

export function decideActions(
  campaigns: Campaign[],
  ceil: { cpoBreakeven: number; cpoCeiling: number },
  opts: { maxBudget: number; actedIds: Set<string> }
): AutoAction[] {
  const cpoBE = ceil.cpoBreakeven || 0;
  const cpoCeil = ceil.cpoCeiling || 0;
  const BURN_NO_RESULT = 200_000;
  const pauses: AutoAction[] = [];
  const scales: AutoAction[] = [];

  for (const c of campaigns) {
    if (!c.id || opts.actedIds.has(c.id)) continue;
    if (!/ACTIVE/i.test(c.status)) continue;

    if (!c.results && c.spend >= BURN_NO_RESULT) {
      pauses.push({ id: c.id, name: c.name, kind: "pause", reason: `đã đốt ${vnd(c.spend)} mà 0 kết quả` });
      continue;
    }

    if (c.results >= 2 && cpoBE > 0 && c.cpo > cpoBE) {
      pauses.push({ id: c.id, name: c.name, kind: "pause", reason: `CPO ${vnd(c.cpo)} vượt hoà vốn ${vnd(cpoBE)} — lỗ mỗi ${c.rtype}` });
      continue;
    }

    if (
      c.results >= MIN_ORDERS_TO_SCALE && cpoCeil > 0 && c.cpo > 0 && c.cpo <= cpoCeil &&
      (c.dailyBudget || 0) > 0 && (c.dailyBudget || 0) < opts.maxBudget
    ) {
      const ratio = c.cpo / cpoCeil;
      const step = ratio <= 0.5 ? 20 : ratio <= 0.8 ? 15 : 10;
      scales.push({
        id: c.id, name: c.name, kind: "scale", deltaPct: step, curBudget: c.dailyBudget,
        reason: `CPO ${vnd(c.cpo)}/${c.rtype} = ${Math.round(ratio * 100)}% trần lãi · ${c.results} kết quả — tăng +${step}%`,
      });
    }
  }

  return [...pauses, ...scales].slice(0, MAX_ACTIONS_PER_RUN);
}

const MEASURE_AFTER_DAYS = 3;
type PendingMeasure = { id: string; name: string; kind: "pause" | "scale"; at: string; before: { cpo: number; results: number; spend: number } };

export async function measurePending(campaigns: Campaign[]): Promise<{ lines: string[] }> {
  let pending: PendingMeasure[] = [];
  try { pending = JSON.parse((await getConfigValue("ads_autopilot_pending")) || "[]"); } catch { }
  if (!Array.isArray(pending) || !pending.length) return { lines: [] };

  const byId = new Map(campaigns.filter((c) => c.id).map((c) => [c.id as string, c]));
  const nowMs = Date.parse(vnDateStr() + "T00:00:00+07:00");
  const keep: PendingMeasure[] = [];
  const lines: string[] = [];
  const { addAgentLearning } = await import("@/lib/agent-learning");

  for (const p of pending) {
    const ageDays = (nowMs - Date.parse(p.at)) / 86400e3;
    if (ageDays < MEASURE_AFTER_DAYS) { keep.push(p); continue; }
    const now = byId.get(p.id);
    if (p.kind === "scale") {
      if (!now) { lines.push(`• SCALE "${p.name}": không còn số để đo (có thể đã tắt).`); continue; }
      const better = now.cpo > 0 && p.before.cpo > 0 && now.cpo <= p.before.cpo * 1.1;
      lines.push(`• Đo SCALE "${p.name}": CPO ${vnd(p.before.cpo)} → ${vnd(now.cpo)} · ${better ? "OK giữ" : "XẤU — nên soát lại"}`);
      await addAgentLearning("ads", `Scale "${p.name}": CPO ${vnd(p.before.cpo)}→${vnd(now.cpo)} sau ${MEASURE_AFTER_DAYS} ngày`, better ? "win" : "fail");
    } else {
      lines.push(`• Đo TẮT "${p.name}": đã cắt ở CPO ${vnd(p.before.cpo)}/${p.before.results || 0} kết quả (dừng lỗ).`);
      await addAgentLearning("ads", `Tắt "${p.name}" ở CPO ${vnd(p.before.cpo)} (${p.before.results || 0} kết quả) — cắt lỗ`, "insight");
    }
  }
  if (keep.length !== pending.length) await setConfigValue("ads_autopilot_pending", JSON.stringify(keep), "Hàng chờ đo hiệu quả autopilot");
  return { lines: lines.length ? [`\u{1F4CF} <b>Đo hiệu quả hành động trước:</b>`, ...lines] : [] };
}

export async function getAdsChatId(): Promise<string> {
  const cfg = ((await getConfigValue("ads_chat_id")) || "").trim();
  return cfg || (process.env.TELEGRAM_ADS_CHAT_ID || "").trim();
}

export async function sendAdsReport(text: string): Promise<void> {
  const chat = await getAdsChatId();
  const tg = await import("@/lib/telegram");
  if (chat && tg.brainBotConfigured()) { await tg.sendBrainTelegram(chat, text); return; }
  if (tg.telegramConfigured()) await tg.sendTelegram(text, chat || undefined);
}

export async function runCreativeLoop(): Promise<{ lines: string[] }> {
  let campaigns: Campaign[] = [];
  try {
    const o = JSON.parse((await getConfigValue("ads_campaigns")) || "null");
    campaigns = Array.isArray(o?.campaigns) ? o.campaigns : [];
  } catch { }
  const weak = campaigns
    .filter((c) => c.id && /ACTIVE/i.test(c.status) && (c.ctr || 0) > 0 && (c.ctr || 0) < 1 && c.spend >= 100_000)
    .sort((a, b) => (a.ctr || 9) - (b.ctr || 9));
  if (!weak.length) return { lines: [] };

  let pending: Record<string, { campaignId: string; campaignName: string; at: string }> = {};
  try { pending = JSON.parse((await getConfigValue("ads_creative_pending")) || "{}"); } catch { }
  const already = new Set(Object.values(pending).map((v) => v.campaignId));
  const target = weak.find((c) => !already.has(c.id as string));
  if (!target) return { lines: [] };

  const adsChat = (await getAdsChatId()) || (process.env.TELEGRAM_CONTENT_CHAT_ID || "").trim();
  if (!adsChat) return { lines: [`\u{270D}️ Creative yếu "${target.name}" (CTR ${target.ctr}%) — chưa có nhóm ads để tag Hằng (gõ /nhomads trong nhóm).`] };

  const { runFactory } = await import("@/lib/content-factory");
  const r = await runFactory(1).catch(() => null);
  const item: any = r?.items?.[0];
  if (!r?.ok || !item?.id) return { lines: [`\u{270D}️ Muốn làm bài mới cho "${target.name}" nhưng nhà máy content lỗi: ${r?.error || "?"}`] };

  pending[String(item.id)] = { campaignId: target.id as string, campaignName: target.name, at: new Date().toISOString() };
  await setConfigValue("ads_creative_pending", JSON.stringify(pending), "Bài mới chờ Hằng đăng để làm lại ad");

  const txt = `\u{270D}️ <b>Ad creative yếu → cần bài mới</b>\nCampaign: <b>${tgEscape(target.name)}</b> (CTR ${target.ctr}% &lt;1%)\n\n<b>Bài nháp:</b> ${tgEscape(String(item.title || item.id))}\n\n@Hà / đội Nội dung: đăng bài này lên fanpage rồi <b>gõ: /dadang ${item.id}</b> — em tự bật lại + tối ưu ads cho campaign trên (không tự đăng).`;
  if (brainBotConfigured()) await sendBrainTelegram(adsChat, txt);
  else await sendTelegramWithButtons(txt, [[{ text: "✅ Đã đăng", callback_data: `cdone:${item.id}` }]], adsChat);
  return { lines: [`\u{270D}️ Đã gửi bài mới cho "${target.name}" (CTR yếu) → tag Hằng ở nhóm ads.`] };
}

export type AutopilotResult = { ok: boolean; enabled: boolean; error?: string; text: string; executed: number; planned: number };

export async function runAutopilot(opts?: { forceDry?: boolean }): Promise<AutopilotResult> {

  let campaigns: Campaign[] = [];
  try {
    const raw = await getConfigValue("ads_campaigns");
    const o = raw ? JSON.parse(raw) : null;
    campaigns = Array.isArray(o?.campaigns) ? o.campaigns : [];
  } catch { }
  if (!campaigns.length) return { ok: false, enabled: false, error: "chưa có ads_campaigns (cron ads-spend chưa kéo được — kiểm FB_ADS_TOKEN)", text: "", executed: 0, planned: 0 };

  const month = vnDateStr().slice(0, 7);
  const loop = await computeRevenueLoop(month).catch(() => null);
  const ceil = { cpoBreakeven: loop?.ceil?.cpoBreakeven || 0, cpoCeiling: loop?.ceil?.cpoCeiling || 0 };
  if (!ceil.cpoCeiling) return { ok: false, enabled: false, error: "chưa tính được trần CPO (Vòng lặp doanh thu) — không dám hành động", text: "", executed: 0, planned: 0 };

  const flag = (await getConfigValue("ads_autopilot")) || "off";
  const enabled = flag.trim().toLowerCase() === "on" && !opts?.forceDry;
  const maxBudget = await getConfigNumber("ads_autopilot_max_budget", DEFAULT_MAX_BUDGET);
  const today = vnDateStr();
  let log: { date?: string; acted?: string[]; entries?: any[] } = {};
  try { log = JSON.parse((await getConfigValue("ads_autopilot_log")) || "{}"); } catch { }
  const actedIds = new Set<string>(log.date === today && Array.isArray(log.acted) ? log.acted : []);

  const measured = await measurePending(campaigns);

  const creative = await runCreativeLoop().catch(() => ({ lines: [] as string[] }));

  const actions = decideActions(campaigns, ceil, { maxBudget, actedIds });
  if (!actions.length) {
    const t = [...measured.lines, ...creative.lines].join("\n");
    return { ok: true, enabled, text: t, executed: 0, planned: 0 };
  }
  const byId = new Map(campaigns.filter((c) => c.id).map((c) => [c.id as string, c]));

  const lines: string[] = [];
  const newActed: string[] = [];
  const newPending: PendingMeasure[] = [];
  let executed = 0;
  const canWrite = enabled && adsControlConfigured();

  for (const a of actions) {
    const c = byId.get(a.id);
    const snap = () => { if (c) newPending.push({ id: a.id, name: a.name, kind: a.kind, at: new Date().toISOString(), before: { cpo: c.cpo || 0, results: c.results || 0, spend: c.spend || 0 } }); };
    if (!canWrite) {
      lines.push(`• [DỰ KIẾN] ${a.kind === "pause" ? "TẮT" : "SCALE"} "${a.name}" — ${a.reason}`);
      continue;
    }
    if (a.kind === "pause") {
      const r = await setCampaignStatus(a.id, "PAUSED");
      if (r?.ok) { executed++; newActed.push(a.id); snap(); lines.push(`• ĐÃ TẮT "${a.name}" — ${a.reason}`); }
      else lines.push(`• KHÔNG tắt được "${a.name}": ${r?.error || "lỗi"} (có thể token thiếu ads_management)`);
    } else {
      const r = await adjustCampaignBudget(a.id, a.deltaPct || SCALE_STEP_PCT);
      if (r?.ok) { executed++; newActed.push(a.id); snap(); lines.push(`• ĐÃ SCALE "${a.name}" ${vnd(r.oldBudget || 0)} → ${vnd(r.newBudget || 0)}${r.capped ? " (chạm trần)" : ""} (+${a.deltaPct}%) — ${a.reason}`); }
      else lines.push(`• KHÔNG scale được "${a.name}": ${r?.error || "lỗi"}`);
    }
  }

  const freed = actions.filter((a) => a.kind === "pause").map((a) => byId.get(a.id)?.dailyBudget || 0).reduce((s, n) => s + n, 0);
  if (freed > 0) lines.push(`\u{1F4A1} Giải phóng ${vnd(freed)}/ngày từ ad đã tắt — để dành dồn dần sang ad thắng (tránh nhảy sốc vỡ learning).`);

  if (canWrite && newActed.length) {
    const entries = (log.date === today && Array.isArray(log.entries)) ? log.entries : [];
    entries.push({ at: new Date().toISOString(), actions: actions.map((a) => ({ id: a.id, name: a.name, kind: a.kind, reason: a.reason })) });
    await setConfigValue("ads_autopilot_log", JSON.stringify({ date: today, acted: [...actedIds, ...newActed], entries }), "Nhật ký ads autopilot (theo ngày)");
    if (newPending.length) {
      let pend: PendingMeasure[] = [];
      try { pend = JSON.parse((await getConfigValue("ads_autopilot_pending")) || "[]"); } catch { }
      await setConfigValue("ads_autopilot_pending", JSON.stringify([...(Array.isArray(pend) ? pend : []), ...newPending]), "Hàng chờ đo hiệu quả autopilot");
    }
  }

  const head = canWrite
    ? `\u{1F916} <b>Ads Autopilot — đã tự xử lý ${executed}/${actions.length} campaign</b> (trần CPO lãi ${vnd(ceil.cpoCeiling)})`
    : `\u{1F916} <b>Ads Autopilot [ĐANG TẮT — chỉ dự kiến]</b> ${actions.length} việc (bật: đặt config <code>ads_autopilot=on</code>)`;
  const text = [...measured.lines, ...creative.lines, "", head, ...lines].filter((x, i, arr) => !(x === "" && (i === 0 || arr[i - 1] === ""))).join("\n");
  return { ok: true, enabled, text, executed, planned: actions.length };
}
