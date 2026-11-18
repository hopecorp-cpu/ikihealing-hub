import { NextResponse } from "next/server";
import { runCommentAgent } from "@/lib/fb-comment-agent";
import { sendBrainTelegram, brainBotConfigured, sendTelegram, telegramConfigured, tgEscape, dichCuaMay } from "@/lib/telegram";
import { appLink } from "@/lib/app-url";
import { getServiceClient } from "@/lib/supabase-server";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

async function notify(text: string) {

  const dich = await dichCuaMay("lead-nong");
  if (dich && brainBotConfigured()) return sendBrainTelegram(dich, text);
  const ceo = (process.env.TELEGRAM_CHAT_ID || "").trim();
  if (brainBotConfigured() && ceo) return sendBrainTelegram(ceo, text);
  if (telegramConfigured()) return sendTelegram(text);
  return { ok: false };
}

const KIND_VN: Record<string, string> = {
  sensitive: "NHẠY CẢM (giá/bệnh/khiếu nại)",
  question: "Khách hỏi",
  cta_keyword: "Gõ từ khoá",
  left_phone: "Để lại SĐT",
};

async function layChuaBao(tran: number) {
  try {
    const sb = getServiceClient();
    const { data } = await sb.from("config").select("value").eq("key", "fb_comment_nhap").maybeSingle();
    const so: any[] = data?.value ? JSON.parse(data.value) : [];
    const can = so.filter((x) => x?.cau && !x?.daDang && !x?.daBao);
    if (!can.length) return [];
    const lay = can.slice(0, tran);
    const ids = new Set(lay.map((x) => x.id));
    const moi = so.map((x) => (ids.has(x?.id) ? { ...x, daBao: true } : x));
    await sb.from("config").upsert({ key: "fb_comment_nhap", value: JSON.stringify(moi) }, { onConflict: "key" });
    return lay.map((x) => ({ page: String(x.page || ""), link: String(x.link || ""), kind: String(x.kind || ""),
      binhLuan: String(x.binhLuan || ""), cau: String(x.cau || ""), conLai: can.length - lay.length }));
  } catch { return []; }
}

export async function GET(req: Request) {
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;

  const r = await runCommentAgent();
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 200 });

  if (r.leads || r.forHuman.length > 0) {
    const lines = [
      `\u{1F4AC} <b>AI trực bình luận</b> — quét ${r.scanned} bình luận`,
      r.leads ? `\u{1F525} <b>${r.leads} lead mới</b> từ bình luận — đã chia cho sale` : "",
      r.replied ? `\u{2713} Đã tự trả lời ${r.replied} bình luận (mẫu cố định)` : "",
      ``,
      r.forHuman.length ? `\u{1F464} <b>${r.forHuman.length} bình luận AI KHÔNG đụng — cần người:</b>` : "",
      ...r.forHuman.slice(0, 8).map((x) =>
        `• [${KIND_VN[x.kind] || x.kind}] <b>${tgEscape(x.from)}</b>: "${tgEscape(x.text.slice(0, 80))}"${x.link ? `\n   ${tgEscape(x.link)}` : ""}`
      ),
      r.forHuman.length > 8 ? `…và ${r.forHuman.length - 8} bình luận nữa` : "",
      ``,
      `<a href="${appLink("/content")}">Mở bảng nội dung</a>`,
    ].filter(Boolean);
    await notify(lines.join("\n"));
  }

  const choNguoi = await layChuaBao(5);
  if (choNguoi.length) {
    const d = [
      `\u{270D} <b>Máy đã soạn ${choNguoi.length} câu trả lời bình luận</b> — máy KHÔNG tự đăng, người dán giúp`,
      ``,
      ...choNguoi.flatMap((x) => [
        `• <b>${tgEscape(x.page)}</b> [${KIND_VN[x.kind] || x.kind}] khách: "${tgEscape(x.binhLuan.slice(0, 90))}"`,
        `   ${tgEscape(String(x.cau).slice(0, 300))}`,
        x.link ? `   ${tgEscape(x.link)}` : "",
      ].filter(Boolean)),
      choNguoi[0]?.conLai ? `…còn ${choNguoi[0].conLai} câu nữa trong sổ, lượt sau máy gửi tiếp` : "",
    ].filter(Boolean);
    await notify(d.join("\n"));
  }

  return NextResponse.json({ ...r, ok: true });
}
