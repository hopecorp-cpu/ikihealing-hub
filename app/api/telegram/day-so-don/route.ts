import { NextResponse } from "next/server";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const API = (token: string, m: string) => `https://api.telegram.org/bot${token}/${m}`;
const boDau = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase();

async function timNhom(token: string): Promise<{ id: string; ten: string } | null> {
  const r = await fetch(API(token, "getUpdates") + "?limit=100&timeout=0", { cache: "no-store" });
  const j: any = await r.json().catch(() => ({}));
  for (const up of (j.result || []).slice().reverse()) {
    const chat = up.message?.chat || up.channel_post?.chat || up.my_chat_member?.chat;
    if (!chat || !/group/.test(String(chat.type))) continue;
    const ten = boDau(String(chat.title || ""));
    if (ten.includes("don hang acme") || (ten.includes("don hang") && ten.includes("acme"))) {
      return { id: String(chat.id), ten: String(chat.title || "") };
    }
  }
  return null;
}

const TEN_TOKEN = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_BRAIN_BOT_TOKEN", "TELEGRAM_SALE_BOT_TOKEN", "COVAN_BOT_TOKEN"];

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !isManagerOrAbove(user.role)) {
    return NextResponse.json({ ok: false, loi: "Cần đăng nhập bằng tài khoản quản lý trở lên" }, { status: 401 });
  }

  const url = new URL(req.url);

  const sb = getServiceClient();
  const doc = async (k: string) => {
    const v = (await sb.from("config").select("value").eq("key", k).maybeSingle()).data?.value;
    try { return v ? JSON.parse(v) : null; } catch { return null; }
  };
  const ghi = (key: string, value: any, description: string) =>
    sb.from("config").upsert({ key, value: JSON.stringify(value), description }, { onConflict: "key" });

  if (url.searchParams.get("thu")) {
    const { sendTelegramMay, dichCuaMay } = await import("@/lib/telegram");
    const khoa = url.searchParams.get("thu")!;
    const dich = await dichCuaMay(khoa);
    const r = await sendTelegramMay(khoa,
      `Kiểm tra đường báo cáo: máy "${khoa}" từ nay bắn vào nhóm này. Tin thử, không phải số liệu.`);
    return NextResponse.json({ ok: r.ok, khoa, dich: dich || "(rơi về chat riêng CEO)", ketQua: r });
  }

  if (url.searchParams.get("chuandoan") === "1") {
    const bot: any[] = [];
    for (const ten of TEN_TOKEN) {
      const tk = (process.env[ten] || "").trim();
      if (!tk) { bot.push({ bien: ten, co: false }); continue; }
      const me: any = await fetch(API(tk, "getMe")).then((r) => r.json()).catch(() => ({}));
      const wh: any = await fetch(API(tk, "getWebhookInfo")).then((r) => r.json()).catch(() => ({}));
      const up: any = wh.result?.url ? { ok: false, description: "bị webhook chặn" }
        : await fetch(API(tk, "getUpdates") + "?limit=100&timeout=0").then((r) => r.json()).catch(() => ({}));
      const nhom = (up.result || []).map((x: any) => x.message?.chat || x.my_chat_member?.chat)
        .filter((c: any) => c && /group/.test(String(c.type)))
        .map((c: any) => ({ id: String(c.id), ten: c.title }));
      bot.push({
        bien: ten, co: true, ten_bot: me.result?.username || null,
        webhook: wh.result?.url || null, soTinCho: wh.result?.pending_update_count ?? null,
        docDuocUpdates: !wh.result?.url, nhomThay: [...new Map(nhom.map((n: any) => [n.id, n])).values()],

        docMoiTinTrongNhom: me.result?.can_read_all_group_messages ?? null,
        canGoTheNao: me.result?.can_read_all_group_messages
          ? "gõ tin gì cũng được"
          : `phải gõ có nhắc tên: @${me.result?.username || "bot"} chào`,
      });
    }

    const tokenHoi = (process.env.TELEGRAM_BRAIN_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "").trim();
    const dich: any[] = [];
    for (const ten of ["TELEGRAM_CHAT_ID", "TELEGRAM_SALES_CHAT_ID", "TELEGRAM_CONTENT_CHAT_ID",
      "TELEGRAM_FINANCE_CHAT_ID", "COVAN_CHAT_ID"]) {
      const id = (process.env[ten] || "").trim();
      if (!id) { dich.push({ bien: ten, dat: false }); continue; }

      let info: any = null;
      for (const tk of [tokenHoi, (process.env.TELEGRAM_BOT_TOKEN || "").trim(), (process.env.COVAN_BOT_TOKEN || "").trim()]) {
        if (!tk) continue;
        const j: any = await fetch(API(tk, "getChat") + `?chat_id=${encodeURIComponent(id)}`).then((r) => r.json()).catch(() => ({}));
        if (j.ok) { info = j.result; break; }
      }
      dich.push({
        bien: ten, dat: true, id,
        loai: info?.type || "không hỏi được", ten_chat: info?.title || info?.first_name || null,
        laNhom: info ? /group/.test(String(info.type)) : null,
      });
    }
    const soNhom = (await doc("tg_nhom_thay")) || [];
    return NextResponse.json({ ok: true, bot, dich, nhomDaThay: soNhom });
  }

  const tenToken = url.searchParams.get("bot") || "TELEGRAM_BRAIN_BOT_TOKEN";
  const token = (process.env[tenToken] || "").trim();
  if (!token) return NextResponse.json({ ok: false, loi: `Máy chủ chưa có ${tenToken}` }, { status: 500 });

  const chiThang = url.searchParams.get("thang");
  const dry = url.searchParams.get("dry") === "1";
  const epChat = url.searchParams.get("chat");

  let chatId = epChat || (await doc("tg_donhang_chat"))?.id || null;
  let tenNhom = (await doc("tg_donhang_chat"))?.ten || "";
  if (!chatId) {

    const soNhom = (await doc("tg_nhom_thay")) || [];
    const khop = (Array.isArray(soNhom) ? soNhom : []).find((n: any) => {
      const t = boDau(String(n.ten || ""));
      return t.includes("don hang acme") || (t.includes("don hang") && t.includes("acme"));
    });
    if (khop) {
      chatId = String(khop.id); tenNhom = khop.ten;
      await ghi("tg_donhang_chat", { id: chatId, ten: tenNhom }, "Id nhóm Telegram Đơn Hàng ACME");
    }
  }
  if (!chatId) {
    const found = await timNhom(token);
    if (!found) {
      return NextResponse.json({
        ok: false,
        loi: "Chưa thấy nhóm Đơn Hàng ACME trong getUpdates",
        canLam: "Vào nhóm Đơn Hàng ACME trên Telegram gõ MỘT tin bất kỳ (ví dụ: bot oi) rồi mở lại đường dẫn này. " +
          "Bot @acme_troly_bot chạy bằng webhook nên Telegram không cho hỏi ngược id nhóm — " +
          "phải có người gõ một câu thì webhook mới nhìn thấy và ghi id lại. " +
          "Nếu nhóm đổi tên, thêm ?chat=<id nhóm> để chỉ định thẳng.",
        soNhomDaThay: (await doc("tg_nhom_thay")) || [],
      }, { status: 404 });
    }
    chatId = found.id; tenNhom = found.ten;
    await ghi("tg_donhang_chat", found, "Id nhóm Telegram Đơn Hàng ACME (tự dò từ getUpdates)");
  }

  const hangDoi = (await doc("wa_donhang_hangdoi"))?.thuTu || [];
  if (!hangDoi.length) return NextResponse.json({ ok: false, loi: "Chưa nạp dữ liệu (config wa_donhang_hangdoi rỗng)" }, { status: 404 });

  const canDay = hangDoi
    .slice().sort((a: any, b: any) => String(a.thang).localeCompare(String(b.thang)))
    .filter((m: any) => (chiThang ? m.thang === chiThang : !m.daDay));

  if (!canDay.length) return NextResponse.json({ ok: true, nhom: tenNhom, ketQua: [], ghiChu: "Không còn tháng nào cần đẩy" });
  if (dry) return NextResponse.json({ ok: true, nhom: tenNhom, chatId, seDay: canDay.map((m: any) => m.thang) });

  const ketQua: any[] = [];
  for (const m of canDay) {
    const data = await doc(m.key);
    if (!data) { ketQua.push({ thang: m.thang, ok: false, loi: "không thấy dữ liệu" }); continue; }

    const rMsg = await fetch(API(token, "sendMessage"), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: data.tomTat, disable_web_page_preview: true }),
    });
    const jMsg: any = await rMsg.json().catch(() => ({}));

    const fd = new FormData();
    fd.append("chat_id", String(chatId));
    fd.append("caption", `Chi tiết từng đơn tháng ${m.thang.slice(5)}/${m.thang.slice(0, 4)}`);
    fd.append("document", new Blob([data.csv], { type: "text/csv" }), `don-hang-${m.thang.replace("-", "_")}.csv`);
    const rDoc = await fetch(API(token, "sendDocument"), { method: "POST", body: fd });
    const jDoc: any = await rDoc.json().catch(() => ({}));

    const ok = jMsg.ok !== false && jDoc.ok !== false;
    ketQua.push({ thang: m.thang, don: m.don, ok, loi: ok ? null : (jMsg.description || jDoc.description || "lỗi gửi") });
    if (ok) m.daDay = true;

    await new Promise((r) => setTimeout(r, 1200));
  }

  await ghi("wa_donhang_hangdoi", { capNhat: new Date().toISOString(), thuTu: hangDoi },
    "Hàng đợi đẩy sổ đơn WhatsApp lên Telegram — đúng thứ tự tháng cũ trước");

  return NextResponse.json({ ok: ketQua.every((k) => k.ok), nhom: tenNhom, ketQua });
}
