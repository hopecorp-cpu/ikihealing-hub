import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { answerCallback, editTelegramMessage, editTelegramCaption, sendTelegram as guiBaoCaoGoc, saleBotUsername, tgEscape } from "@/lib/telegram";
import { geminiConfigured, askGemini } from "@/lib/gemini";
import { ACME_IDENTITY, buildLiveContext, RAO_NGOAI_CHAT_CEO } from "@/lib/acme-brain";
import { getLeadConfig } from "@/lib/leads";
import { APP_URL } from "@/lib/app-url";
import { isSalePosition } from "@/lib/auth";
import { giaiMaNoiSale } from "@/lib/noi-sale-tg";
import { publishToPage, commentOnPost } from "@/lib/fb-publish";
import { runFactory, pushDraftsToCEO, contentImagePublicUrl, contentImageExists, LINK_COMMENT } from "@/lib/content-factory";
import { quyenDuyetBai, idBaiTuNut, loiDanVietLai, TRANG_NOVA } from "@/lib/content-duyet";
import { recordFail } from "@/lib/campaign-memory";
import { markSlots } from "@/lib/campaign-calendar";
import { vnDateStr } from "@/lib/payroll";
import { findBanned, sanitizeContent } from "@/lib/banned-words";
import { getConfigValue } from "@/lib/app-config";
import { luuTinNhomDonHang, docKhoTinDonHang } from "@/lib/donhang-ingest";
import { activatePlay, PLAYS, LEVERS } from "@/lib/profit-playbook";
import { hocTuTinNhom } from "@/lib/sale-tg";
import { cheChoChat, catKhoiTaiSan, GIOI_HAN_LUOT_BOT, CAU_VUOT_LUOT, quyenBatLaiCampaign } from "@/lib/bot-an-toan";
import { tachCsv } from "@/lib/brain-quyen";
import { vuotLuotNguoi } from "@/lib/chan-spam";

