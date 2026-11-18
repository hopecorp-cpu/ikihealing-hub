import { NextResponse } from "next/server";
import { appLink, APP_HOST } from "@/lib/app-url";
import { getServiceClient } from "@/lib/supabase-server";
import { sendTelegramMay, telegramConfigured, tgEscape, sendSaleTelegram, saleBotConfigured } from "@/lib/telegram";
import { pushToUsers } from "@/lib/push";
import { zaloChatLink } from "@/lib/zalo";
import { vnDateStr } from "@/lib/payroll";
import { getSaleByAccount } from "@/lib/sale-accounts";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";

const arr = (v: any) => (Array.isArray(v) ? v : []);

const hasPhone = (r: any) => !!(r.phone && String(r.phone).replace(/\D/g, "").length >= 9) || /0\d{8,10}/.test(r.customer_name || "");

const isSlip = (r: any) => hasPhone(r) && arr(r.tags).some((t: string) => /không ch[oố]t|follow[- ]?up/i.test(t));

const CLAIM_RE = new RegExp([
  "chữa\\s*(khỏi|được|bệnh|dứt)",
  "khỏi\\s*(bệnh|hẳn)",
  "(thải độc|thanh lọc)\\s*(gan|thận|đại tràng|máu|phổi|cơ thể)",
  "điều trị",
  "cam kết\\s*(khỏi|hết)",
  "(hỗ trợ|tốt cho)\\s*(điều trị|bệnh nhân|ung thư|tiểu đường|huyết áp)",
  "dùng\\s*(khỏi|hết bệnh)",
].join("|"), "i");
const isViolation = (r: any) =>
  arr(r.tags).some((t: string) => /^VI PH[ẠA]M/i.test(t)) ||
  CLAIM_RE.test([...arr(r.did_well), ...arr(r.suggestions)].join(" "));
