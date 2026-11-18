import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { sendTelegram, sendTelegramMay, tgEscape } from "@/lib/telegram";
import { gmailLink, type EmailRec } from "@/lib/gmail";
import { appLink } from "@/lib/app-url";
import { vnDateStr } from "@/lib/payroll";
import { chanMay, khoaCron } from "@/lib/kiem-cron";
import { ACCOUNTANT_EMAILS } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ACCOUNTANTS = ACCOUNTANT_EMAILS;
const MARK = "🧾 Kế toán";
const SENT_KEY = "gmail_finance_tg_sent";
const URG: Record<string, string> = { high: "🔴", normal: "🟡", low: "⚪" };

const BUCKETS: { key: string; label: string; match: (e: EmailRec) => boolean }[] = [
  { key: "cod", label: "💰 TIỀN VỀ — Đối soát COD J&T", match: e => /jtexpress\.vn/i.test(e.fromEmail) && /đối soát|doi soat|cod/i.test(e.subject + e.fromEmail) },
  { key: "bank", label: "🏦 NGÂN HÀNG / SỔ PHỤ", match: e => /techcombank|mbbank|vietcombank|vietinbank|bidv|sophu@/i.test(e.fromEmail) },
  { key: "invoice_in", label: "🧾 HOÁ ĐƠN GTGT ĐẦU VÀO (NCC gửi)", match: e => /meinvoice\.vn|mysoftware\.vn|ehoadon\.vn|misa\.vn|einvoice/i.test(e.fromEmail) },
  { key: "service", label: "🖊 CHỮ KÝ SỐ / DỊCH VỤ SẮP HẠN", match: e => /kysovn|dichvucks|chukyso|giahan@/i.test(e.fromEmail) || /gia hạn|sắp hết hạn/i.test(e.subject) },
  { key: "tools", label: "💳 TIỀN RA — Công cụ & quảng cáo", match: e => /withorb|anthropic|google\.com|facebook\.com|vercel|openai|stripe|paypal/i.test(e.fromEmail) },
];
const bucketOf = (e: EmailRec) => BUCKETS.find(b => b.match(e))?.key || "other";

const line = (e: EmailRec) =>
  `${URG[e.urgency] || "🟡"} <a href="${gmailLink(e.threadId)}">${tgEscape((e.subject || "(không tiêu đề)").slice(0, 78))}</a>\n` +
  `      <i>${tgEscape(e.fromEmail)}</i>`;

const money = (n: number) => Math.round(n || 0).toLocaleString("vi-VN") + "đ";
const dmy = (iso?: string | null) => (iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : "?");

function codBlock(sts: any[], today: string) {
  if (!sts.length) return "";
  const mo = today.slice(0, 7);
  const thisMonth = sts.filter(s => (s.statementDate || "").slice(0, 7) === mo);
  const sumNet = thisMonth.reduce((a, s) => a + (s.net || 0), 0);
  const sumCod = thisMonth.reduce((a, s) => a + (s.cod || 0), 0);
  const sumFee = thisMonth.reduce((a, s) => a + (s.feeCod + s.ship + s.returnFee + s.partFee || 0), 0);
  const due = sts.filter(s => s.payDate && s.payDate >= today);
  const last = sts[0];
  return `\n<b>💰 TIỀN VỀ — Đối soát COD J&T</b>\n`
    + `Bảng kê mới nhất (kỳ ${dmy(last.periodFrom)}–${dmy(last.periodTo)}): COD <b>${money(last.cod)}</b> − phí ${money(last.feeCod + last.ship + last.returnFee + last.partFee)}${last.prevDebt ? ` + dư nợ kỳ cũ ${money(last.prevDebt)}` : ""} → <b>THỰC NHẬN ${money(last.net)}</b>\n`
    + `J&T hẹn chuyển <b>${dmy(last.payDate)}</b> vào MB ${last.bankAccount || "0000000000"}\n`
    + (due.length ? `⏳ Đang chờ về: ${due.length} bảng kê · <b>${money(due.reduce((a, s) => a + s.net, 0))}</b>\n` : "")
    + `Tháng ${mo.slice(5)}: ${thisMonth.length} bảng kê · COD ${money(sumCod)} · phí J&T ${money(sumFee)} · <b>thực nhận ${money(sumNet)}</b>`;
}

