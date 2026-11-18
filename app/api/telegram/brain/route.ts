import { NextResponse } from "next/server";
import { appLink, APP_HOST } from "@/lib/app-url";
import { getServiceClient } from "@/lib/supabase-server";
import { brainBotConfigured, brainBotToken, sendBrainTelegram as guiNaoGoc, brainSendTyping, brainSetWebhook, tgEscape, tgFromMarkdown, sendTelegramWithButtons } from "@/lib/telegram";
import { geminiConfigured, askGemini, askGeminiTools } from "@/lib/gemini";
import { askClaudeTools, claudeBrainConfigured } from "@/lib/claude-brain";
import { ACME_IDENTITY, buildLiveContext, saveLearnings, pickBrainModel, laCauChienLuoc, getHocTheGioi, getCayKinhDoanh, getBoCongThuc, laCauVeKhach, getDocKhach, RAO_NHOM_CO_DUYET } from "@/lib/acme-brain";
import { retrieveKnowledge, locKhoRiengCeo } from "@/lib/covan/rag";
import { SKILL_DECLS, runSkill, duocDungSkill, loiTuChoiSkill, type SkillCall, type MucQuyen } from "@/lib/brain-skills";
import { runFactory, pushDraftsToCEO } from "@/lib/content-factory";
import { luuTinDon } from "@/lib/tg-orderbook";
import { quyetDinhNhom, suKienThemBot, duocDungNho, duocDungDadang, laCeo, tachCsv, khoiNguoiHoi, cauKemTen, laNguoiTuGiao, khoiNguoiTuGiao } from "@/lib/brain-quyen";
import { cheChoChat, catKhoiTaiSan, GIOI_HAN_LUOT_BOT, CAU_VUOT_LUOT, chuViecDeploy } from "@/lib/bot-an-toan";
import { vuotLuotNguoi } from "@/lib/chan-spam";
import { laCauNhayCam, coMarkerCanDuyet, conHan, timTrung, taoMa, themCho, docLenhDuyet, type CauCho } from "@/lib/brain-duyet-nhay";

