import { NextResponse } from "next/server";
import { getServiceClient, getCurrentUser } from "@/lib/supabase-server";
import { insertAndAssign, sweepReassign, autoTouchByExternalId, getPancakeThreadLinks } from "@/lib/leads";
import { sendTelegram, telegramConfigured, tgEscape } from "@/lib/telegram";
import { khoaCron, xacThucMay } from "@/lib/kiem-cron";
import { notifyNewLead } from "@/lib/lead-notify";
import { timSdtVN } from "@/lib/zalo";
import { docMaNguon } from "@/lib/ma-nguon";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FRESH_MS = 90 * 60 * 1000;

const G = "https://graph.facebook.com/v21.0";

function fbInboxLink(pageId: string, _c?: any): string | null {
  if (!pageId) return null;
  return `https://business.facebook.com/latest/inbox/all/?asset_id=${pageId}&mailbox_id=${pageId}`;
}

export async function GET(req: Request) {

  if ((await xacThucMay(req, [khoaCron({ bearer: true })])) !== "ok") {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sb = getServiceClient();
  let fb = 0, fbSdt = 0, fbDedup = 0, zalo = 0, zaloDedup = 0, fbTouched = 0, fbReping = 0;

  let reping: Record<string, string> = {};
  try { reping = JSON.parse((await sb.from("config").select("value").eq("key", "lead_reping").maybeSingle()).data?.value || "{}") || {}; } catch { }

  const panMap = await getPancakeThreadLinks();

  let refPsid: Record<string, { ref: string }> = {};
  try { refPsid = JSON.parse((await sb.from("config").select("value").eq("key", "fb_ref_psid").maybeSingle()).data?.value || "{}") || {}; } catch { }
  const salesChat = (process.env.TELEGRAM_SALES_CHAT_ID || process.env.TELEGRAM_CHAT_ID || "").trim() || undefined;
  const errors: string[] = [];

  try {
    const token = (process.env.FB_ADS_TOKEN || process.env.FB_USER_TOKEN || "").trim();
    if (token) {
      const acc: any = await (await fetch(`${G}/me/accounts?fields=name,access_token&limit=10&access_token=${encodeURIComponent(token)}`, { cache: "no-store" })).json();
      for (const page of (acc.data || [])) {
        const pTok = page.access_token || token;
        const cutoff = Date.now() - 2 * 864e5;

        const convos: any[] = [];

        let url: string | null = `${G}/${page.id}/conversations?fields=senders,updated_time,link,snippet,messages.limit(5){from,message}&limit=100&access_token=${encodeURIComponent(pTok)}`;
        let hitOld = false, guard = 0;
        while (url && !hitOld && guard < 20) {
          const cj: any = await (await fetch(url, { cache: "no-store" })).json();
          if (cj.error) { errors.push(`FB ${page.name}: ${cj.error.message}`); break; }
          for (const c of (cj.data || [])) {
            if (c.updated_time && new Date(c.updated_time).getTime() < cutoff) { hitOld = true; break; }
            convos.push(c);
          }
          url = cj.paging?.next || null; guard++;
        }

        if (guard >= 20 && !hitOld) errors.push(`FB ${page.name}: quá 2.000 khách nóng, có thể còn sót`);

        for (const c of convos) {
          const sender = (c.senders?.data || []).find((s: any) => s.id !== page.id) || (c.senders?.data || [])[0];
          if (!sender) continue;

          const lastFrom = c.messages?.data?.[0]?.from?.id || null;
          const repliedByPage = lastFrom != null && String(lastFrom) === String(page.id);
          const fresh = !!c.updated_time && (Date.now() - new Date(c.updated_time).getTime()) <= FRESH_MS;

          const sdt = (c.messages?.data || []).filter((x: any) => String(x?.from?.id || "") !== String(page.id))
            .map((x: any) => timSdtVN(x?.message)).find(Boolean) || null;

          const maNguon = refPsid[String(sender.id || "")]?.ref
            || (c.messages?.data || []).filter((x: any) => String(x?.from?.id || "") !== String(page.id))
              .map((x: any) => docMaNguon(x?.message)).find(Boolean) || null;
          const r = await insertAndAssign(sb, {
            customer_name: sender.name || null, phone: sdt, source: `Fanpage ${page.name}`, channel: "facebook",

            pancake_link: fbInboxLink(page.id, c),
            external_id: `fb:${c.id}`, note: (c.snippet || "").slice(0, 120),
          }, { notify: fresh && !repliedByPage, maNguon });

          if (r.ok && repliedByPage) { const t = await autoTouchByExternalId(sb, `fb:${c.id}`); if (t) fbTouched++; }
          if (r.ok) { r.dedup ? fbDedup++ : fb++; } else errors.push(`FB insert: ${r.error}`);

          if (r.ok && sdt && r.id) {
            try {
              let baoCoSo = !r.dedup && repliedByPage;
              if (r.dedup) {
                const { data: L } = await sb.from("leads").select("phone").eq("id", r.id).maybeSingle();
                if (L && !L.phone) { await sb.from("leads").update({ phone: sdt }).eq("id", r.id); baoCoSo = true; }
              }
              if (!r.dedup || baoCoSo) fbSdt++;
              if (baoCoSo && fresh) {
                await notifyNewLead(sb, {
                  id: r.id, customer_name: sender.name || null, phone: sdt, source: `Fanpage ${page.name}`,
                  channel: "facebook", pancake_link: fbInboxLink(page.id, c), pancake_thread_link: panMap[`fb:${c.id}`] || null,
                  note: (c.snippet || "").slice(0, 120),
                }, r.assignee_id || null, "co-so");
              }
            } catch (e: any) { errors.push("FB bắt số: " + String(e?.message || e)); }
          }

          const key = `fb:${c.id}`;
          const lastFromCustomer = lastFrom != null && String(lastFrom) !== String(page.id);
          if (r.ok && r.dedup && lastFromCustomer && fresh && reping[key] !== c.updated_time) {
            try {
              const { data: L } = await sb.from("leads").select("status, first_contact_at").eq("external_id", key).maybeSingle();

              if (L && (L.status === "contacted" || L.status === "caring") && telegramConfigured()) {
                const nm = sender.name || "Khách";
                const link = fbInboxLink(page.id, c);
                const pan = panMap[key] || null;
                await sendTelegram(
                  `\u{1F4AC} <b>Khách QUAY LẠI nhắn</b> — <b>${tgEscape(nm)}</b>\nVừa nhắn: <i>"${tgEscape(String(c.snippet || "").slice(0, 110))}"</i>` +
                  `${pan ? `\n\u{1F7E2} Mở trong Pancake (đúng hội thoại):\n${tgEscape(pan)}` : ""}` +
                  `${link ? `\n\u{1F4E5} Hoặc mở hộp thư Business Suite (khách trên cùng):\n${tgEscape(link)}` : ""}`,
                  salesChat,
                );
                fbReping++;
              }
              reping[key] = c.updated_time;
            } catch { }
          }
        }
      }
    }
  } catch (e: any) { errors.push("FB: " + String(e)); }

  try {

    let daCham = new Set<string>(), dangCho = new Set<string>();
    try {
      const raw = JSON.parse((await sb.from("config").select("value").eq("key", "zalo_hoi_thoai").maybeSingle()).data?.value || "null");
      if (raw) {
        daCham = new Set((raw.daCham || []).map(String));
        dangCho = new Set((raw.choTraLoi || []).map((x: any) => String(x.phone || "")));
      }
    } catch { }

    const since = new Date(Date.now() - 2 * 864e5).toISOString();
    const { data: accs } = await sb.from("zalo_bridge_accounts").select("own_id, sale_name");
    const saleCuaNick = new Map((accs || []).map((a: any) => [String(a.own_id), a.sale_name || ""]));
    const { data: lhs } = await sb.from("zalo_bridge_contacts").select("own_id, zalo_uid, display_name, phone_norm, last_in_at")
      .eq("thread_type", "user").not("phone_norm", "is", null).gte("last_in_at", since).limit(300);
    const data = (lhs || [])
      .filter((c: any) => !saleCuaNick.has(String(c.zalo_uid)))
      .map((c: any) => ({
        conversation_id: `${c.own_id}_${c.zalo_uid}_0_0`,
        phone: "0" + String(c.phone_norm).replace(/^84/, ""),
        name: c.display_name, hotline: saleCuaNick.get(String(c.own_id)) || "", last_contact: c.last_in_at,
      }));
    for (const c of data) {
      const yenTam = daCham.has(String(c.conversation_id)) && !dangCho.has(String(c.phone));
      const fresh = !yenTam && !!c.last_contact && (Date.now() - new Date(c.last_contact).getTime()) <= FRESH_MS;
      const r = await insertAndAssign(sb, {
        customer_name: c.name || null, phone: c.phone, source: `Zalo ${c.hotline || ""}`.trim(), channel: "zalo",
        external_id: `zalo:${c.conversation_id}`,
      }, { notify: fresh });
      if (r.ok) { r.dedup ? zaloDedup++ : zalo++; } else errors.push(`Zalo insert: ${r.error}`);
    }
  } catch (e: any) { errors.push("Zalo: " + String(e)); }

  const reassigned = await sweepReassign(sb).catch(() => 0);

  try {
    const cutIso = new Date(Date.now() - 7 * 864e5).toISOString();
    const pruned: Record<string, string> = {};
    for (const [k, v] of Object.entries(reping)) if (String(v) > cutIso) pruned[k] = v as string;
    await sb.from("config").upsert({ key: "lead_reping", value: JSON.stringify(pruned) }, { onConflict: "key" });
  } catch { }

  return NextResponse.json({ ok: true, fb_new: fb, fb_bat_so: fbSdt, fb_dedup: fbDedup, fb_auto_touched: fbTouched, fb_reping: fbReping, zalo_new: zalo, zalo_dedup: zaloDedup, reassigned, errors: errors.slice(0, 5) });
}
