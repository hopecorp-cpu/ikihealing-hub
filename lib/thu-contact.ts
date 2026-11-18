import { ImapFlow } from "imapflow";
// @ts-ignore -- mailparser không kèm khai báo kiểu
import { simpleParser } from "mailparser";
import { getServiceClient } from "@/lib/supabase-server";
import { sendTelegramMay, tgEscape } from "@/lib/telegram";

const KHOA = "thu_contact_status";
const TRAN_MOI_LUOT = 15;
const WEBMAIL = "https://mail.example.com:2096/";

type TrangThai = {
  at?: string; ok?: boolean; error?: string; loiAt?: string; loiLienTiep?: number;
  uidValidity?: string; lastUid?: number; daBao?: number; boQuaRac?: number;
};

async function docTrangThai(): Promise<TrangThai> {
  const v = (await getServiceClient().from("config").select("value").eq("key", KHOA).maybeSingle()).data?.value;
  try { return v ? JSON.parse(v) : {}; } catch { return {}; }
}
async function ghiTrangThai(t: TrangThai) {
  await getServiceClient().from("config").upsert(
    { key: KHOA, value: JSON.stringify(t), description: "Máy báo thư contact@example.com về Telegram: mốc UID đã báo + nhịp tim (at) + lỗi gần nhất" },
    { onConflict: "key" },
  );
}

function tomTat(s: string, n: number) {
  const t = (s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}

export async function quetThuContact(): Promise<{ ok: boolean; error?: string; moi?: number; bao?: number; rac?: number; lanDau?: boolean }> {
  const pass = (process.env.CONTACT_MAIL_PASS || "").trim();
  const user = (process.env.CONTACT_MAIL_USER || "contact@example.com").trim();
  const host = (process.env.CONTACT_MAIL_HOST || "mail.example.com").trim();
  if (!pass) return { ok: false, error: "chua_cau_hinh: thiếu CONTACT_MAIL_PASS trên Vercel" };

  const tt = await docTrangThai();
  const client = new ImapFlow({ host, port: 993, secure: true, auth: { user, pass }, logger: false, socketTimeout: 30000 });
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const mb: any = client.mailbox;
      const uidValidity = String(mb.uidValidity);
      const uidNext = Number(mb.uidNext);

      if (!tt.uidValidity || tt.uidValidity !== uidValidity || typeof tt.lastUid !== "number") {
        await sendTelegramMay("thu-contact",
          `📬 <b>Đã nối hộp thư ${tgEscape(user)}</b>\nHộp đang có ${mb.exists} thư. Từ giờ có thư mới em báo về đây trong vòng ~5 phút.`);
        await ghiTrangThai({ ...tt, at: new Date().toISOString(), ok: true, error: undefined, loiLienTiep: 0, uidValidity, lastUid: uidNext - 1, daBao: tt.daBao || 0, boQuaRac: tt.boQuaRac || 0 });
        return { ok: true, lanDau: true, moi: 0, bao: 0, rac: 0 };
      }

      const uids = ((await client.search({ uid: `${tt.lastUid + 1}:*` }, { uid: true })) || [])
        .filter((u: number) => u > (tt.lastUid as number)).sort((a: number, b: number) => a - b);
      const lam = uids.slice(0, TRAN_MOI_LUOT);
      let lastUid = tt.lastUid, bao = 0, rac = 0, loiGui: string | undefined;

      for (const uid of lam) {
        const m: any = await client.fetchOne(String(uid), { uid: true, source: { start: 0, maxLength: 200_000 } }, { uid: true });
        const p: any = m?.source ? await simpleParser(m.source).catch(() => null) : null;
        const coRac = /^yes/i.test(String(p?.headers?.get("x-spam-flag") || "")) || /^\*{3}SPAM\*{3}/.test(p?.subject || "");
        if (coRac) { rac++; lastUid = uid; continue; }

        const tu = p?.from?.value?.[0];
        const tenTu = [tu?.name, tu?.address ? `<${tu.address}>` : ""].filter(Boolean).join(" ") || "(không rõ người gửi)";
        const dinhKem = (p?.attachments || []).filter((a: any) => a.contentDisposition !== "inline").length;
        const noiDung = tomTat(p?.text || (p?.html ? String(p.html).replace(/<[^>]+>/g, " ") : ""), 400);
        const text = [
          `📩 <b>Thư mới vào contact@</b>`,
          `<b>Từ:</b> ${tgEscape(tenTu)}`,
          `<b>Tiêu đề:</b> ${tgEscape(p?.subject || "(không tiêu đề)")}`,
          dinhKem ? `<b>Đính kèm:</b> ${dinhKem} tệp` : "",
          noiDung ? `\n${tgEscape(noiDung)}` : "",
          `\n<a href="${WEBMAIL}">Mở webmail</a> · hoặc mở hộp contact@ trong app mail trên điện thoại`,
        ].filter(Boolean).join("\n");

        const r: any = await sendTelegramMay("thu-contact", text);
        if (r?.ok === false) { loiGui = `gửi Telegram hỏng: ${r.error || r.status || "?"}`; break; }
        bao++; lastUid = uid;
      }

      if (!loiGui && uids.length > lam.length) {
        await sendTelegramMay("thu-contact", `📬 Còn ${uids.length - lam.length} thư mới nữa ở contact@, em báo tiếp ở lượt sau.`);
      }

      await ghiTrangThai({
        ...tt, uidValidity, lastUid,
        daBao: (tt.daBao || 0) + bao, boQuaRac: (tt.boQuaRac || 0) + rac,
        ...(loiGui
          ? { ok: false, error: loiGui, loiAt: new Date().toISOString(), loiLienTiep: (tt.loiLienTiep || 0) + 1 }
          : { at: new Date().toISOString(), ok: true, error: undefined, loiLienTiep: 0 }),
      });
      return loiGui ? { ok: false, error: loiGui, moi: uids.length, bao, rac } : { ok: true, moi: uids.length, bao, rac };
    } finally {
      lock.release();
    }
  } catch (e: any) {
    const error = String(e?.responseText || e?.message || e).slice(0, 300);
    const loiLienTiep = (tt.loiLienTiep || 0) + 1;
    await ghiTrangThai({ ...tt, ok: false, error, loiAt: new Date().toISOString(), loiLienTiep });

    if (loiLienTiep === 1) {
      await sendTelegramMay("thu-contact", `⚠️ <b>Máy đọc hộp contact@ đang hỏng</b> — ${tgEscape(error)}\nThư vẫn nằm an toàn trên máy chủ AZDigi, sửa xong máy tự báo bù.`).catch(() => {});
    }
    return { ok: false, error };
  } finally {
    await client.logout().catch(() => {});
  }
}