const avg = (s: number, n: number) => (n ? Math.round((s / n) * 10) / 10 : 0);
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export async function GET(req: Request) {
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;
  if (!telegramConfigured()) return NextResponse.json({ ok: false, error: "Chưa cấu hình Telegram env" });

  const sb = getServiceClient();
  const today = vnDateStr();
  const SALE_BY_ACCOUNT = await getSaleByAccount();
  const saleOf = (r: any) => SALE_BY_ACCOUNT[r.account_id] || r.account_name || "?";
  const SEL = "account_id, account_name, customer_name, phone, score, weaknesses, missed, suggestions, did_well, tags, analyzed_at";

  let { data } = await sb.from("salework_chat_analysis").select(SEL).gte("analyzed_at", `${today}T00:00:00`).order("score", { ascending: true });
  let todayBatch = data || [];
  if (!todayBatch.length) {
    const { data: recent } = await sb.from("salework_chat_analysis").select(SEL).order("analyzed_at", { ascending: false }).limit(150);
    todayBatch = (recent || []).slice().sort((a: any, b: any) => (a.score || 0) - (b.score || 0));
  }
  if (!todayBatch.length) return NextResponse.json({ ok: false, error: "Chưa có dữ liệu chấm" });

  const { data: allRows } = await sb.from("salework_chat_analysis").select("account_id, account_name, customer_name, phone, score").limit(5000);
  const totalBy: Record<string, { n: number; real: number }> = {};
  for (const r of (allRows || []) as any[]) {
    const s = saleOf(r); (totalBy[s] ??= { n: 0, real: 0 }); totalBy[s].n++; if (hasPhone(r)) totalBy[s].real++;
  }

  const by: Record<string, { n: number; realN: number; realSum: number; quick: number; slip: number }> = {};
  for (const r of todayBatch as any[]) {
    const s = saleOf(r); (by[s] ??= { n: 0, realN: 0, realSum: 0, quick: 0, slip: 0 });
    by[s].n++;
    if (hasPhone(r)) { by[s].realN++; by[s].realSum += r.score || 0; if (isSlip(r)) by[s].slip++; } else by[s].quick++;
  }

  const saleLines = Object.entries(by).sort((a, b) => pct(b[1].slip, b[1].realN) - pct(a[1].slip, a[1].realN)).map(([s, v]) => {
    const tot = totalBy[s]?.n || v.n;
    return `• <b>${tgEscape(s)}</b> — để tuột <b>${pct(v.slip, v.realN)}%</b> (${v.slip}/${v.realN}) · điểm ${avg(v.realSum, v.realN)}/10\n   hôm nay ${v.n} cuộc (${v.quick} hỏi lướt) · lũy kế ${tot} cuộc`;
  });

  const realWorst = (todayBatch as any[]).filter(hasPhone).slice(0, 3).map((r) => {
    const tip = (arr(r.missed)[0] || arr(r.weaknesses)[0] || "").toString().slice(0, 90);
    return `• <b>${r.score || 0}/10</b> ${tgEscape(saleOf(r))} — ${tgEscape((r.customer_name || "?").slice(0, 24))}${tip ? `\n   ↳ ${tgEscape(tip)}` : ""}`;
  });

  const realAll = (todayBatch as any[]).filter(hasPhone);
  const avgReal = avg(realAll.reduce((s, r: any) => s + (r.score || 0), 0), realAll.length);
  const slipAll = (todayBatch as any[]).filter(isSlip).length;

  const viol = (todayBatch as any[]).filter(isViolation);
  const violBySale: Record<string, number> = {};
  for (const r of viol) violBySale[saleOf(r)] = (violBySale[saleOf(r)] || 0) + 1;

  const lines = [
    `\u{1F4CB} <b>CHẤT LƯỢNG TƯ VẤN</b> — ${today}`,
    `<i>1-1 (đã loại nhóm). "Tư vấn thật" = khách để lại SĐT.</i>`,
    ``,
    `\u{1F6A8} <b>Để tuột khách: ${pct(slipAll, realAll.length)}%</b> (${slipAll}/${realAll.length} cuộc thật — khách hỏi mà không chốt/không follow-up)`,
    `\u{2B50} Điểm tư vấn: <b>${avgReal}</b>/10 · bỏ ${todayBatch.length - realAll.length} cuộc hỏi lướt`,
    ``,
    `\u{1F464} <b>Theo người trực (để tuột nhiều → ít):</b>`,
    ...(saleLines.length ? saleLines : ["• (chưa có)"]),
  ];
  if (realWorst.length) lines.push(``, `\u{26A0}\u{FE0F} <b>Cuộc tư vấn thật cần rút KN:</b>`, ...realWorst);

  if (viol.length) {
    lines.unshift(
      `\u{1F6D1} <b>${viol.length} CUỘC CÓ DẤU HIỆU VI PHẠM LUẬT QUẢNG CÁO</b>`,
      ...Object.entries(violBySale).sort((a, b) => b[1] - a[1]).map(([n, c]) => `\u{2022} ${tgEscape(n)} — ${c} cuộc`),
      `<i>Claim chữa bệnh / tư vấn cho người có bệnh. Cần nhắc NGAY — phạt 30-60tr + nguy cơ mất quyền quảng cáo.</i>`,
      ``,
    );
  }
  lines.push(``, `<a href="${appLink("/chat-quality")}">Xem chi tiết</a>`);

  const r = await sendTelegramMay("doc-viec-sale", lines.join("\n"));

  let wordGuard = 0;
  try {
    const salesChat = (process.env.TELEGRAM_SALES_CHAT_ID || "").trim();
    if (salesChat) {
      const { getTeamWordGuard } = await import("@/lib/word-guardrail");
      const g = await getTeamWordGuard(7);
      if (g.lessons.length) {
        const wl = [
          `\u{1F4E2} <b>NHẮC CHUNG CẢ TEAM — ngôn từ cần tránh</b>`,
          `<i>7 ngày qua team chạm ${g.weekViol} cuộc dùng từ cấm. Thực phẩm bổ sung — 1 câu claim chữa bệnh = phạt 30-60tr + nguy cơ mất quyền quảng cáo. Cả nhà đọc để KHÔNG lặp lại.</i>`,
          ``,
          ...g.lessons.map((l) => `\u{274C} "${tgEscape(l.phrase)}" (${l.count} lần) \u{2192} \u{2705} nói "${tgEscape(l.safe)}"`),
          ``,
          `<a href="${appLink("/chat-quality")}">Xem bảng ngôn từ + gợi ý theo từng khách</a>`,
        ];
        wordGuard = (await sendTelegramMay("doc-viec-sale", wl.join("\n"))).ok ? g.lessons.length : 0;
      }
    }
  } catch { }

  const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").trim();
  const { data: users } = await sb.from("users").select("id, full_name").eq("active", true);
  const userOf = (person: string) => (users || []).find((x: any) => norm(x.full_name).includes(norm(person)) || norm(person).includes(norm(x.full_name)));

  const phoneOf = (r: any) => { const p = String(r.phone || "").replace(/\D/g, ""); if (p.length >= 9) return p; const m = String(r.customer_name || "").match(/0\d{8,10}/); return m ? m[0] : null; };
  const tipOf = (r: any) => (arr(r.suggestions)[0] || arr(r.missed)[0] || arr(r.weaknesses)[0] || "").toString();

  const actionBySale: Record<string, any[]> = {};
  for (const rr of todayBatch as any[]) {
    if (!(isViolation(rr) || (hasPhone(rr) && (rr.score || 0) <= 5))) continue;
    (actionBySale[saleOf(rr)] ??= []).push(rr);
  }

  let tgChat: Record<string, string> = {};
  try { tgChat = JSON.parse((await sb.from("config").select("value").eq("key", "sale_tg_chat").maybeSingle()).data?.value || "{}") || {}; } catch { }

  let nudged = 0;
  for (const [person, items] of Object.entries(actionBySale)) {
    const u = userOf(person); if (!u) continue;
    items.sort((a, b) => (isViolation(b) ? 1 : 0) - (isViolation(a) ? 1 : 0) || (a.score || 0) - (b.score || 0));
    const top = items.slice(0, 5);
    const nViol = items.filter(isViolation).length;

    try {
      await sb.from("notifications").insert({
        user_id: u.id, type: "chat_quality",
        title: nViol ? `\u{1F6D1} ${nViol} cuộc dấu hiệu vi phạm luật QC — sửa ngay` : `${top.length} khách cần điều chỉnh cách chăm`,
        content: top.map((rr) => `${isViolation(rr) ? "[VI PHẠM] " : ""}${(rr.customer_name || "?").slice(0, 24)}: ${tipOf(rr).slice(0, 90)}`).join(" | "),
        action_url: "/chat-quality", read: false,
      });
    } catch { }

    try { await pushToUsers([u.id], { title: nViol ? `${nViol} cuộc vi phạm luật QC — sửa ngay` : `${top.length} khách cần chỉnh cách chăm`, body: tipOf(top[0]).slice(0, 120), url: "/chat-quality", tag: "chatq", important: !!nViol }); } catch { }

    try {
      const chatId = tgChat[u.id] || tgChat[person];
      if (chatId && saleBotConfigured()) {
        const itemLines = top.map((rr) => {
          const z = (() => { const ph = phoneOf(rr); return ph ? zaloChatLink(ph) : null; })();
          return `${isViolation(rr) ? "\u{1F6D1} " : "\u{2022} "}<b>${tgEscape((rr.customer_name || "?").slice(0, 28))}</b> (${rr.score || 0}/10)\n   \u{21B3} ${tgEscape(tipOf(rr).slice(0, 140))}${z ? `\n   \u{1F4AC} Nhắn lại: ${tgEscape(z)}` : ""}`;
        });
        const head = nViol
          ? `\u{1F6D1} <b>${nViol} cuộc có dấu hiệu VI PHẠM luật quảng cáo</b> — sửa NGAY (phạt 30-60tr).`
          : `\u{1F4CB} <b>${top.length} khách cần điều chỉnh cách chăm hôm nay</b>`;
        await sendSaleTelegram(chatId, [head, ``, ...itemLines, ``, `Chi tiết: ${APP_HOST}/chat-quality`].join("\n"));
      }
    } catch { }
    nudged++;
  }

  return NextResponse.json({ ok: r.ok, todayN: todayBatch.length, realN: realAll.length, slipN: slipAll, slipPct: pct(slipAll, realAll.length), avgReal, people: Object.keys(by).length, nudged, coachedSales: Object.keys(actionBySale).length, wordGuard, telegram: r });
}