function bankBlock(st: any) {
  if (!st) return `\n<b>🏦 TIỀN TRONG KÉT</b>\n⚠️ Chưa có dữ liệu sổ phụ — vòng lặp ngân hàng chưa chạy lần nào.`;
  const head = `\n<b>🏦 TIỀN TRONG KÉT</b>\nSố dư: <b>${money(st.closing)}</b> (MB ${money(st.banks?.mb || 0)} + TCB ${money(st.banks?.tcb || 0)}) · số liệu tới <b>${dmy(st.dataTo)}</b>`;
  const warn: string[] = [];
  if (!st.ok) warn.push(`❌ Vòng lặp sổ phụ HỎNG: ${(st.ran || []).filter((r: any) => !r.ok).map((r: any) => r.file).join(", ")} — số đang ĐỨNG YÊN, không tự cập nhật.`);

  if ((st.staleDays ?? 0) > 40) warn.push(`⚠️ Số liệu đã cũ <b>${st.staleDays} ngày</b> — nghi sổ phụ tháng mới không về, cần kiểm tra.`);
  const at = st.at ? new Date(st.at).getTime() : 0;
  if (at && Date.now() - at > 36 * 3600e3) warn.push(`⚠️ Vòng lặp không chạy đã <b>${Math.floor((Date.now() - at) / 3600e3)} giờ</b> — máy tắt hoặc launchd chết.`);
  if ((st.fresh || []).length) warn.push(`🆕 ${st.fresh.join(" · ")}`);
  return head + (warn.length ? "\n" + warn.join("\n") : "");
}

function bossReport(pending: EmailRec[], fresh: EmailRec[], cod: string, bank: string) {
  const parts: string[] = [
    `🧾 <b>EMAIL TIỀN — BÁO CÁO</b>`,
    `Đang chờ xử lý: <b>${pending.length}</b> · mới từ lần trước: <b>${fresh.length}</b>`,
  ];
  if (bank) parts.push(bank);
  if (cod) parts.push(cod);
  for (const b of [...BUCKETS, { key: "other", label: "📌 KHÁC", match: () => true }]) {
    if (b.key === "cod" && cod) continue;
    const list = pending.filter(e => bucketOf(e) === b.key);
    if (!list.length) continue;
    const hot = list.filter(e => e.urgency === "high").length;
    parts.push(`\n<b>${b.label}</b> — ${list.length}${hot ? ` · ${hot} gấp 🔴` : ""}\n` + list.slice(0, 5).map(line).join("\n") + (list.length > 5 ? `\n      … ${list.length - 5} email nữa` : ""));
  }
  parts.push(`\n👉 <a href="${appLink("/email")}">Phân công tại /email</a>`);
  return parts.join("\n");
}

function acctList(fresh: EmailRec[], pendingCount: number) {
  return `🧾 <b>EMAIL TIỀN / HOÁ ĐƠN / ĐỐI SOÁT</b>\n${fresh.length} email mới · tổng đang chờ: ${pendingCount}\n\n`
    + fresh.slice(0, 12).map(line).join("\n\n")
    + (fresh.length > 12 ? `\n\n… và ${fresh.length - 12} email nữa.` : "")
    + `\n\n👉 <a href="${appLink("/email")}">Xem tại /email</a>`;
}