function sendTelegram(text: string, chatIdOverride?: string, laLLM = false) {
  const dich = chatIdOverride || process.env.TELEGRAM_CHAT_ID;
  return guiBaoCaoGoc(cheChoChat(dich, process.env.TELEGRAM_CHAT_ID, text, laLLM), chatIdOverride);
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const token = () => (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const hhmm = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(11, 16);

async function loadMap(sb: any): Promise<Record<string, string>> {
  try {
    const { data } = await sb.from("config").select("value").eq("key", "sale_tg_chat").maybeSingle();
    return JSON.parse(data?.value || "{}");
  } catch { return {}; }
}

const findUserByTg = (map: Record<string, string>, tgId: string) =>
  Object.keys(map).find((uid) => String(map[uid]) === String(tgId)) || null;

const bo_dau = (s: string) =>
  String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d")
    .toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

async function doanSaleTheoTen(sb: any, tgName: string): Promise<{ id: string; full_name: string } | null> {
  const ten = bo_dau(tgName);
  if (ten.length < 2) return null;
  const { data: users } = await sb.from("users").select("id, full_name, position, active").eq("active", true);
  const ds = (users || []).filter((u: any) => isSalePosition(u.position));
  const khop = ds.filter((u: any) => {
    const full = bo_dau(u.full_name);
    if (!full) return false;
    if (full === ten) return true;

    const tuFull = new Set(full.split(" "));
    const tuTg = ten.split(" ").filter(Boolean);
    return tuTg.length > 0 && tuTg.every((t) => tuFull.has(t));
  });
  return khop.length === 1 ? { id: khop[0].id, full_name: khop[0].full_name } : null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  if (url.searchParams.get("whoami") === "go" || url.searchParams.get("check") === "go") {
    const tok = ((await getConfigValue("ads_report_token").catch(() => "")) || "").trim();
    const prov = (req.headers.get("x-report-token") || url.searchParams.get("token") || "").trim();
    if (!tok || prov !== tok) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (url.searchParams.get("donhang") === "go") {
    const tok = ((await getConfigValue("ads_report_token").catch(() => "")) || "").trim();
    const prov = (req.headers.get("x-report-token") || url.searchParams.get("token") || "").trim();
    if (!tok || prov !== tok) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    const kho = await docKhoTinDonHang(getServiceClient());
    const n = Math.min(Number(url.searchParams.get("n") || 10), 100);
    return NextResponse.json({ ok: true, tong: kho.length, moiNhat: kho.slice(-n) });
  }

  if (url.searchParams.get("whoami") === "go") {
    const dsBot: Array<[string, string]> = [
      ["Bot Báo Cáo (báo cáo bán hàng, ping đơn mới, nút duyệt bài)", process.env.TELEGRAM_BOT_TOKEN || ""],
      ["Bot Sale (nhắc chăm sóc riêng từng sale)", process.env.TELEGRAM_SALE_BOT_TOKEN || ""],
    ];
    const nhomDon = String((await getConfigValue("tg_donhang_chat").catch(() => "")) || "");
    let donId = "";
    try { donId = String(JSON.parse(nhomDon)?.id || ""); } catch { }
    const out: any[] = [];
    for (const [vai, tok] of dsBot) {
      if (!tok) { out.push({ vai, daDat: false }); continue; }
      const me: any = await fetch(`https://api.telegram.org/bot${tok}/getMe`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
      const b = me?.result || {};
      let trongNhomDon: string | boolean = "chưa kiểm (thiếu id nhóm)";
      if (donId) {
        const mem: any = await fetch(`https://api.telegram.org/bot${tok}/getChatMember?chat_id=${donId}&user_id=${b.id}`, { cache: "no-store" })
          .then((r) => r.json()).catch(() => ({}));
        trongNhomDon = mem?.ok ? String(mem.result?.status || "?") : `KHÔNG (${mem?.description || "lỗi"})`;
      }
      out.push({
        vai, daDat: true, ten: b.first_name || "", username: b.username ? "@" + b.username : "(không có)",
        docDuocTinNhom: b.can_read_all_group_messages === true, trongNhomDon,
      });
    }
    return NextResponse.json({ ok: true, nhomDonHang: nhomDon || "(chưa lưu)", bots: out });
  }

  if (url.searchParams.get("check") === "go") {
    const raw = (process.env.TELEGRAM_SALES_CHAT_ID || "").trim();
    const ceo = (process.env.TELEGRAM_CHAT_ID || "").trim();
    return NextResponse.json({
      ok: true,
      nhomSale: raw
        ? { daDat: true, laNhom: raw.startsWith("-"), soChuSo: raw.length, duoi4: raw.slice(-4) }
        : { daDat: false, canhBao: "CHƯA đặt -> tin lead vẫn bắn vào chat riêng CEO" },
      chatCEO: { daDat: !!ceo, duoi4: ceo.slice(-4) },
      ketLuan: !raw ? "Chưa đặt mã nhóm."
        : !raw.startsWith("-") ? "SAI: thiếu dấu trừ -> đây là chat CÁ NHÂN, không phải nhóm."
        : raw === ceo ? "SAI: mã nhóm đang trùng chat riêng CEO."
        : "Đúng dạng nhóm.",
    });
  }

  if (url.searchParams.get("ping")) {
    const sb = getServiceClient();
    const want = (await sb.from("config").select("value").eq("key", "sale_ping_token").maybeSingle()).data?.value || "";
    if (!want || url.searchParams.get("ping") !== want) return NextResponse.json({ ok: false, error: "sai mật khẩu" }, { status: 403 });
    const chatId = (process.env.TELEGRAM_SALES_CHAT_ID || "").trim();
    if (!chatId) return NextResponse.json({ ok: false, error: "TELEGRAM_SALES_CHAT_ID chưa đặt" });
    const r = await sendTelegram("\u{2713} <b>Thử đường dây</b> — nếu cả nhóm đọc được tin này thì tin lead từ giờ sẽ về đây, không còn bắn vào máy riêng CEO nữa.", chatId);
    await sb.from("config").upsert({ key: "sale_ping_token", value: "" }, { onConflict: "key" });
    return NextResponse.json({ ok: r.ok, telegram: r });
  }

  if (url.searchParams.get("digest")) {
    const sb = getServiceClient();
    const want = (await sb.from("config").select("value").eq("key", "sale_ping_token").maybeSingle()).data?.value || "";
    if (!want || url.searchParams.get("digest") !== want) return NextResponse.json({ ok: false, error: "sai mật khẩu" }, { status: 403 });
    const chatId = (process.env.TELEGRAM_SALES_CHAT_ID || "").trim();
    if (!chatId) return NextResponse.json({ ok: false, error: "TELEGRAM_SALES_CHAT_ID chưa đặt" });

    const { data: users } = await sb.from("users").select("id, full_name");
    const nameOf: Record<string, string> = {};
    for (const u of users || []) nameOf[u.id] = u.full_name || "";

    const { data: hot } = await sb.from("leads")
      .select("id, customer_name, assignee_id, note, pancake_link, created_at")
      .eq("status", "new").order("created_at", { ascending: false }).limit(300);

    const blPer: Record<string, number> = {};
    for (const u of users || []) {
      const { count } = await sb.from("leads").select("id", { count: "exact", head: true })
        .eq("status", "backlog").eq("assignee_id", u.id);
      if (count) blPer[u.id] = count;
    }

    const per: Record<string, any[]> = {};
    for (const l of hot || []) if (l.assignee_id) (per[l.assignee_id] ||= []).push(l);

    const sent: any[] = [];
    for (const [uid, list] of Object.entries(per).sort((a, b) => b[1].length - a[1].length)) {
      const lines = [`<b>${tgEscape(nameOf[uid] || "?")}</b> — ${list.length} khách đang chờ`, ""];
      for (const l of list.slice(0, 40)) {
        const nm = tgEscape((l.customer_name || "(không tên)").slice(0, 30));
        lines.push(l.pancake_link ? `• <a href="${l.pancake_link}">${nm}</a> — <i>${tgEscape((l.note || "").slice(0, 45))}</i>`
                                  : `• ${nm} — <i>${tgEscape((l.note || "").slice(0, 45))}</i>`);
      }
      if (list.length > 40) lines.push(`… và ${list.length - 40} khách nữa`);

      lines.push("", `Xem danh sách đầy đủ ở ${APP_URL}/leads`);

      const r = url.searchParams.get("dry") ? { ok: true } as any : await sendTelegram(lines.join("\n"), chatId);
      sent.push({ sale: nameOf[uid], khach: list.length, khachCu: blPer[uid] || 0, ok: r.ok, loi: r.ok ? undefined : JSON.stringify(r).slice(0, 160) });
    }
    await sb.from("config").upsert({ key: "sale_ping_token", value: "" }, { onConflict: "key" });
    return NextResponse.json({ ok: true, daGui: sent });
  }

  if (url.searchParams.get("setup") !== "go") {
    return NextResponse.json({ ok: true, hint: "Cài webhook: thêm ?setup=go&token=<ads_report_token>" });
  }
  {
    const tok = ((await getConfigValue("ads_report_token").catch(() => "")) || "").trim();
    const prov = (req.headers.get("x-report-token") || url.searchParams.get("token") || "").trim();
    if (!tok || prov !== tok) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const t = token();
  if (!t) return NextResponse.json({ ok: false, error: "Chưa có TELEGRAM_BOT_TOKEN trên Vercel" });

  let secret = ((await getConfigValue("sale_webhook_secret").catch(() => "")) || "").trim();
  if (!secret) secret = (process.env.TELEGRAM_SALE_WEBHOOK_SECRET || "").trim();
  if (!secret) {
    secret = crypto.randomUUID().replace(/-/g, "");
    await getServiceClient().from("config").upsert({ key: "sale_webhook_secret", value: secret }, { onConflict: "key" });
  }
  const res = await fetch(`https://api.telegram.org/bot${t}/setWebhook`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: `${APP_URL}/api/telegram/sale`,
      allowed_updates: ["message", "callback_query"],
      ...(secret ? { secret_token: secret } : {}),
    }),
  });
  return NextResponse.json({ ok: true, telegram: await res.json().catch(() => ({})) });
}

export async function POST(req: Request) {

  const secret = (((await getConfigValue("sale_webhook_secret").catch(() => "")) || "") || (process.env.TELEGRAM_SALE_WEBHOOK_SECRET || "")).trim();
  if (!secret || req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const upd: any = await req.json().catch(() => ({}));
  const sb = getServiceClient();

  const cq = upd.callback_query;

  const adCmd = ["adpause:", "adup:", "addown:"].find((p) => cq?.data?.startsWith(p));
  if (adCmd) {
    const ceo = (process.env.TELEGRAM_CHAT_ID || "").trim();
    if (!ceo || String(cq.message?.chat?.id || "") !== ceo) {
      await answerCallback(cq.id, "Chi CEO duoc dieu khien ngan sach quang cao.", true);
      return NextResponse.json({ ok: true, denied: true });
    }
    const id = cq.data.split(":")[1];
    const old = cq.message?.text || cq.message?.caption || "";
    const { setCampaignStatus, adjustCampaignBudget } = await import("@/lib/ads-control");
    let note = "", cbShort = "";
    if (adCmd === "adpause:") {
      const r = await setCampaignStatus(id, "PAUSED");
      if (r.ok) { note = `\u{23F8} <b>ĐÃ NGỪNG</b> chiến dịch lúc ${hhmm()}`; cbShort = "Da ngung chien dich."; }
      else { note = `\u{26A0} Ngừng KHÔNG được: ${tgEscape(r.error || "")}`; cbShort = `Loi: ${(r.error || "").slice(0, 120)}`; }
    } else {
      const pct = adCmd === "adup:" ? 20 : -20;
      const r = await adjustCampaignBudget(id, pct);
      if (r.ok) { note = `\u{2705} <b>Ngân sách ${pct > 0 ? "+" : ""}${pct}%</b>: ${r.oldBudget?.toLocaleString("vi-VN")}đ → <b>${r.newBudget?.toLocaleString("vi-VN")}đ/ngày</b> (${hhmm()})`; cbShort = `Ngan sach moi: ${r.newBudget?.toLocaleString("vi-VN")}d/ngay`; }
      else { note = `\u{26A0} Đổi ngân sách KHÔNG được: ${tgEscape(r.error || "")}`; cbShort = `Loi: ${(r.error || "").slice(0, 120)}`; }
    }
    await answerCallback(cq.id, cbShort, !note.startsWith("\u{2705}") && !note.startsWith("\u{23F8}"));
    if (cq.message?.message_id) await editTelegramMessage(cq.message.chat.id, cq.message.message_id, `${old}\n\n${note}`);
    return NextResponse.json({ ok: true, adAction: adCmd, id });
  }

  if (cq?.data?.startsWith("maylai:")) {
    const ceo = (process.env.TELEGRAM_CHAT_ID || "").trim();
    if (!ceo || String(cq.message?.chat?.id || "") !== ceo) {
      await answerCallback(cq.id, "Chi CEO duoc chay lai may nen.", true);
      return NextResponse.json({ ok: true, denied: true });
    }
    const key = cq.data.slice(7);
    await answerCallback(cq.id, "Dang chay lai, cho chut...");
    const { chayLaiMay } = await import("@/lib/may-chay-ngam");
    const kq = await chayLaiMay(key, "CEO (Telegram)");
    const old = cq.message?.text || cq.message?.caption || "";
    const dau = kq.canNguoi ? "\u{26A0}" : kq.ok === false ? "\u{26A0}" : "\u{2705}";
    const them = `${dau} ${tgEscape(kq.thongBao)}${kq.lenh ? `\n${tgEscape(kq.lenh)}` : ""}`;
    if (cq.message?.message_id) await editTelegramMessage(cq.message.chat.id, cq.message.message_id, `${old}\n\n${them}`);
    return NextResponse.json({ ok: true, mayLai: key, chay: kq.chay });
  }

  const isDone = cq?.data?.startsWith("cdone:");
  if (isDone) {
    const ceo = (process.env.TELEGRAM_CHAT_ID || "").trim();
    const contentGroup = (process.env.TELEGRAM_CONTENT_CHAT_ID || "").trim();
    const adsGroup = String((await sb.from("config").select("value").eq("key", "ads_chat_id").maybeSingle()).data?.value || "").trim();
    const noiDung = String((await sb.from("config").select("value").eq("key", "content_tg_chat").maybeSingle()).data?.value || "").trim();
    const fromChat = String(cq.message?.chat?.id || "");
    if (!((!!ceo && fromChat === ceo) || (!!contentGroup && fromChat === contentGroup) || (!!adsGroup && fromChat === adsGroup) || (!!noiDung && fromChat === noiDung))) {
      await answerCallback(cq.id, "Chi danh dau trong nhom Noi dung/Ads hoac chat CEO.", true);
      return NextResponse.json({ ok: true, denied: true });
    }
    const id = cq.data.split(":")[1];
    const old = cq.message?.text || cq.message?.caption || "";
    const { data: item } = await sb.from("content_items").select("id,title,content_brief,status").eq("id", id).maybeSingle();
    if (!item) { await answerCallback(cq.id, "Khong thay bai nay."); return NextResponse.json({ ok: true }); }
    const who = [cq.from?.first_name, cq.from?.last_name].filter(Boolean).join(" ") || cq.from?.username || "nhân viên";

    const bad = findBanned(String(item.content_brief || ""));
    await sb.from("content_items").update({
      status: "published", publish_date: new Date().toISOString(),
      notes: `Nhân viên tự đăng (${who}) qua Telegram ${hhmm()}${bad.length ? ` — AI CẢNH BÁO từ cấm: ${bad.join(", ")}` : " — AI kiểm: sạch"}`,
    }).eq("id", id);
    if (bad.length) await recordFail(item.title, `đăng tay nhưng còn từ cấm: ${bad.join(", ")}`);

    try {
      const { ghiLuotDang } = await import("@/lib/content-posted");
      const nhom = fromChat === noiDung || fromChat === contentGroup ? "noi-dung" : fromChat === adsGroup ? "ads" : "ceo";
      await ghiLuotDang(id, { name: who, at: new Date().toISOString(), nhom, title: item.title, channel: "Facebook" });
    } catch {  }

    await markSlots(vnDateStr(), "published", 1).catch(() => 0);
    await answerCallback(cq.id, bad.length ? `Da ghi. LUU Y: bai con tu cam (${bad.join(", ")}) - nen sua/go!` : "Da ghi 'da dang du 3 page'. AI kiem: sach.", bad.length > 0);

    const tag = bad.length
      ? `\u{26A0} <b>ĐÃ ĐĂNG (tay, đủ 3 page)</b> lúc ${hhmm()} · ${tgEscape(who)} — <b>AI cảnh báo từ cấm: ${tgEscape(bad.join(", "))}</b>`
      : `\u{2705} <b>ĐÃ ĐĂNG (tay, đủ 3 page)</b> lúc ${hhmm()} · ${tgEscape(who)} — AI kiểm: sạch`;
    if (cq.message?.message_id) {
      await editTelegramMessage(cq.message.chat.id, cq.message.message_id, `${old}\n\n${tag}`);
    }

    try {
      const pv = (await sb.from("config").select("value").eq("key", "ads_creative_pending").maybeSingle()).data?.value;
      const map = pv ? JSON.parse(pv) : {};
      const link = map?.[String(id)];

      const nguoiDang = tachCsv((await sb.from("config").select("value").eq("key", "ads_nguoi_dang").maybeSingle()).data?.value);
      const q = quyenBatLaiCampaign(cq.from?.id, process.env.TELEGRAM_CHAT_ID, nguoiDang);
      if (link?.campaignId && q.canhBao) console.warn("[telegram/sale] ads_nguoi_dang rỗng — nút Đã đăng bật lại campaign theo hành vi cũ (chưa kiểm người bấm)");
      if (link?.campaignId && !q.cho) {
        if (cq.message?.message_id) await editTelegramMessage(cq.message.chat.id, cq.message.message_id, `${old}\n\n${tag}\n\nCampaign "${tgEscape(link.campaignName || "")}" CHƯA bật lại: chỉ CEO hoặc người đăng ads được giao mới bật được.`);
      } else if (link?.campaignId) {
        const { setCampaignStatus } = await import("@/lib/ads-control");
        const rr = await setCampaignStatus(link.campaignId, "ACTIVE");
        delete map[String(id)];
        await sb.from("config").upsert({ key: "ads_creative_pending", value: JSON.stringify(map) }, { onConflict: "key" });
        const note = rr?.ok
          ? `\u{1F916} Bài mới cho "${tgEscape(link.campaignName || "")}" đã đăng → đã BẬT LẠI campaign, autopilot sẽ tối ưu ngân sách theo hiệu quả.`
          : `\u{1F916} Bài mới cho "${tgEscape(link.campaignName || "")}" đã đăng — bật lại campaign lỗi (${tgEscape(rr?.error || "")}), anh bật tay giúp em.`;
        if (cq.message?.message_id) await editTelegramMessage(cq.message.chat.id, cq.message.message_id, `${old}\n\n${tag}\n\n${note}`);
      }
    } catch {  }
    return NextResponse.json({ ok: true, posted: id, banned: bad });
  }

  const isPub = cq?.data?.startsWith("cpub:");
  const isDrop = cq?.data?.startsWith("cdrop:");
  const isSua = cq?.data?.startsWith("csua:");
  if (isPub || isDrop || isSua) {
    const dsDuyet = (await sb.from("config").select("value").eq("key", "content_nguoi_duyet").maybeSingle()).data?.value;
    if (!quyenDuyetBai(cq.from?.id, process.env.TELEGRAM_CHAT_ID, dsDuyet)) {
      await answerCallback(cq.id, "Chi CEO va nguoi duoc giao duyet moi bam duoc.", true);
      return NextResponse.json({ ok: true, denied: true });
    }
    const id = cq.data.split(":")[1];
    const laAnh = !!cq.message?.photo;
    const old = cq.message?.text || cq.message?.caption || "";
    const ghiDau = async (them: string, nut?: Array<Array<{ text: string; callback_data: string }>>) => {
      if (!cq.message?.message_id) return;
      if (laAnh) await editTelegramCaption(cq.message.chat.id, cq.message.message_id, `${tgEscape(old)}\n\n${them}`, nut);
      else await editTelegramMessage(cq.message.chat.id, cq.message.message_id, `${old}\n\n${them}`);
    };
    const who = tgEscape([cq.from?.first_name, cq.from?.last_name].filter(Boolean).join(" ") || cq.from?.username || "");
    const { data: item } = await sb.from("content_items").select("id,title,content_brief,published_url,status").eq("id", id).maybeSingle();
    if (!item) { await answerCallback(cq.id, "Khong thay bai nay."); return NextResponse.json({ ok: true }); }

    if (isSua) {
      if (item.published_url) { await answerCallback(cq.id, "Bai nay dang roi.", true); return NextResponse.json({ ok: true, already: true }); }
      await answerCallback(cq.id, "Tra loi (reply) tin co nut nay kem gop y, may se viet lai.", true);
      return NextResponse.json({ ok: true, sua: id });
    }

    if (isDrop) {
      await sb.from("content_items").update({ status: "archived", notes: `Bỏ qua Telegram ${hhmm()}` }).eq("id", id);
      await recordFail(item.title, "người duyệt bỏ khi xem trên Telegram");
      await answerCallback(cq.id, "Da bo bai nay.");
      await ghiDau(`<b>Đã bỏ</b> — ${hhmm()}${who ? ` · ${who}` : ""}`, []);
      return NextResponse.json({ ok: true, dropped: id });
    }

    if (item.published_url) { await answerCallback(cq.id, "Bai nay dang roi.", true); return NextResponse.json({ ok: true, already: true }); }
    if (item.status === "archived") { await answerCallback(cq.id, "Bai nay da bo/da thay bang ban sua.", true); return NextResponse.json({ ok: true, archived: true }); }

    const imgUrl = (await contentImageExists(id)) ? contentImagePublicUrl(id) : undefined;
    const r = await publishToPage(String(item.content_brief || "").trim(), imgUrl, TRANG_NOVA);
    if (!r.ok) {

      if (r.banned?.length) await recordFail(item.title, `chặn khi đăng — dính từ cấm: ${r.banned.join(", ")}`);
      await answerCallback(cq.id, `Chua dang duoc: ${(r.error || "").slice(0, 150)}`, true);
      return NextResponse.json({ ok: true, publish_failed: true, error: r.error });
    }
    await sb.from("content_items").update({
      status: "published", published_url: r.url, publish_date: new Date().toISOString(),
      notes: `Máy đăng sau khi ${who || "người duyệt"} bấm Duyệt qua Telegram ${hhmm()}`,
    }).eq("id", id);
    await markSlots(vnDateStr(), "published", 1).catch(() => 0);

    const cm = r.postId ? await commentOnPost(r.postId, LINK_COMMENT, TRANG_NOVA) : { ok: false, error: "không có mã bài" };
    await answerCallback(cq.id, "Da dang len fanpage!");
    await ghiDau(`<b>ĐÃ ĐĂNG</b> lúc ${hhmm()}${who ? ` · duyệt: ${who}` : ""} — <a href="${r.url}">xem bài</a>${cm.ok ? "" : `\nChưa thả được bình luận link quiz (${tgEscape(cm.error || "")}) — thả tay giúp em.`}`, []);
    return NextResponse.json({ ok: true, published: id, url: r.url, comment: cm.ok });
  }

  if (cq?.data?.startsWith("pp:")) {
    const ceo = (process.env.TELEGRAM_CHAT_ID || "").trim();
    const fromChat = String(cq.message?.chat?.id || "");
    if (!ceo || fromChat !== ceo) {
      await answerCallback(cq.id, "Chi CEO duoc giao viec tu playbook.", true);
      return NextResponse.json({ ok: true, denied: true });
    }
    const playId = cq.data.split(":")[1];
    const play = PLAYS.find(p => p.id === playId);
    if (!play) { await answerCallback(cq.id, "Khong thay nuoc di nay."); return NextResponse.json({ ok: true }); }

    const active = await activatePlay(playId);

    const { data: boss } = await sb.from("users").select("id").in("role", ["ceo", "admin"]).order("role").limit(1).maybeSingle();
    let taskErr = "";
    if (boss?.id) {
      const { error } = await sb.from("tasks").insert({
        title: `[Playbook ${play.id}] ${play.ten}`,
        description: `${play.viec}\n\nĐo bằng: ${play.kpi} (${play.kpiDir === "up" ? "tăng" : "giảm"} là thắng) sau ${play.doSauNgay} ngày.` +
          (active?.baseline != null ? `\nSố nền lúc giao: ${Math.round(active.baseline)}.` : "") +
          `\n— Nguồn: Profit Playbook (${LEVERS[play.lever]})`,
        assigner_id: boss.id, assignee_id: boss.id, priority: "high",
        tags: ["profit-playbook", play.lever.toLowerCase()], status: "todo",
      });
      if (error) taskErr = error.message;
    } else taskErr = "không tìm thấy tài khoản điều hành";

    await answerCallback(cq.id, taskErr ? `Ghi baseline OK, tao task loi: ${taskErr.slice(0, 120)}` : "Da giao viec + chot so nen de do.", !!taskErr);
    if (cq.message?.message_id) {
      const old = cq.message?.text || "";
      await editTelegramMessage(cq.message.chat.id, cq.message.message_id,
        `${old}\n\n<b>ĐÃ GIAO:</b> [${play.id}] ${tgEscape(play.ten)} — đo lại sau ${play.doSauNgay} ngày${taskErr ? ` (task lỗi: ${tgEscape(taskErr.slice(0, 80))})` : ", đã vào Kanban /tasks"}.`);
    }
    return NextResponse.json({ ok: true, assigned: playId, taskErr: taskErr || undefined });
  }

  const isClaim = cq?.data?.startsWith("claim:");
  const isTouch = cq?.data?.startsWith("touched:");
  if (isClaim || isTouch) {
    const leadId = cq.data.split(":")[1];
    const tgId = String(cq.from?.id || "");
    const tgName = (cq.from?.first_name || "") + (cq.from?.last_name ? " " + cq.from.last_name : "");
    const map = await loadMap(sb);
    let userId = findUserByTg(map, tgId);

    let vuaTuNoi = "";
    if (!userId) {
      const doan = await doanSaleTheoTen(sb, tgName);
      if (doan) {
        userId = doan.id;
        vuaTuNoi = doan.full_name;
        map[userId] = tgId;
        await sb.from("config").upsert({ key: "sale_tg_chat", value: JSON.stringify(map) }, { onConflict: "key" });
      }
    }

    if (!userId) {
      await answerCallback(cq.id,
        `He thong chua nhan ra ban. Doi ten hien thi Telegram thanh dung ten that (vd: "Le Thi Cuc") roi bam lai, hoac bao admin.`, true);
      return NextResponse.json({ ok: true, need_link: true, tgName });
    }

    const { data: lead } = await sb.from("leads")
      .select("id, customer_name, assignee_id, first_contact_at").eq("id", leadId).maybeSingle();
    if (!lead) { await answerCallback(cq.id, "Khong tim thay lead nay."); return NextResponse.json({ ok: true }); }

    const { data: users } = await sb.from("users").select("id, full_name");
    const nameOf = (id: string | null) => (users || []).find((u: any) => u.id === id)?.full_name || "ai đó";

    if (lead.first_contact_at && lead.assignee_id && lead.assignee_id !== userId) {
      await answerCallback(cq.id, `Khach nay ${nameOf(lead.assignee_id)} da cham roi nhe.`, true);
      return NextResponse.json({ ok: true, already: true });
    }

    const me = nameOf(userId) || tgName || "sale";
    const now = new Date().toISOString();
    const old = cq.message?.text || "";

    if (isTouch) {
      await sb.from("leads").update({
        assignee_id: userId, first_contact_at: lead.first_contact_at || now, status: "contacted",
      }).eq("id", leadId);
      await answerCallback(cq.id, `Da ghi nhan ${me} cham khach ${lead.customer_name || ""}. Khach nay la cua ban.`);
      if (cq.message?.message_id) {
        await editTelegramMessage(cq.message.chat.id, cq.message.message_id,
          `${old}\n\n✅ <b>${me} đã nhắn khách</b> — ${hhmm()}`);
      }
      return NextResponse.json({ ok: true, touched_by: me });
    }

    await sb.from("leads").update({ assignee_id: userId, assigned_at: now }).eq("id", leadId);
    const mins = (await getLeadConfig()).reassignMinutes;
    await answerCallback(cq.id,
      `Ban da nhan ${lead.customer_name || "khach"}. Nhan tin cho khach xong nho bam "Da nhan tin cho khach" — qua ${mins} phut khong bam la he thong day sang sale khac.`, true);

    if (cq.message?.message_id) {
      await editTelegramMessage(cq.message.chat.id, cq.message.message_id,
        `${old}\n\n👤 <b>${me}</b> nhận lúc ${hhmm()} — <i>chưa nhắn khách, còn ${mins} phút</i>`);
    }
    return NextResponse.json({ ok: true, claimed_by: me });
  }

  const msg = upd.message;

  await luuTinNhomDonHang(sb, msg);

  const text = (msg?.text || msg?.caption || "").trim();
  if (!text) return NextResponse.json({ ok: true });

  const idSua = msg?.reply_to_message ? idBaiTuNut(msg.reply_to_message.reply_markup) : null;
  if (idSua && !text.startsWith("/")) {
    const dsDuyet = (await sb.from("config").select("value").eq("key", "content_nguoi_duyet").maybeSingle()).data?.value;
    if (!quyenDuyetBai(msg.from?.id, process.env.TELEGRAM_CHAT_ID, dsDuyet)) return NextResponse.json({ ok: true, denied: true });
    const chat = String(msg.chat.id);
    const { data: item } = await sb.from("content_items").select("id,title,content_brief,published_url,status,tags").eq("id", idSua).maybeSingle();
    if (!item || item.published_url || item.status === "archived") {
      await sendTelegram("Bai nay da dang hoac da bo, khong sua duoc nua.", chat);
      return NextResponse.json({ ok: true, khongSua: true });
    }
    const r = await askGemini("Bạn viết bài fanpage cho NOVA, chỉ trả JSON.", [], loiDanVietLai(item.title, String(item.content_brief || ""), text), { json: true, temperature: 0.6, maxOutputTokens: 4000, thinkingBudget: 0 });
    let moi: { title?: string; body?: string } = {};
    try { moi = JSON.parse(String(r.text || "{}")); } catch {  }
    const body = sanitizeContent(String(moi.body || "")).trim();
    if (!r.ok || !body) {
      await sendTelegram("May viet lai chua duoc, anh thu tra loi lai gop y giup em.", chat);
      return NextResponse.json({ ok: false, error: r.ok ? "rỗng" : (r as any).error }, { status: 500 });
    }
    const title = sanitizeContent(String(moi.title || item.title)).trim() || item.title;
    await sb.from("content_items").update({
      title, content_brief: body,
      notes: `Máy viết lại theo góp ý ${hhmm()}: ${text.slice(0, 200)}`,
    }).eq("id", idSua);
    const imgUrl = (await contentImageExists(idSua)) ? contentImagePublicUrl(idSua) : undefined;
    const pillar = (Array.isArray(item.tags) ? item.tags : []).find((t: string) => t && t !== "AI" && !/^(TOFU|MOFU|BOFU)$/.test(t)) || "";

    const rm = msg.reply_to_message;
    if (rm?.photo) await editTelegramCaption(rm.chat.id, rm.message_id, `${tgEscape(rm.caption || "")}\n\nĐã sửa theo góp ý — xem bản mới bên dưới.`, []);
    else if (rm?.message_id) await editTelegramMessage(rm.chat.id, rm.message_id, `${tgEscape(rm.text || "")}\n\nĐã sửa theo góp ý — xem bản mới bên dưới.`);
    await pushDraftsToCEO([{ id: idSua, title, pillar, content_brief: body, flagged: findBanned(body).length > 0, imageUrl: imgUrl }]);
    return NextResponse.json({ ok: true, suaXong: idSua });
  }

  if (/^\/id\b/i.test(text)) {
    const kind = msg.chat?.type === "private" ? "chat rieng" : `nhom "${msg.chat?.title || ""}"`;
    await sendTelegram(
      `Ma chat cua ${kind}:\n<code>${msg.chat.id}</code>\n\n` +
      (msg.chat?.type === "private"
        ? "Day la chat rieng. Muon tin lead vao NHOM SALE thi: tao nhom -> them bot nay vao -> go /id trong nhom do."
        : `Dan ma nay vao Vercel: TELEGRAM_SALES_CHAT_ID = ${msg.chat.id}\nTu do tin lead se vao nhom nay thay vi chat rieng cua CEO.`),
      String(msg.chat.id));
    return NextResponse.json({ ok: true, chat_id: msg.chat.id, type: msg.chat?.type });
  }

  if (/^\/ketoan\b/i.test(text) || /^\/accounting\b/i.test(text)) {
    const ceoId = (process.env.TELEGRAM_CHAT_ID || "").trim();
    if (ceoId && String(msg.from?.id || "") !== ceoId) {
      await sendTelegram("Chi CEO moi dang ky duoc nhom ke toan.", String(msg.chat.id));
      return NextResponse.json({ ok: true, denied: true });
    }
    await sb.from("config").upsert({ key: "accounting_tg_chat", value: String(msg.chat.id) }, { onConflict: "key" });
    const kind = msg.chat?.type === "private" ? "chat rieng nay" : `nhom "${msg.chat?.title || ""}"`;
    await sendTelegram(
      `Da dang ky ${kind} nhan thong bao xuat hoa don VAT.\n` +
      `Tu gio don quiz nao khach can VAT, he thong bao thang vao day de ke toan xuat.\n` +
      `(Go /ketoan o nhom khac de doi; muon tat thi bao em.)`,
      String(msg.chat.id));
    return NextResponse.json({ ok: true, accounting_chat: msg.chat.id });
  }

  if (/^\/nhomads\b/i.test(text) || /^\/ads-?nhom\b/i.test(text)) {
    const ceoId = (process.env.TELEGRAM_CHAT_ID || "").trim();
    if (ceoId && String(msg.from?.id || "") !== ceoId) {
      await sendTelegram("Chi CEO moi dang ky duoc nhom ads.", String(msg.chat.id));
      return NextResponse.json({ ok: true, denied: true });
    }
    await sb.from("config").upsert({ key: "ads_chat_id", value: String(msg.chat.id) }, { onConflict: "key" });
    const kind = msg.chat?.type === "private" ? "chat rieng nay" : `nhom "${msg.chat?.title || ""}"`;
    await sendTelegram(
      `Da dang ky ${kind} la NHOM QUAN LY ADS.\n` +
      `Tu gio ve day: chi phi Meta + Google hang ngay, canh bao CPL vuot tran, de xuat autopilot, va bai creative moi cho campaign CTR yeu (tag Ha dang tay).\n` +
      `Nut Ngung/Scale doi tien van CHI o chat rieng CEO cho an toan.`,
      String(msg.chat.id));
    return NextResponse.json({ ok: true, ads_chat: msg.chat.id });
  }

  if (/^\/content\b/i.test(text) || /^\/nhomcontent\b/i.test(text)) {
    const ceoId = (process.env.TELEGRAM_CHAT_ID || "").trim();
    if (ceoId && String(msg.from?.id || "") !== ceoId) {
      await sendTelegram("Chi CEO moi dang ky duoc nhom content.", String(msg.chat.id));
      return NextResponse.json({ ok: true, denied: true });
    }
    await sb.from("config").upsert({ key: "content_tg_chat", value: String(msg.chat.id) }, { onConflict: "key" });
    const kind = msg.chat?.type === "private" ? "chat rieng nay" : `nhom "${msg.chat?.title || ""}"`;
    await sendTelegram(
      `Da dang ky ${kind} nhan BAI + BINH LUAN MOI hang ngay.\n` +
      `Nhan vien: copy bai -> dang len fanpage (KHONG de link trong bai) -> tha binh luan CO LINK lam comment DAU -> roi cac binh luan moi -> bam "Da dang".\n` +
      `(Go /content o nhom khac de doi.)`,
      String(msg.chat.id));
    return NextResponse.json({ ok: true, content_chat: msg.chat.id });
  }

  if (/^\/start/.test(text)) {

    const mCu = text.match(/^\/start\s+([0-9a-f-]{36})\b/i);
    if (mCu) {
      await sendTelegram("Link nay da cu. Ban vao lai trang Phan loai khach (khach-360) tren IKIHEALING Hub, bam 'Bat nhac qua Telegram' de lay link moi nhe.", String(msg.chat.id));
      return NextResponse.json({ ok: true, linked: false, ly_do: "link_cu" });
    }
    const mMa = text.match(/^\/start\s+(\S+)/);
    const uid = mMa ? giaiMaNoiSale(mMa[1]) : null;
    const m = uid ? [mMa![0], uid] : null;
    if (m) {
      const map = await loadMap(sb);
      if (map[m[1]] && map[m[1]] !== String(msg.chat.id)) {
        await sendTelegram("Tai khoan nay da noi voi mot Telegram khac. Nho quan ly go lien ket cu truoc nhe.", String(msg.chat.id));
        return NextResponse.json({ ok: true, linked: false, ly_do: "da_noi_cho_khac" });
      }
      map[m[1]] = String(msg.chat.id);
      await sb.from("config").upsert({ key: "sale_tg_chat", value: JSON.stringify(map) }, { onConflict: "key" });
      await sendTelegram('Da noi tai khoan xong. Tu gio ban bam duoc nut "Toi nhan khach nay" o tin bao lead nhe.', String(msg.chat.id));
      return NextResponse.json({ ok: true, linked: true });
    }

    let pending: Record<string, string> = {};
    try { pending = JSON.parse((await sb.from("config").select("value").eq("key", "sale_tg_pending").maybeSingle()).data?.value || "{}"); } catch { }
    const who = `${msg.from?.first_name || ""} ${msg.from?.last_name || ""}`.trim() || String(msg.chat.id);
    pending[String(msg.chat.id)] = who;
    await sb.from("config").upsert({ key: "sale_tg_pending", value: JSON.stringify(pending) }, { onConflict: "key" });
    await sendTelegram(
      `Chao ${who}. De noi dung tai khoan, ban vao ${APP_URL}/khach-360 va bam nut "Ket noi Telegram" nhe.`,
      String(msg.chat.id));
    return NextResponse.json({ ok: true, pending: true });
  }

  {
    const ceoChatEarly = (process.env.TELEGRAM_CHAT_ID || "").trim();
    if (msg.chat?.type === "private" && String(msg.chat.id) === ceoChatEarly && /\btao bai\b/.test(bo_dau(text))) {
      await sendTelegram("Dang viet bai, cho em chut...", ceoChatEarly);
      const rf = await runFactory(2);
      if (!rf.ok) {
        await sendTelegram(`Chua tao duoc bai: ${(rf.error || "").slice(0, 150)}`, ceoChatEarly);
        return NextResponse.json({ ok: false, error: rf.error });
      }
      const pushed = await pushDraftsToCEO(rf.items);
      if (!pushed) await sendTelegram(`Da tao ${rf.saved} bai nhap (o /content) nhung chua ban nut ra day duoc.`, ceoChatEarly);
      return NextResponse.json({ ok: true, saved: rf.saved, pushed });
    }
  }

  if (msg.chat?.type !== "private") {
    const hoc = await hocTuTinNhom(sb, msg.from);
    return NextResponse.json({ ok: true, skipped: "group", hocMaTelegram: hoc.hoc ? hoc.ai : false });
  }

  const chatId = String(msg.chat.id);
  const ceoChat = (process.env.TELEGRAM_CHAT_ID || "").trim();
  const map = await loadMap(sb);
  const known = chatId === ceoChat || Object.values(map).some((v) => String(v) === chatId);
  if (!known) {
    await sendTelegram(`Chao ban. De em nhan ra ban, vao ${APP_URL}/khach-360 bam "Ket noi Telegram" nhe.`, chatId);
    return NextResponse.json({ ok: true, unknown: true });
  }

  if (!geminiConfigured()) {
    await sendTelegram("Bo nao chua duoc cam khoa (GEMINI_API_KEY_BRAIN) nen em chua tra loi duoc a.", chatId);
    return NextResponse.json({ ok: false, error: "no_gemini" });
  }

  const laCeoChat = !!ceoChat && chatId === ceoChat;
  if (!laCeoChat && await vuotLuotNguoi("bot-sale", String(msg.from?.id || chatId), GIOI_HAN_LUOT_BOT)) {
    await sendTelegram(CAU_VUOT_LUOT, chatId);
    return NextResponse.json({ ok: true, skip: "vuot_luot" });
  }
  try {

    const liveTho = await buildLiveContext();
    const live = laCeoChat ? liveTho : catKhoiTaiSan(liveTho);
    const sys = `${ACME_IDENTITY}\n\n${live}\n\nBạn đang trả lời trong bot BÁO CÁO trên Telegram.
CHỈ trả lời câu hỏi bằng SỐ THẬT ở trên. Ngắn gọn, 2-5 dòng, không markdown (Telegram không hiện **).
Bạn KHÔNG làm được việc gì thay đổi dữ liệu ở đây — nếu CEO muốn GIAO VIỆC / GỬI / DEPLOY,
nói anh nhắn bot "Trợ lý ACME" vì bên đó mới có cổng xác nhận.` + (laCeoChat ? "" : RAO_NGOAI_CHAT_CEO);
    const ans = await askGemini(sys, [], text, { maxOutputTokens: 1500 });
    await sendTelegram(
      ans.ok && ans.text ? tgEscape(ans.text).slice(0, 3500) : "Em hoi khung chut, anh hoi lai giup em nhe.",
      chatId, true);
    return NextResponse.json({ ok: ans.ok });
  } catch (e: any) {
    await sendTelegram("Em gap loi khi tra loi. Anh thu lai giup em nhe.", chatId);
    return NextResponse.json({ ok: false, error: String(e?.message || e) });
  }
}