function sendBrainTelegram(chatId: string, text: string, laLLM = false) {
  return guiNaoGoc(chatId, cheChoChat(chatId, process.env.TELEGRAM_CHAT_ID, text, laLLM));
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Turn = { role: "user" | "model"; text: string };
const HIST_KEY = (chatId: string) => `brain_hist_${chatId}`;
const PENDING_KEY = (chatId: string) => `brain_pending_${chatId}`;

const MAX_TURNS = 16;

const TU_PHU_DINH = /(kh[ôo]ng|đ[uừ]ng|ch[uư]a|kh[oỏ]i)/i;
function laLenhNhanh(text: string, re: RegExp, maxLen: number): boolean {
  const t = text.trim();
  if (t.length > maxLen) return false;
  if (t.endsWith("?")) return false;
  if (TU_PHU_DINH.test(t)) return false;
  return re.test(t);
}

const getCfg = async (sb: any, k: string) => (await sb.from("config").select("value").eq("key", k).maybeSingle()).data?.value ?? null;
const setCfg = (sb: any, k: string, v: string) => sb.from("config").upsert({ key: k, value: v }, { onConflict: "key" });

async function brainUsername(sb: any): Promise<string> {
  let u = await getCfg(sb, "brain_bot_username");
  if (u) return u;
  try {
    const tok = brainBotToken();
    if (!tok) return "";
    const j: any = await (await fetch(`https://api.telegram.org/bot${tok}/getMe`, { cache: "no-store" })).json();
    u = j?.result?.username || "";
    if (u) await setCfg(sb, "brain_bot_username", u);
  } catch { }
  return u || "";
}

async function allowedChats(sb: any): Promise<Set<string>> {
  const set = new Set<string>();
  const ceo = (process.env.TELEGRAM_CHAT_ID || "").trim(); if (ceo) set.add(ceo);
  const extra = (await getCfg(sb, "brain_allow")) || "";
  extra.split(",").map((s: string) => s.trim()).filter(Boolean).forEach((s: string) => set.add(s));
  return set;
}

async function tuMoNhom(sb: any, chatId: string, tenNhom: string): Promise<void> {
  const cur = ((await getCfg(sb, "brain_allow")) || "").split(",").map((s: string) => s.trim()).filter(Boolean);
  if (cur.includes(String(chatId))) return;
  cur.push(String(chatId));
  await setCfg(sb, "brain_allow", cur.join(","));
  const ceo = (process.env.TELEGRAM_CHAT_ID || "").trim();
  if (ceo) {
    await sendBrainTelegram(ceo, `\u{1F513} Anh vừa thêm em vào nhóm <b>${tgEscape(tenNhom || chatId)}</b> nên em đã mở quyền trả lời trong nhóm đó.\nTrong nhóm em chỉ đáp khi được nhắc tên, được reply, hoặc có người gõ lệnh.\nKhông muốn thì anh mời em ra khỏi nhóm là xong.`).catch(() => { });
  }
}

async function baoNhomLa(sb: any, chatId: string, noiDung: string): Promise<void> {
  const daBao = ((await getCfg(sb, "brain_nhom_la_da_bao")) || "").split(",").filter(Boolean);
  if (daBao.includes(chatId)) return;
  await setCfg(sb, "brain_nhom_la_da_bao", [...daBao, chatId].slice(-50).join(","));
  const ceo = (process.env.TELEGRAM_CHAT_ID || "").trim();
  if (ceo) await sendBrainTelegram(ceo, noiDung).catch(() => { });
}

const DUYET_KEY = "brain_duyet_cau";
async function docCho(sb: any): Promise<CauCho[]> {
  try { return conHan(JSON.parse((await getCfg(sb, DUYET_KEY)) || "[]"), Date.now()); } catch { return []; }
}

async function xinDuyet(sb: any, c: Omit<CauCho, "ma" | "at">): Promise<void> {
  const ceo = (process.env.TELEGRAM_CHAT_ID || "").trim();
  let ds = await docCho(sb);
  const trung = timTrung(ds, c.chatId, c.fromId, c.cau);
  if (!trung) {
    const ma = taoMa(ds);
    ds = themCho(ds, { ...c, ma, at: new Date().toISOString() });
    await setCfg(sb, DUYET_KEY, JSON.stringify(ds));
    if (ceo) await sendBrainTelegram(ceo,
      `<b>${tgEscape(c.ten)}</b> hỏi em trong nhóm <b>${tgEscape(c.tenNhom || c.chatId)}</b> một câu cần anh duyệt:\n\n` +
      `<i>${tgEscape(c.cau.slice(0, 800))}</i>\n\n` +
      `Cho em trả lời vào nhóm: /duyettl_${ma}\nKhông trả lời: /khongtl_${ma}`).catch(() => { });
  }
  await sendBrainTelegram(c.chatId, trung
    ? "Câu này em đã gửi CEO rồi ạ, anh duyệt xong em trả lời ngay trong nhóm."
    : "Câu này liên quan tới tài chính nên em cần CEO duyệt trước ạ. Em đã gửi anh, anh duyệt xong em trả lời ngay trong nhóm này.");
}

async function traLoiDaDuyet(sb: any, c: CauCho): Promise<string> {
  let history: Turn[] = [];
  try { history = JSON.parse((await getCfg(sb, HIST_KEY(c.chatId))) || "[]"); } catch {}
  const live = await buildLiveContext();
  const rag = await retrieveKnowledge(c.cau, 6).catch(() => []);
  const knowledge = rag.length ? "\n\nKIẾN THỨC NỘI BỘ LIÊN QUAN (nêu nguồn khi dựa vào):\n" + rag.join("\n\n---\n\n") : "";
  const system = ACME_IDENTITY + live + knowledge +
    `\n\n===== CEO ĐÃ DUYỆT CHO EM TRẢ LỜI CÂU NÀY TRONG NHÓM =====\nNgười hỏi: ${c.ten}. Trả lời ĐÚNG câu được hỏi, đủ số; KHÔNG kể thêm số tài chính nhạy cảm khác ngoài phạm vi câu hỏi.`;
  const kho = laCauChienLuoc(c.cau);
  const r = await askGemini(system, history.slice(-MAX_TURNS), c.cau, { model: pickBrainModel(c.cau), ...(kho ? { thinkingBudget: 2048, maxOutputTokens: 4000 } : {}) });
  const out = r.ok && r.text ? r.text : "";
  if (out) {
    const next = [...history, { role: "user", text: `${c.ten}: ${c.cau}` }, { role: "model", text: out }].slice(-MAX_TURNS * 2) as Turn[];
    await setCfg(sb, HIST_KEY(c.chatId), JSON.stringify(next));
  }
  return out;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sb = getServiceClient();

  const admin = (process.env.CRON_SECRET || "").trim();
  const key = (url.searchParams.get("key") || "").trim();
  const isAdmin = !!admin && key === admin;
  if ((url.searchParams.get("ping") || url.searchParams.get("claim") || url.searchParams.get("setup")) && !isAdmin) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const ping = url.searchParams.get("ping");
  if (ping) {
    const r = await sendBrainTelegram(ping, "\u{1F44B} Chào anh! Trợ lý ACME đã online. Anh cứ hỏi em bất cứ điều gì về công ty nhé.");
    return NextResponse.json({ ok: r.ok, telegram: r });
  }

  if (url.searchParams.get("claim")) {
    const pend = await getCfg(sb, "brain_pending_owner");
    let p: any = null; try { p = JSON.parse(pend || "null"); } catch {}
    if (!p?.chatId) return NextResponse.json({ ok: false, error: "Chưa có ai nhắn bot. Anh nhắn bot 1 câu trước đã." });
    const cur = ((await getCfg(sb, "brain_allow")) || "").split(",").map((s: string) => s.trim()).filter(Boolean);
    if (!cur.includes(String(p.chatId))) cur.push(String(p.chatId));
    await setCfg(sb, "brain_allow", cur.join(","));
    await setCfg(sb, "brain_pending_owner", "");
    await sendBrainTelegram(String(p.chatId), "\u{2713} Đã cấp quyền! Giờ anh nhắn em thoải mái nhé. Thử hỏi: \"Hôm nay bán được bao nhiêu?\"");
    return NextResponse.json({ ok: true, allowed: p });
  }

  if (url.searchParams.get("setup")) {
    if (!brainBotConfigured()) return NextResponse.json({ ok: false, error: "Chưa có TELEGRAM_BRAIN_BOT_TOKEN trong Vercel env" });
    let secret = (await getCfg(sb, "brain_webhook_secret")) || "";
    if (!secret) { secret = crypto.randomUUID().replace(/-/g, ""); await setCfg(sb, "brain_webhook_secret", secret); }
    const webhookUrl = `${url.origin}/api/telegram/brain`;
    const r = await brainSetWebhook(webhookUrl, secret);
    return NextResponse.json({ ok: r.ok, webhookUrl, gemini: geminiConfigured(), telegram: r });
  }

  return NextResponse.json({ ok: true, brainBot: brainBotConfigured(), gemini: geminiConfigured(), hint: "POST = webhook Telegram; ?setup=go để trỏ webhook; ?ping=<chatId> để thử." });
}

export async function POST(req: Request) {
  const sb = getServiceClient();

  const secret = (await getCfg(sb, "brain_webhook_secret")) || "";
  if (!secret || req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false, error: "bad_secret" }, { status: 401 });
  }

  const update: any = await req.json().catch(() => ({}));
  const msg = update?.message;
  const chatId = msg?.chat?.id != null ? String(msg.chat.id) : "";

  let text = (msg?.text || msg?.caption || "").trim();
  const chatType = msg?.chat?.type || "private";
  const isGroup = chatType === "group" || chatType === "supergroup";

  if (chatId && isGroup) {
    try {
      const cu = JSON.parse((await sb.from("config").select("value").eq("key", "tg_nhom_thay").maybeSingle()).data?.value || "[]");
      const con = Array.isArray(cu) ? cu.filter((x: any) => String(x.id) !== chatId) : [];
      con.push({ id: chatId, ten: msg?.chat?.title || "", loai: chatType, thay: new Date().toISOString() });
      await sb.from("config").upsert({
        key: "tg_nhom_thay", value: JSON.stringify(con.slice(-30)),
        description: "Các nhóm Telegram bot trợ lý đã nhìn thấy (id + tên) — dùng để gửi báo cáo vào nhóm",
      }, { onConflict: "key" });
    } catch {  }

    await luuTinDon(sb, msg, text);
  }

  const themBot = suKienThemBot(update, (brainBotToken() || "").split(":")[0]);
  if (themBot) {
    const ceo = (process.env.TELEGRAM_CHAT_ID || "").trim();
    const cam = tachCsv(await getCfg(sb, "brain_nhom_cam")).includes(themBot.chatId);
    const daMo = (await allowedChats(sb)).has(themBot.chatId);
    if (cam || daMo) return NextResponse.json({ ok: true, them_bot: cam ? "nhom_cam" : "da_mo" });
    if (laCeo(themBot.tuId, ceo)) {
      await tuMoNhom(sb, themBot.chatId, themBot.tenNhom);
      return NextResponse.json({ ok: true, them_bot: "ceo_mo" });
    }
    await baoNhomLa(sb, themBot.chatId,
      `Em vừa bị thêm vào nhóm <b>${tgEscape(themBot.tenNhom || themBot.chatId)}</b> bởi <b>${tgEscape(themBot.tenNguoiThem || themBot.tuId)}</b>. Nhóm chưa được anh cấp quyền nên em KHÔNG trả lời trong đó.\nNếu là nhóm nội bộ, anh gõ: <code>/capquyen ${themBot.chatId}</code>`);
    return NextResponse.json({ ok: true, them_bot: "chua_cap" });
  }

  if (chatId && !text && !isGroup && (msg?.photo || msg?.document || msg?.voice || msg?.video || msg?.audio)) {
    const what = msg?.photo ? "ảnh" : msg?.voice || msg?.audio ? "tin nhắn thoại" : msg?.video ? "video" : "tệp";
    await sendBrainTelegram(chatId, `Em có nhận được ${what} của anh, nhưng hiện em <b>chưa đọc được nội dung bên trong</b> — em mới chỉ nghe được chữ thôi. Anh gõ giúp em vài dòng anh muốn hỏi nhé.`);
    return NextResponse.json({ ok: true, skip: "media_no_text" });
  }
  if (!chatId || !text) return NextResponse.json({ ok: true, skip: "no_text" });

  const nhomCam = tachCsv(await getCfg(sb, "brain_nhom_cam"));
  const allow = await allowedChats(sb);

  const qdNhom = quyetDinhNhom({ isGroup, chatId, allow, nhomCam, fromId: (msg as any)?.from?.id, ceoId: process.env.TELEGRAM_CHAT_ID, text });
  if (qdNhom === "cam") return NextResponse.json({ ok: true, skip: "nhom_cam", chatId });
  if (qdNhom === "chua_cap") {
    await baoNhomLa(sb, chatId, `Em đang ở nhóm <b>${tgEscape(String(msg?.chat?.title || chatId))}</b> chưa được anh cấp quyền nên em KHÔNG trả lời.\nNếu là nhóm nội bộ, anh gõ: <code>/capquyen ${chatId}</code>`);
    return NextResponse.json({ ok: true, skip: "nhom_la_chua_cap_quyen" });
  }
  if (isGroup) allow.add(chatId);
  if (allow.size && !allow.has(chatId)) {

    const who = `${msg?.from?.first_name || ""} ${msg?.from?.last_name || ""}`.trim() || chatId;
    await setCfg(sb, "brain_pending_owner", JSON.stringify({ chatId, name: who }));
    if (!isGroup) {
      await sendBrainTelegram(chatId,
        "Em là Trợ lý ACME. Chat riêng em chỉ mở khi CEO cấp quyền.\n\n" +
        "Anh/chị hỏi giúp em <b>trong nhóm công việc</b> nhé — nhắc tên em trong nhóm là em trả lời ngay.\n" +
        "Cần chat riêng thì nhờ CEO cấp quyền giúp.");

      let daBao: string[] = [];
      try { daBao = JSON.parse((await getCfg(sb, "brain_pending_notified")) || "[]"); } catch { }
      const ceo = (process.env.TELEGRAM_CHAT_ID || "").trim();
      if (ceo && !daBao.includes(String(chatId))) {
        daBao.push(String(chatId));
        await setCfg(sb, "brain_pending_notified", JSON.stringify(daBao.slice(-200)));
        await sendBrainTelegram(ceo,
          `\u{1F512} <b>${tgEscape(who)}</b> vừa nhắn riêng em (mã <code>${chatId}</code>) — em đã mời họ hỏi trong nhóm.\n` +
          `Muốn cho người này chat riêng: <code>/capquyen ${chatId}</code>`).catch(() => { });
      }
    }
    return NextResponse.json({ ok: true, skip: "not_allowed", chatId, isGroup });
  }

  const senderName = `${msg?.from?.first_name || ""} ${msg?.from?.last_name || ""}`.trim() || chatId;
  const isCeo = chatId === (process.env.TELEGRAM_CHAT_ID || "").trim();

  const ceoGo = isCeo || String((msg as any)?.from?.id || "") === (process.env.TELEGRAM_CHAT_ID || "").trim();

  if (isGroup) {

    if (msg?.from?.is_bot) return NextResponse.json({ ok: true, skip: "bot_message" });
    const uname = await brainUsername(sb);
    const mentioned = !!uname && new RegExp(`@${uname}(\\b|$)`, "i").test(text);
    const repliedToBot = !!msg?.reply_to_message?.from?.is_bot;
    const isCmd = text.startsWith("/");
    if (!mentioned && !repliedToBot && !isCmd) {
      try {
        const h = JSON.parse((await getCfg(sb, HIST_KEY(chatId))) || "[]");
        h.push({ role: "user", text: `${senderName}: ${text}`.slice(0, 500) });
        await setCfg(sb, HIST_KEY(chatId), JSON.stringify(h.slice(-MAX_TURNS * 2)));
      } catch { }
      return NextResponse.json({ ok: true, skip: "group_observe" });
    }
    if (mentioned && uname) text = text.replace(new RegExp(`@${uname}`, "ig"), "").trim();
  }

  if (/^\/nhomads\b/i.test(text)) {
    const ceoId = (process.env.TELEGRAM_CHAT_ID || "").trim();
    if (ceoId && String((msg as any)?.from?.id || "") !== ceoId) {
      await sendBrainTelegram(chatId, "Chỉ CEO đăng ký được nhóm ads.");
      return NextResponse.json({ ok: true, denied: true });
    }
    await setCfg(sb, "ads_chat_id", String(chatId));
    await sendBrainTelegram(chatId, "Đã ghi nhận nhóm này là NHÓM QUẢN LÝ ADS.\nTừ giờ em đẩy về đây: chi phí Meta + Google hằng ngày, cảnh báo CPL vượt trần, đề xuất autopilot, và bài creative mới cho campaign CTR yếu (đội Nội dung đăng tay).\nNút đổi tiền (Ngừng/Scale) vẫn để ở chat riêng anh cho an toàn.");
    return NextResponse.json({ ok: true, ads_chat: chatId });
  }

  const mQuyen = text.match(/^\/(capquyen|thuquyen)\s+(-?\d+)/i);
  if (mQuyen) {
    const ceoId = (process.env.TELEGRAM_CHAT_ID || "").trim();
    if (ceoId && String((msg as any)?.from?.id || "") !== ceoId && chatId !== ceoId) {
      await sendBrainTelegram(chatId, "Chỉ CEO cấp/thu quyền chat riêng được.");
      return NextResponse.json({ ok: true, denied: true });
    }
    const mo = mQuyen[1].toLowerCase() === "capquyen";
    const id = mQuyen[2];
    let cur = ((await getCfg(sb, "brain_allow")) || "").split(",").map((s: string) => s.trim()).filter(Boolean);
    if (mo) { if (!cur.includes(id)) cur.push(id); }
    else { cur = cur.filter((x: string) => x !== id); }
    await setCfg(sb, "brain_allow", cur.join(","));
    await sendBrainTelegram(chatId, mo ? `\u{2713} Đã mở chat riêng cho <code>${id}</code>.` : `\u{2713} Đã thu quyền chat riêng của <code>${id}</code>.`);
    if (mo) await sendBrainTelegram(id, "\u{2713} CEO đã cấp quyền — giờ anh/chị nhắn riêng em thoải mái nhé.").catch(() => { });
    return NextResponse.json({ ok: true, mo, id });
  }

  const mDadang = text.match(/^\/dadang\s+(\S+)/i);
  if (mDadang) {

    const nguoiDang = tachCsv(await getCfg(sb, "ads_nguoi_dang"));
    if (!ceoGo && !duocDungDadang((msg as any)?.from?.id, process.env.TELEGRAM_CHAT_ID, nguoiDang)) {
      await sendBrainTelegram(chatId, "Lệnh này chỉ CEO hoặc người đăng ads được giao mới dùng được.");
      return NextResponse.json({ ok: true, denied: true });
    }
    const cid = mDadang[1];
    try { await sb.from("content_items").update({ status: "published", publish_date: new Date().toISOString(), notes: "Đăng tay xác nhận qua Telegram (ads creative)" }).eq("id", cid); } catch { }
    let resumed = "";
    try {
      const pv = (await sb.from("config").select("value").eq("key", "ads_creative_pending").maybeSingle()).data?.value;
      const map = pv ? JSON.parse(pv) : {};
      const link = map?.[String(cid)];
      if (link?.campaignId) {
        const { setCampaignStatus } = await import("@/lib/ads-control");
        const rr = await setCampaignStatus(link.campaignId, "ACTIVE");
        delete map[String(cid)];
        await sb.from("config").upsert({ key: "ads_creative_pending", value: JSON.stringify(map) }, { onConflict: "key" });
        resumed = rr?.ok ? `\nĐã BẬT LẠI campaign "${link.campaignName}" — autopilot sẽ tối ưu ngân sách theo hiệu quả.` : `\nBật lại campaign lỗi (${(rr?.error || "").slice(0, 100)}) — anh bật tay giúp em.`;
      }
    } catch { }
    await sendBrainTelegram(chatId, `Đã ghi nhận đăng bài ${cid}.${resumed}`);
    return NextResponse.json({ ok: true, dadang: cid });
  }

  const lenhDuyet = docLenhDuyet(text);
  if (lenhDuyet) {
    if (!ceoGo) { await sendBrainTelegram(chatId, "Chỉ CEO duyệt được câu này."); return NextResponse.json({ ok: true, denied: true }); }
    const ds = await docCho(sb);
    const c = ds.find((x) => x.ma === lenhDuyet.ma);
    if (!c) { await sendBrainTelegram(chatId, `Không thấy câu <code>${lenhDuyet.ma}</code> đang chờ (đã xử lý hoặc quá 2 ngày).`); return NextResponse.json({ ok: true }); }
    await setCfg(sb, DUYET_KEY, JSON.stringify(ds.filter((x) => x.ma !== c.ma)));
    if (!lenhDuyet.duyet) {
      await sendBrainTelegram(c.chatId, `Câu hỏi của ${tgEscape(c.ten)} CEO chưa cho em trả lời trong nhóm ạ.`);
      await sendBrainTelegram(chatId, `Đã báo nhóm <b>${tgEscape(c.tenNhom || c.chatId)}</b> là anh không duyệt.`);
      return NextResponse.json({ ok: true, khong_duyet: c.ma });
    }
    await brainSendTyping(c.chatId);
    const out = await traLoiDaDuyet(sb, c);
    if (!out) { await sendBrainTelegram(chatId, "Bộ não đang trả lỗi, anh bấm lại lệnh duyệt sau ít phút giúp em."); await setCfg(sb, DUYET_KEY, JSON.stringify(ds)); return NextResponse.json({ ok: false }); }
    const body = `Trả lời ${c.ten} (CEO đã duyệt):\n\n${out}`;
    await sendBrainTelegram(c.chatId, tgFromMarkdown(body.length > 3900 ? body.slice(0, 3900) + "…" : body), true);
    await sendBrainTelegram(chatId, `\u{2713} Đã trả lời vào nhóm <b>${tgEscape(c.tenNhom || c.chatId)}</b>.`);
    return NextResponse.json({ ok: true, da_duyet: c.ma });
  }

  if (/^\/seo(@\w+)?(\s|$)/i.test(text)) {
    if (!ceoGo) { await sendBrainTelegram(chatId, "Chỉ CEO mới điều khiển được agent SEO."); return NextResponse.json({ ok: true, denied: true }); }
    const { xuLyLenhSeo } = await import("@/lib/seo-agent");
    const tl = await xuLyLenhSeo(text).catch((e: any) => `Agent SEO lỗi: ${String(e?.message || e).slice(0, 200)}`);
    await sendBrainTelegram(chatId, tgEscape(tl).slice(0, 4000));
    return NextResponse.json({ ok: true });
  }
  const mDuyet = text.match(/^\/?(duy[eệ]t|t[uừ]\s*ch[oố]i|tuchoi|deploy)\s+([0-9a-f]{4,8})\b/i);
  if (mDuyet) {
    if (!ceoGo) { await sendBrainTelegram(chatId, "Chỉ CEO mới duyệt được việc build."); return NextResponse.json({ ok: true }); }
    const act = /duy/i.test(mDuyet[1]) ? "duyet" : /deploy/i.test(mDuyet[1]) ? "deploy" : "tuchoi";
    const id = mDuyet[2];
    const cc = await import("@/lib/cc-queue");

    if (act.toLowerCase() === "duyet") {
      const t = await cc.approve(id);
      await sendBrainTelegram(chatId, t ? `\u{2713} Đã duyệt việc ${id}.\n${tgEscape(await cc.loiHuaThat())}` : `Không thấy việc ${id} đang chờ duyệt.`);
    }
    else if (act.toLowerCase() === "tuchoi") { const t = await cc.reject(id); await sendBrainTelegram(chatId, t ? `Đã từ chối việc ${id}.` : `Không thấy việc ${id}.`); }
    else { const orig = await cc.getTask(id); await cc.addTask(chuViecDeploy(id), orig?.project || "ikihealing-hub", chatId, senderName); await sendBrainTelegram(chatId, `\u{1F680} Đã tạo việc DEPLOY cho ${id} — anh /duyet nó để Claude Code deploy.`); }
    return NextResponse.json({ ok: true });
  }

  if (ceoGo && /^\/?duy[eệ]t\b/i.test(text)) {
    const { listOpen } = await import("@/lib/cc-queue");
    const cho = (await listOpen()).filter((t) => t.status === "pending");
    await sendBrainTelegram(chatId, cho.length
      ? `\u{1F4CB} <b>${cho.length} việc đang chờ anh duyệt</b> — anh gõ <code>duyệt &lt;mã&gt;</code> cho việc muốn chạy:\n\n`
        + cho.slice(-8).map((t) => `• <code>${t.id}</code> — ${tgEscape(t.task.slice(0, 70))}`).join("\n")
        + `\n\n${tgEscape(await (await import("@/lib/cc-queue")).loiHuaThat())} Không cần nữa thì <code>từ chối &lt;mã&gt;</code>.`
      : "\u{2713} Hiện không có việc build nào chờ duyệt anh nhé.");
    return NextResponse.json({ ok: true, cho: cho.length });
  }
  if (/^\/?vi[eệ]c\b/i.test(text)) {
    const { listOpen, loiHuaThat } = await import("@/lib/cc-queue");
    const open = await listOpen();

    const body = open.length
      ? `\u{1F4CB} <b>Việc đang mở (${open.length}):</b>\n`
        + open.map((t) => `• [${t.id}] ${t.status === "pending" ? "chờ duyệt" : t.status === "approved" ? "chờ Claude Code" : "đang làm"} — ${tgEscape(t.task.slice(0, 50))} <i>(${tgEscape(t.byName)})</i>`).join("\n")
        + `\n\n${tgEscape(await loiHuaThat())}`
      : "\u{2713} Không có việc build nào đang mở.";
    await sendBrainTelegram(chatId, body);
    return NextResponse.json({ ok: true });
  }

  if (/^\/start\b/.test(text)) {
    await sendBrainTelegram(chatId, "\u{1F44B} Chào CEO! Em là <b>Trợ lý ACME</b> — em nắm số liệu sống của công ty (doanh thu, sale, tồn kho, chăm sóc khách) và hiểu rõ thương hiệu mình.\n\nAnh cứ hỏi tự nhiên, ví dụ:\n• \"Hôm nay bán được bao nhiêu?\"\n• \"Sale nào đang chậm nhịp?\"\n• \"Tồn kho món nào sắp hết?\"\n• \"Gợi ý cho anh cách đẩy đơn cuối tháng\"\n\nGõ /reset nếu muốn em quên cuộc trò chuyện cũ.");
    return NextResponse.json({ ok: true });
  }
  if (/^\/reset\b/.test(text)) {
    await setCfg(sb, HIST_KEY(chatId), "[]");
    await sendBrainTelegram(chatId, "\u{2713} Xong, em đã làm mới cuộc trò chuyện. Mình bắt đầu lại nhé anh.");
    return NextResponse.json({ ok: true });
  }

  const duan = text.match(/^\/duan\s+([^:]+?)\s*:\s*([\s\S]+)/i);
  if (duan) {
    const { touchProject } = await import("@/lib/portfolio");
    const p = await touchProject(duan[1].trim(), { nextStep: duan[2].trim() });
    await sendBrainTelegram(chatId, p
      ? `\u{2713} Đã cập nhật <b>${tgEscape(p.name)}</b> — việc kế tiếp: ${tgEscape(p.nextStep)}. Em tính lại là "vừa động tới hôm nay" nên hết bị nhắc bỏ bẵng.`
      : `Em chưa tìm thấy dự án khớp "${tgEscape(duan[1].trim())}". Anh gõ /duan để xem danh sách, hoặc hỏi "liệt kê dự án".`);
    return NextResponse.json({ ok: true });
  }

  if (/^\/duan\b/.test(text)) {
    const { getPortfolio, isStale, daysSince } = await import("@/lib/portfolio");
    const list = await getPortfolio();
    const stale = list.filter(isStale);
    const head = stale.length ? `\u{26A0} <b>${stale.length} dự án đang bỏ bẵng:</b>\n` + stale.slice(0, 10).map((p) => `• ${tgEscape(p.name)} — ${daysSince(p.lastUpdate)} ngày`).join("\n") : "\u{2713} Không có dự án nào bỏ bẵng.";
    await sendBrainTelegram(chatId, head + `\n\nCập nhật: /duan &lt;tên&gt; : &lt;việc kế tiếp&gt;\n<a href="${appLink("/du-an")}">Xem đầy đủ danh mục dự án</a>`);
    return NextResponse.json({ ok: true });
  }

  if (/^\/skills?\b/i.test(text)) {
    let q: any = { items: [] }; try { q = JSON.parse((await getCfg(sb, "brain_skill_requests")) || '{"items":[]}'); } catch {}
    const news = (q.items || []).filter((x: any) => x.status === "new");
    const body = news.length
      ? `\u{1F527} <b>${news.length} kỹ năng trợ lý đang cần bổ sung:</b>\n` + news.map((x: any) => `• ${tgEscape(x.ten)}${x.count > 1 ? ` (gặp ${x.count} lần)` : ""} — ${tgEscape(x.ly_do || "")}`).join("\n") + `\n\nEm sẽ báo đội kỹ thuật bổ sung có kiểm duyệt rồi làm được ngay.`
      : "\u{2713} Hiện trợ lý làm được mọi việc anh yêu cầu, chưa thiếu kỹ năng nào.";
    await sendBrainTelegram(chatId, body);
    return NextResponse.json({ ok: true });
  }

  const nho = text.match(/^\/nho\s+([\s\S]+)/i);
  if (nho) {

    if (!ceoGo && !duocDungNho((msg as any)?.from?.id, process.env.TELEGRAM_CHAT_ID)) {
      await sendBrainTelegram(chatId, "Chỉ CEO dạy em ghi nhớ được.");
      return NextResponse.json({ ok: true, denied: true });
    }
    const n = await saveLearnings([nho[1].trim()]);
    await sendBrainTelegram(chatId, `\u{2713} Em nhớ rồi anh. (Đang giữ ${n} điều về anh & công ty — em sẽ áp dụng từ giờ.)`);
    return NextResponse.json({ ok: true });
  }

  if (isCeo && /^\s*\d{4,8}\s*$/.test(text)) {
    let mr: any = null; try { mr = JSON.parse((await getCfg(sb, "misa_recrawl")) || "null"); } catch {}
    if (mr && mr.status === "need_otp") {
      const now = new Date().toISOString();
      await setCfg(sb, "misa_recrawl", JSON.stringify({ requestedAt: now, handledAt: null, status: "queued", otp: text.trim(), msg: "Đã nhận OTP — đang đăng nhập lại & cào.", at: now }));
      await setCfg(sb, "misa_recrawl_notified", "");
      await sendBrainTelegram(chatId, "\u{2713} Em nhận được mã rồi anh. Đang đăng nhập lại MISA & cào — xong em báo anh ngay (khoảng 1-2 phút).");
      return NextResponse.json({ ok: true, otp_submitted: true });
    }
  }

  if (isCeo && laLenhNhanh(text, /t[aạ]o\s*b[aà]i/i, 60)) {
    await sendBrainTelegram(chatId, "Dạ em viết bài + vẽ ảnh ngay, chờ em ~20 giây anh nhé...");
    const rf = await runFactory(2);
    if (!rf.ok) { await sendBrainTelegram(chatId, `Em chưa tạo được bài: ${tgEscape((rf.error || "").slice(0, 150))}`); return NextResponse.json({ ok: false, error: rf.error }); }
    const pushed = await pushDraftsToCEO(rf.items);
    const coAnh = rf.items.filter((it) => it.imageUrl).length;
    await sendBrainTelegram(chatId, pushed
      ? `\u{2713} Xong! Em vừa gửi <b>${pushed} bài</b>${coAnh ? ` (${coAnh} bài có ảnh)` : " (chưa vẽ được ảnh — đăng chữ)"} kèm nút <b>Đã đăng</b> sang bot <b>Báo Cáo</b>. Nhân viên COPY nội dung, đăng lên fanpage rồi bấm <b>Đã đăng</b> — em kiểm từ cấm hộ.`
      : `Em đã tạo ${rf.saved} bài (xem ${appLink("/content")}) nhưng chưa bắn nút ra Telegram được — kiểm TELEGRAM_CHAT_ID.`);
    return NextResponse.json({ ok: true, saved: rf.saved, pushed });
  }

  if (isCeo && laLenhNhanh(text, /(research|nghi[eê]n\s*c[uứ]u)/i, 28)) {
    await sendBrainTelegram(chatId, "Dạ em tra thị trường + đối thủ ngay, chờ em ~20 giây anh nhé...");
    const { runResearch } = await import("@/lib/content-factory");
    const r = await runResearch();
    if (!r.ok) { await sendBrainTelegram(chatId, `Em chưa tra được: ${tgEscape((r.error || "").slice(0, 150))}`); return NextResponse.json({ ok: false, error: r.error }); }
    const body = String(r.summary || "");
    await sendBrainTelegram(chatId, `\u{1F50E} <b>NGHIÊN CỨU THỊ TRƯỜNG</b> (${body.length} ký tự)\n\n${tgFromMarkdown(body.length > 3600 ? body.slice(0, 3600) + "…" : body)}`);
    return NextResponse.json({ ok: true, chars: body.length });
  }

  if (isCeo && laLenhNhanh(text, /(qu[aả]ng\s*c[aá]o|\bads\b)/i, 26)) {
    const { listCampaigns } = await import("@/lib/ads-control");
    const r = await listCampaigns();
    if (!r.ok) { await sendBrainTelegram(chatId, `Em chưa đọc được chiến dịch: ${tgEscape((r.error || "").slice(0, 150))}`); return NextResponse.json({ ok: false, error: r.error }); }
    const actives = (r.campaigns || []).filter((c) => /ACTIVE/i.test(c.status));
    if (!actives.length) { await sendBrainTelegram(chatId, "Hiện KHÔNG có chiến dịch nào đang chạy anh nhé."); return NextResponse.json({ ok: true, actives: 0 }); }
    await sendBrainTelegram(chatId, `\u{1F4B0} <b>${actives.length} chiến dịch đang chạy</b> — em gửi kèm nút Ngừng/Tăng/Giảm ngay đây, anh bấm là đổi thật:`);
    let sent = 0;
    for (const c of actives.slice(0, 8)) {
      const bud = c.dailyBudget ? `${c.dailyBudget.toLocaleString("vi-VN")}đ/ngày` : "ngân sách ở nhóm QC";
      const txt = `\u{1F4B0} <b>${tgEscape(c.name)}</b>\nChi tháng: ${c.spend.toLocaleString("vi-VN")}đ · ${bud}`;
      const s = await sendTelegramWithButtons(txt, [[
        { text: "\u{23F8} Ngừng", callback_data: `adpause:${c.id}` },
        { text: "\u{2191} +20%", callback_data: `adup:${c.id}` },
        { text: "\u{2193} -20%", callback_data: `addown:${c.id}` },
      ]], chatId);
      if (s.ok) sent++;
    }
    return NextResponse.json({ ok: true, sent });
  }

  if (isCeo && laLenhNhanh(text, /c[aâ]n\s*đ[oố]i/i, 24)) {
    await sendBrainTelegram(chatId, "Dạ em tổng hợp tiền + hàng + nợ, chờ em chút anh nhé...");
    const { buildDailyBalance } = await import("@/lib/balance-report");
    const b = await buildDailyBalance();
    await sendBrainTelegram(chatId, b.ok ? `${b.text}\n\n👉 <a href="${appLink("/tai-chinh")}">Chi tiết tài chính</a>` : `Em chưa dựng được: ${tgEscape((b.error || "").slice(0, 150))}`);
    return NextResponse.json({ ok: b.ok });
  }

  if (isCeo && laLenhNhanh(text, /(lead\s*(đ[oọ]ng|dong|t[oồ]n|ton)|d[oọ]n\s*lead)/i, 30)) {
    const { buildLeadBacklog } = await import("@/lib/task-nudge");
    const t = await buildLeadBacklog(sb);
    await sendBrainTelegram(chatId, t);
    return NextResponse.json({ ok: true });
  }

  if (isCeo && text.length <= 26) {
    const { matchAgentKey, latestAgentReport, MASTER_NAME } = await import("@/lib/agent-report");
    const ak = matchAgentKey(text);
    if (ak) {
      const rep = await latestAgentReport(ak);

      const intro = ak === "list" ? "" : `Dạ anh, em là <b>${MASTER_NAME}</b> — em chuyển báo cáo từ agent phụ trách:\n\n`;
      await sendBrainTelegram(chatId, intro + rep);
      return NextResponse.json({ ok: true, agent: ak });
    }
  }

  if (!geminiConfigured()) {
    await sendBrainTelegram(chatId, "Em chưa có \"bộ não\" (GEMINI_API_KEY). Anh dán key Gemini vào Vercel giúp em rồi báo lại nhé — em sẽ thông minh ngay.");
    return NextResponse.json({ ok: true, skip: "no_gemini" });
  }

  if (await getCfg(sb, PENDING_KEY(chatId))) await setCfg(sb, PENDING_KEY(chatId), "");

  if (!ceoGo && await vuotLuotNguoi("bot-brain", String((msg as any)?.from?.id || chatId), GIOI_HAN_LUOT_BOT)) {
    await sendBrainTelegram(chatId, CAU_VUOT_LUOT);
    return NextResponse.json({ ok: true, skip: "vuot_luot" });
  }

  const thongTinCau = { chatId, tenNhom: String(msg?.chat?.title || ""), fromId: String((msg as any)?.from?.id || chatId), ten: senderName, cau: text };
  if (!isCeo && laCauNhayCam(text)) {
    if (!ceoGo) { await xinDuyet(sb, thongTinCau); return NextResponse.json({ ok: true, cho_duyet: true }); }
    await brainSendTyping(chatId);
    const out = await traLoiDaDuyet(sb, { ...thongTinCau, ma: "", at: new Date().toISOString() });
    await sendBrainTelegram(chatId, tgFromMarkdown(out ? (out.length > 3900 ? out.slice(0, 3900) + "…" : out) : "Em hơi khựng chút xíu (bộ não trả lỗi). Anh thử hỏi lại giúp em nhé."), true);
    return NextResponse.json({ ok: !!out, ceo_tu_duyet: true });
  }

  await brainSendTyping(chatId);
  let history: Turn[] = [];
  try { history = JSON.parse((await getCfg(sb, HIST_KEY(chatId))) || "[]"); } catch {}

  const liveTho = await buildLiveContext();
  const live = isCeo ? liveTho : catKhoiTaiSan(liveTho);

  const ragTho = await retrieveKnowledge(text, 6).catch(() => []);
  const brainRag = isCeo ? ragTho : locKhoRiengCeo(ragTho);
  const knowledge = brainRag.length
    ? "\n\nKIẾN THỨC NỘI BỘ LIÊN QUAN (playbook + bài học đã đo; nêu nguồn khi dựa vào):\n" +
      brainRag.join("\n\n---\n\n")
    : "";

  const cauKho = laCauChienLuoc(text);
  const hocNgoai = cauKho ? await getHocTheGioi().catch(() => "") : "";

  const cayTang = cauKho ? getCayKinhDoanh() : "";

  const congThuc = cauKho ? getBoCongThuc() : "";

  const docKhach = laCauVeKhach(text) ? getDocKhach() : "";

  const tuGiao = laNguoiTuGiao((msg as any)?.from?.id, process.env.TELEGRAM_CHAT_ID, tachCsv(await getCfg(sb, "cc_nguoi_tu_giao")));
  const system = ACME_IDENTITY + live + knowledge + hocNgoai + cayTang + congThuc + docKhach + (isCeo ? "" : RAO_NHOM_CO_DUYET) + khoiNguoiHoi(senderName, ceoGo) + (tuGiao && !ceoGo ? khoiNguoiTuGiao(senderName) : "");

  const cauNao = cauKemTen(text, senderName, isGroup);

  const brainModel = pickBrainModel(text);

  const nghi = cauKho ? { thinkingBudget: 2048, maxOutputTokens: 4000 } : {};

  let ans = (cauKho && claudeBrainConfigured())
    ? await askClaudeTools(system, history.slice(-MAX_TURNS), cauNao, SKILL_DECLS, { maxTokens: 6000, thinkingBudget: 2048 })
    : { ok: false as const, text: "", calls: [] as any[], error: "skip" };
  if (!ans.ok) ans = await askGeminiTools(system, history.slice(-MAX_TURNS), cauNao, SKILL_DECLS, brainModel, nghi);
  if (!ans.ok) {
    await sendBrainTelegram(chatId, "Em hơi khựng chút xíu (bộ não trả lỗi). Anh thử hỏi lại giúp em nhé. \u{1F64F}");
    return NextResponse.json({ ok: false, error: ans.error });
  }

  if (ans.calls?.length) {
    const call = ans.calls[0] as SkillCall;

    const mucQuyen: MucQuyen = ceoGo ? "ceo" : "quanly";
    if (!duocDungSkill(call.name, mucQuyen)) {
      await sendBrainTelegram(chatId, loiTuChoiSkill(call.name));
      return NextResponse.json({ ok: true, tuChoi: call.name, mucQuyen });
    }

    const result = await runSkill(call, { chatId, name: senderName, laCeo: ceoGo, tuGiao });

    const traThang = call.name === "giao_claude_code" || call.name === "yeu_cau_skill" || call.name === "soat_may";
    const finalAns = traThang
      ? { ok: false as const, text: "" }
      : await askGemini(system, history.slice(-MAX_TURNS), `${cauNao}\n\n[Kết quả '${call.name}']: ${result}\n\nTrả lời người hỏi tự nhiên, ngắn gọn dựa trên kết quả trên.`, { model: brainModel, ...nghi });
    const outText = (finalAns.ok && finalAns.text) ? finalAns.text : result;
    await sendBrainTelegram(chatId, tgFromMarkdown(outText.length > 3900 ? outText.slice(0, 3900) + "…" : outText), true);
    const next = [...history, { role: "user", text: cauNao }, { role: "model", text: outText }].slice(-MAX_TURNS * 2) as Turn[];
    await setCfg(sb, HIST_KEY(chatId), JSON.stringify(next));
    return NextResponse.json({ ok: true, did: call.name });
  }

  let outText = ans.text;
  if (!outText) { const plain = await askGemini(system, history.slice(-MAX_TURNS), cauNao, { model: brainModel, ...nghi }); outText = plain.ok ? plain.text : "Anh nói rõ hơn giúp em chút nhé."; }

  if (!isCeo && coMarkerCanDuyet(outText)) {
    if (!ceoGo) { await xinDuyet(sb, thongTinCau); return NextResponse.json({ ok: true, cho_duyet: "marker" }); }
    outText = (await traLoiDaDuyet(sb, { ...thongTinCau, ma: "", at: new Date().toISOString() })) || "Em hơi khựng chút xíu (bộ não trả lỗi). Anh thử hỏi lại giúp em nhé.";
    await sendBrainTelegram(chatId, tgFromMarkdown(outText.length > 3900 ? outText.slice(0, 3900) + "…" : outText), true);
    return NextResponse.json({ ok: true, ceo_tu_duyet: "marker" });
  }
  await sendBrainTelegram(chatId, tgFromMarkdown(outText.length > 3900 ? outText.slice(0, 3900) + "…" : outText), true);
  const next = [...history, { role: "user", text: cauNao }, { role: "model", text: outText }].slice(-MAX_TURNS * 2) as Turn[];
  await setCfg(sb, HIST_KEY(chatId), JSON.stringify(next));
  return NextResponse.json({ ok: true });
}