export async function GET(req: Request) {
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;

  const sb = getServiceClient();
  let emails: EmailRec[] = [];
  try { emails = JSON.parse((await getConfigValue("gmail_emails")) || "[]"); } catch { }
  const pending = emails.filter(e => e.category === "finance" && e.needsAction && e.status !== "done");

  const { data: users } = await sb.from("users").select("id, email").eq("active", true);
  const idByEmail: Record<string, string> = {};
  for (const u of users ?? []) if (u.email) idByEmail[u.email.toLowerCase().trim()] = u.id;

  let bells = 0;
  const missing: string[] = [];
  for (const acct of ACCOUNTANTS) {
    const uid = idByEmail[acct];
    if (!uid) { missing.push(acct); continue; }
    await sb.from("notifications").delete().eq("user_id", uid).eq("read", false).ilike("title", `${MARK}%`);
    if (!pending.length) continue;
    const { error } = await sb.from("notifications").insert({
      user_id: uid, type: "system", read: false, action_url: "/email",
      title: `${MARK}: ${pending.length} email tiền/hoá đơn cần xử lý`,
      content: pending.slice(0, 5).map(e => "• " + (e.subject || "").slice(0, 60)).join("\n"),
    });
    if (!error) bells++;
  }

  let sentIds: string[] = [];
  try { sentIds = JSON.parse((await getConfigValue(SENT_KEY)) || "[]"); } catch { }
  const seen = new Set(sentIds);
  const fresh = pending.filter(e => !seen.has(e.id));

  const groupId = (process.env.TELEGRAM_FINANCE_CHAT_ID || "").trim();
  const out: any = { boss: "bỏ qua — không có email mới", group: groupId ? "bỏ qua — không có email mới" : "chưa đặt TELEGRAM_FINANCE_CHAT_ID" };

  let statements: any[] = [];
  try { statements = JSON.parse((await getConfigValue("jt_cod_statements")) || "[]"); } catch { }
  const codText = codBlock(statements, vnDateStr());

  const bankStatus = await (async () => { try { return JSON.parse((await getConfigValue("bank_loop_status")) || "null"); } catch { return null; } })();
  const bankText = bankBlock(bankStatus);
  const staleAt = bankStatus?.at ? Date.now() - new Date(bankStatus.at).getTime() : Infinity;
  const bankBroken = !bankStatus || !bankStatus.ok || (bankStatus.staleDays ?? 0) > 40 || staleAt > 36 * 3600e3;
  const today = vnDateStr();
  const alertKey = `bank_alert_${bankBroken ? "broken" : "ok"}_${today}`;
  const alreadyAlerted = (await getConfigValue("bank_alert_sent")) === alertKey;

  if (fresh.length) {
    const boss = await sendTelegramMay("tai-chinh", bossReport(pending, fresh, codText, bankText));
    out.boss = boss.ok ? "đã gửi báo cáo cho TGĐ" : boss;
    if (groupId) {
      const g = await sendTelegram(acctList(fresh, pending.length), groupId);
      out.group = g.ok ? "đã gửi nhóm kế toán" : g;
    }
    if (boss.ok) await setConfigValue(SENT_KEY, JSON.stringify([...fresh.map(e => e.id), ...sentIds].slice(0, 400)), "Email finance đã bắn Telegram");
    if (bankBroken) await setConfigValue("bank_alert_sent", alertKey, "Đã cảnh báo vòng lặp ngân hàng");
  } else if (bankBroken && !alreadyAlerted) {
    const a = await sendTelegramMay("tai-chinh", `🏦 <b>DÒNG TIỀN — CẢNH BÁO</b>\n${bankText}\n\n👉 <a href="${appLink("/tai-chinh")}">Xem tại /tai-chinh</a>`);
    out.bankAlert = a.ok ? "đã cảnh báo vòng lặp ngân hàng hỏng" : a;
    if (a.ok) await setConfigValue("bank_alert_sent", alertKey, "Đã cảnh báo vòng lặp ngân hàng");
  } else {
    out.bankAlert = bankBroken ? "đã cảnh báo hôm nay rồi" : "vòng lặp ngân hàng khoẻ";
  }

  return NextResponse.json({ ok: true, pending: pending.length, fresh: fresh.length, bells, missingAccountants: missing, bank: { ok: !bankBroken, dataTo: bankStatus?.dataTo ?? null, staleDays: bankStatus?.staleDays ?? null }, telegram: out });
}
