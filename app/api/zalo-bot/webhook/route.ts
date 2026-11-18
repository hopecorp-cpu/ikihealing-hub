import { NextResponse } from "next/server";
import crypto from "crypto";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { sendBrainTelegram, tgEscape } from "@/lib/telegram";
import { askGemini, geminiConfigured } from "@/lib/gemini";
import { askClaudeTools, claudeBrainConfigured } from "@/lib/claude-brain";
import { ACME_IDENTITY, buildLiveContext, pickBrainModel, laCauChienLuoc, RAO_NGOAI_CHAT_CEO } from "@/lib/acme-brain";
import { retrieveKnowledge, locKhoRiengCeo } from "@/lib/covan/rag";
import { quyenChat, sendZaloBot, zaloBotTyping, zaloBotSetWebhook, zaloBotGetMe, zaloBotConfigured } from "@/lib/zalo-bot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Turn = { role: "user" | "model"; text: string };
const HIST_KEY = (chatId: string) => `zalo_bot_hist_${chatId}`;
const MAX_TURNS = 16;
const KHOA_NGUOI_LA = "zalo_bot_nguoi_la";

function dungSecret(got: string | null): boolean {
  const want = (process.env.ZALO_BOT_SECRET || "").trim();
  if (!want || !got) return false;
  const a = Buffer.from(got), b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!zaloBotConfigured()) return NextResponse.json({ ok: false, error: "thiếu ZALO_BOT_TOKEN hoặc ZALO_BOT_SECRET trên Vercel" });
  const url = new URL(req.url);
  const me = await zaloBotGetMe();
  if (url.searchParams.get("setup")) {
    const hook = await zaloBotSetWebhook(`${url.origin}/api/zalo-bot/webhook`);
    return NextResponse.json({ ok: !!hook?.ok, bot: me?.result ?? null, webhook: hook?.result ?? hook });
  }
  return NextResponse.json({ ok: !!me?.ok, bot: me?.result ?? null });
}

export async function POST(req: Request) {
  if (!dungSecret(req.headers.get("x-bot-api-secret-token"))) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }
  const body: any = await req.json().catch(() => ({}));
  const msg = body?.message;
  const chatId = String(msg?.chat?.id || "");
  const ten = String(msg?.from?.display_name || "").slice(0, 60);
  if (!chatId || msg?.from?.is_bot) return NextResponse.json({ ok: true, skip: "no_chat" });

  const quyen = quyenChat(chatId, await getConfigValue("zalo_bot_ceo"), await getConfigValue("zalo_bot_allow"));
  if (!quyen) {

    const daBao = ((await getConfigValue(KHOA_NGUOI_LA)) || "").split(",").filter(Boolean);
    if (!daBao.includes(chatId)) {
      const ceoTg = (process.env.TELEGRAM_CHAT_ID || "").trim();
      if (ceoTg) {
        await sendBrainTelegram(ceoTg,
          `Zalo Bot: <b>${tgEscape(ten || "không tên")}</b> vừa nhắn bot nhưng chưa được cấp quyền nên em chưa trả lời.\n` +
          `Mã chat: <code>${tgEscape(chatId)}</code>\nNếu là anh thì báo Claude đặt mã này vào config zalo_bot_ceo.`);
      }
      await setConfigValue(KHOA_NGUOI_LA, [...daBao, chatId].slice(-200).join(","), "Zalo Bot: người lạ đã báo CEO");
    }
    return NextResponse.json({ ok: true, skip: "not_allowed" });
  }

  if (body?.event_name !== "message.text.received" || !String(msg?.text || "").trim()) {
    await sendZaloBot(chatId, "Hiện em mới đọc được tin chữ thôi ạ. Anh/chị gõ chữ giúp em nhé.");
    return NextResponse.json({ ok: true, skip: body?.event_name });
  }
  const text = String(msg.text).trim().slice(0, 4000);
  const isCeo = quyen === "ceo";

  if (!geminiConfigured() && !claudeBrainConfigured()) {
    await sendZaloBot(chatId, "Em chưa có bộ não (thiếu khoá AI). Anh báo kỹ thuật giúp em nhé.");
    return NextResponse.json({ ok: false, error: "no_brain" });
  }

  await zaloBotTyping(chatId);
  let history: Turn[] = [];
  try { history = JSON.parse((await getConfigValue(HIST_KEY(chatId))) || "[]"); } catch { }
  const live = await buildLiveContext();

  const ragTho = await retrieveKnowledge(text, 6).catch(() => [] as string[]);
  const rag = isCeo ? ragTho : locKhoRiengCeo(ragTho);
  const knowledge = rag.length
    ? "\n\nKIẾN THỨC NỘI BỘ LIÊN QUAN (playbook + bài học đã đo; nêu nguồn khi dựa vào):\n" + rag.join("\n\n---\n\n")
    : "";
  const kenh = "\n\nKÊNH: bạn đang trả lời trên ZALO (không phải Telegram). Viết ngắn, gọn, không dùng bảng. " +
    "Trên kênh này bạn CHỈ hỏi-đáp: nếu được nhờ làm việc (giao việc Claude Code, đổi tiền quảng cáo, đăng bài...) thì nói CEO nhắn việc đó qua Telegram.";
  const system = ACME_IDENTITY + live + knowledge + kenh + (isCeo ? "" : RAO_NGOAI_CHAT_CEO);

  const cauKho = laCauChienLuoc(text);
  const hist = history.slice(-MAX_TURNS);

  let outText = "";
  if (cauKho && claudeBrainConfigured()) {
    const c = await askClaudeTools(system, hist, text, [], { maxTokens: 6000, thinkingBudget: 2048 });
    if (c.ok) outText = c.text;
  }
  if (!outText && geminiConfigured()) {
    const g = await askGemini(system, hist, text, { model: pickBrainModel(text), ...(cauKho ? { thinkingBudget: 2048, maxOutputTokens: 4000 } : {}) });
    if (g.ok) outText = g.text;
  }
  if (!outText) {
    await sendZaloBot(chatId, "Em hơi khựng chút xíu (bộ não trả lỗi). Anh thử hỏi lại giúp em nhé.");
    return NextResponse.json({ ok: false, error: "brain_failed" });
  }

  await sendZaloBot(chatId, outText);
  const next = [...history, { role: "user", text }, { role: "model", text: outText }].slice(-MAX_TURNS * 2) as Turn[];
  await setConfigValue(HIST_KEY(chatId), JSON.stringify(next), "Zalo Bot: lịch sử hội thoại Trợ lý AI");
  return NextResponse.json({ ok: true, quyen });
}
