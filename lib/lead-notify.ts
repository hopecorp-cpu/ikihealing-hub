import "server-only";
import { pushToUsers } from "@/lib/push";
import { sendTelegram, sendTelegramWithButtons, telegramConfigured, tgEscape } from "@/lib/telegram";
import { zaloChatLink } from "@/lib/zalo";

export type LeadNotifyInput = {

  id?: string | null;
  customer_name?: string | null;
  phone?: string | null;
  source?: string | null;
  channel?: string | null;

  pancake_link?: string | null;

  pancake_thread_link?: string | null;
  note?: string | null;
};

export async function notifyNewLead(
  sb: any,
  lead: LeadNotifyInput,
  assigneeId: string | null,
  kind: "new" | "reassign" | "co-so" = "new",
): Promise<void> {
  const name = (lead.customer_name || "").trim() || "Khách mới";
  const phone = (lead.phone || "").trim();
  const src = (lead.source || lead.channel || "Zalo").trim();
  const zlink = phone ? zaloChatLink(phone) : null;

  const convLink = (lead.pancake_link || "").trim() || null;
  const panLink = (lead.pancake_thread_link || "").trim() || null;

  const snippet = (lead.note || "").trim().replace(/\s*·\s*ĐC:\s*[^·]+/i, " · [địa chỉ: xem trong app]");
  const title = kind === "reassign" ? `Lead chuyển tới bạn: ${name}` : `Lead mới: ${name}`;
  const body = `${phone ? phone + " - " : ""}${src}. Gọi trong 5 phut de chot.`;

  try {
    if (assigneeId) {
      await sb.from("notifications").insert({
        user_id: assigneeId, type: "lead", title,
        content: body + (panLink ? ` Mo Pancake: ${panLink}` : "") + (convLink ? ` Business Suite: ${convLink}` : "") + (zlink ? ` Nhan Zalo: ${zlink}` : ""),
        action_url: "/leads", read: false,
      });
    }
  } catch {  }

  try {
    if (assigneeId) {
      await pushToUsers([assigneeId], { title, body, url: "/leads", tag: "acme-lead", important: true });
    }
  } catch {  }

  try {
    if (telegramConfigured()) {
      const chatId = (process.env.TELEGRAM_SALES_CHAT_ID || process.env.TELEGRAM_CHAT_ID || "").trim() || undefined;

      const who = convLink
        ? `<a href="${tgEscape(convLink)}">${tgEscape(name)}</a>`
        : `<b>${tgEscape(name)}</b>`;

      let giaoCho = "";
      if (assigneeId) {
        try {
          const { data } = await sb.from("users").select("full_name").eq("id", assigneeId).maybeSingle();
          giaoCho = (data?.full_name || "").trim();
        } catch {  }
      }
      const lines = [

        kind === "co-so" ? `\u{1F4DE} <b>KHACH DE SO — GOI NGAY</b>` : `\u{1F525} <b>LEAD NONG</b>${kind === "reassign" ? " (chuyen tiep)" : ""}`,
        giaoCho ? `<b>>> ${tgEscape(giaoCho)} chăm khách này</b>` : `<b>>> CHUA AI CHAM — ai ranh nhan giup</b>`,
        `Khach: ${who}`,
        phone ? `SDT: <b>${tgEscape(phone)}</b>` : "",
        `Nguon: ${tgEscape(src)}`,
        snippet ? `Vua nhan: <i>"${tgEscape(snippet.slice(0, 110))}"</i>` : "",
        ``,

        panLink ? `\u{1F7E2} Mo trong Pancake (dung hoi thoai, tot cho dien thoai):\n${tgEscape(panLink)}` : "",
        convLink ? `\u{1F4AC} Hoac mo hop thu Business Suite (khach moi nhat o tren cung):\n${tgEscape(convLink)}` : "",
        zlink ? `\u{1F4F2} Nhan Zalo: ${tgEscape(zlink)}` : "",
        `\u{23F1} Goi trong 5 phut de chot.`,
      ].filter(Boolean);

      if (lead.id) {

        await sendTelegramWithButtons(lines.join("\n"), [[
          { text: "Toi nhan khach nay", callback_data: `claim:${lead.id}` },
          { text: "Da nhan tin cho khach", callback_data: `touched:${lead.id}` },
        ]], chatId);
      } else {
        await sendTelegram(lines.join("\n"), chatId);
      }
    }
  } catch {  }
}
