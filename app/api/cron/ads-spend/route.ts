import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { vnDateStr } from "@/lib/payroll";
import { buildAdsAdvice } from "@/lib/ads-advisor";
import { telegramConfigured, sendTelegramWithButtons, tgEscape } from "@/lib/telegram";
import { sendAdsReport } from "@/lib/ads-autopilot";
import { ghiViecMay } from "@/lib/viec-may";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";

const G = "https://graph.facebook.com/v21.0";

export async function GET(req: Request) {
  const t0 = Date.now();
  const chanKhoa = await chanMay(req, [khoaCron({ bearer: true })]);
  if (chanKhoa) return chanKhoa;

  const token = (process.env.FB_ADS_TOKEN || process.env.FB_USER_TOKEN || "").trim();
  let acct = (process.env.FB_AD_ACCOUNT || "000000000000000").trim();
  if (!/^act_/.test(acct)) acct = "act_" + acct.replace(/\D/g, "");
  if (!token) return NextResponse.json({ ok: false, error: "Chưa cắm FB_ADS_TOKEN" }, { status: 200 });

  const month = vnDateStr().slice(0, 7);
  const since = `${month}-01`;
  const until = vnDateStr();
  try {
    const tr = encodeURIComponent(JSON.stringify({ since, until }));
    const r = await fetch(`${G}/${acct}/insights?fields=spend&time_range=${tr}&access_token=${encodeURIComponent(token)}`, { cache: "no-store" });
    const j: any = await r.json();
    if (j.error) return NextResponse.json({ ok: false, error: j.error.message }, { status: 200 });
    const spend = Math.round(Number((j.data || [])[0]?.spend || 0));

    let campaigns: any[] = [];
    try {

      const flds = `id,name,effective_status,daily_budget,insights.date_preset(this_month){spend,ctr,cpm,actions}`;
      const cj: any = await (await fetch(`${G}/${acct}/campaigns?fields=${encodeURIComponent(flds)}&limit=300&access_token=${encodeURIComponent(token)}`, { cache: "no-store" })).json();
      campaigns = (cj.data || []).map((c: any) => {
        const ins = c.insights?.data?.[0] || {}; const sp = Math.round(Number(ins.spend || 0)); const A = ins.actions || [];
        const val = (re: RegExp) => Number((A.find((a: any) => re.test(a.action_type)) || {}).value || 0);
        const purch = val(/purchase/), lead = val(/lead/), msg = val(/messaging_conversation_started|onsite_conversion\.messaging/);
        const results = purch || lead || msg || 0; const rtype = purch ? "đơn" : lead ? "lead" : msg ? "tin nhắn" : "—";
        return { id: c.id, name: c.name, status: c.effective_status, dailyBudget: Math.round(Number(c.daily_budget || 0)), spend: sp, ctr: Math.round(Number(ins.ctr || 0) * 100) / 100, cpm: Math.round(Number(ins.cpm || 0)), results, rtype, cpo: results ? Math.round(sp / results) : 0 };
      }).filter((c: any) => c.spend > 0 || /ACTIVE/i.test(c.status)).sort((a: any, b: any) => b.spend - a.spend);
    } catch { }

    let ranked: any[] = [];
    let postsErr: string | null = null;
    const pageToken = (process.env.FB_USER_TOKEN || token).trim();
    try { ranked = await topPagePosts(pageToken); } catch (e: any) { postsErr = String(e?.message || e); }
    const posts = ranked.slice(0, 8);

    const flopCut = Date.now() - 3 * 864e5;
    const flops = ranked
      .filter((p: any) => new Date(p.created + "T00:00:00").getTime() <= flopCut)
      .slice(-5).reverse();

    const sb = getServiceClient();
    await sb.from("config").upsert({ key: `mkt_spend_${month}`, value: String(spend) }, { onConflict: "key" });
    await sb.from("config").upsert({ key: "ads_campaigns", value: JSON.stringify({ month, generatedAt: new Date().toISOString(), campaigns }) }, { onConflict: "key" });
    if (posts.length) await sb.from("config").upsert({ key: "mkt_top_posts", value: JSON.stringify({ month, generatedAt: new Date().toISOString(), posts }) }, { onConflict: "key" });

    const ganDay = ranked
      .filter((p: any) => new Date(p.created + "T00:00:00").getTime() <= Date.now() - 864e5)
      .sort((a: any, b: any) => String(b.created).localeCompare(String(a.created)))
      .slice(0, 12);
    if (ganDay.length) await sb.from("config").upsert({ key: "fb_bai_gan_day", value: JSON.stringify({ generatedAt: new Date().toISOString(), posts: ganDay }) }, { onConflict: "key" });
    if (flops.length >= 3) await sb.from("config").upsert({ key: "mkt_flop_posts", value: JSON.stringify({ month, generatedAt: new Date().toISOString(), posts: flops }) }, { onConflict: "key" });

    await sb.from("config").upsert({ key: "mkt_top_posts_status", value: JSON.stringify({ at: new Date().toISOString(), count: posts.length, flops: flops.length, err: postsErr }) }, { onConflict: "key" });

    try {
      const { addAgentLearning } = await import("@/lib/agent-learning");
      if (posts[0]) {
        const p: any = posts[0];
        await addAgentLearning("content", `Bài tương tác cao (${p.engaged}+${p.clicks} click): "${String(p.msg || "").slice(0, 70)}" — nhân hướng này`, "win");
      }
      const withCpo = campaigns.filter((c: any) => c.results > 0 && c.cpo > 0);
      if (withCpo.length) {
        const best = withCpo.reduce((a: any, b: any) => (a.cpo < b.cpo ? a : b));
        await addAgentLearning("performance", `CĐ "${best.name}" CPO thấp nhất ${best.cpo.toLocaleString("vi-VN")}đ/${best.rtype} — mẫu tốt để nhân`, "win");
        const worst = withCpo.reduce((a: any, b: any) => (a.cpo > b.cpo ? a : b));
        if (worst.name !== best.name) await addAgentLearning("performance", `CĐ "${worst.name}" CPO cao ${worst.cpo.toLocaleString("vi-VN")}đ/${worst.rtype} — soát lại/cắt`, "fail");
      }
    } catch { }

    let cplAlerts = 0;
    try {
      const CPL_CEILING = 150_000;
      const over = campaigns.filter((c: any) => c.rtype === "lead" && c.results >= 3 && c.cpo > CPL_CEILING);
      if (over.length) {
        const lines = over.slice(0, 5).map((c: any) =>
          `• <b>${tgEscape(c.name)}</b>: CPL <b>${c.cpo.toLocaleString("vi-VN")}đ</b> (${c.results} lead · chi ${c.spend.toLocaleString("vi-VN")}đ)`);
        const txt =
          `\u{1F514} <b>CPL VƯỢT TRẦN 150.000đ</b> — ${over.length} chiến dịch\n${lines.join("\n")}\n` +
          `<i>Đề xuất: giảm ngân sách hoặc ngừng để test lại mẫu quảng cáo (nút điều khiển ở tin bên dưới).</i>`;
        if (telegramConfigured()) await sendAdsReport(txt);
        cplAlerts = over.length;
      }
    } catch { }

    let advice = 0;
    try {
      const a = await buildAdsAdvice();
      if (a.ok && a.text) {
        if (telegramConfigured()) await sendAdsReport(a.text);
        advice = a.lines.length;
      }
    } catch { }

    try {
      const ceo = (process.env.TELEGRAM_CHAT_ID || "").trim();
      const actives = campaigns.filter((c: any) => c.id && /ACTIVE/i.test(c.status));
      if (ceo && actives.length) {
        for (const c of actives.slice(0, 8)) {
          const bud = c.dailyBudget ? `${c.dailyBudget.toLocaleString("vi-VN")}đ/ngày` : "ngân sách ở nhóm QC";
          const kq = c.results ? `${c.results} ${c.rtype} · CPO ${c.cpo.toLocaleString("vi-VN")}đ` : "chưa ra kết quả";
          const txt = `\u{1F4B0} <b>${tgEscape(c.name)}</b>\nChi ${c.spend.toLocaleString("vi-VN")}đ · ${bud} · ${kq}`;
          await sendTelegramWithButtons(txt, [[
            { text: "\u{23F8} Ngừng", callback_data: `adpause:${c.id}` },
            { text: "\u{2191} +20%", callback_data: `adup:${c.id}` },
            { text: "\u{2193} -20%", callback_data: `addown:${c.id}` },
          ]], ceo);
        }
      }
    } catch { }

    await ghiViecMay({
      agent: "ads-spend", agentTen: "Performance",
      viec: `Kéo chi tiêu Meta tháng ${month}`,
      trangThai: campaigns.length ? "xong" : "khong_co_gi",
      soLuong: advice, donVi: "đề xuất",
      chiTiet: `chi ${Math.round(spend).toLocaleString("vi-VN")}đ · ${campaigns.length} chiến dịch · ${cplAlerts} cảnh báo CPL`,
      link: "/do-luong-mkt", giay: (Date.now() - t0) / 1000,
    });
    return NextResponse.json({ ok: true, month, spend, campaigns: campaigns.length, posts: posts.length, flops: flops.length, advice, cpl_alerts: cplAlerts });
  } catch (e: any) {
    await ghiViecMay({
      agent: "ads-spend", agentTen: "Performance", viec: "Kéo chi tiêu Meta",
      trangThai: "hong", soLuong: 0, donVi: "đề xuất", chiTiet: String(e),
      link: "/do-luong-mkt", giay: (Date.now() - t0) / 1000,
    }).catch(() => undefined);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 });
  }
}

async function topPagePosts(userToken: string): Promise<any[]> {
  const acc: any = await (await fetch(`${G}/me/accounts?fields=name,access_token&limit=25&access_token=${encodeURIComponent(userToken)}`, { cache: "no-store" })).json();
  if (acc?.error) throw new Error(`me/accounts: ${acc.error.message || acc.error.code}`);
  const pages = acc.data || [];
  if (!pages.length) throw new Error("me/accounts trả 0 page (token thiếu quyền pages_show_list?)");
  const pid = (process.env.FB_PAGE_ID || "").trim();

  const scanPages = pid ? pages.filter((p: any) => p.id === pid) : pages.slice(0, 12);
  const cutoff = Date.now() - 90 * 864e5;
  const flds = `message,created_time,permalink_url,shares,reactions.summary(true).limit(0),comments.summary(true).limit(0),insights.metric(post_clicks){values}`;
  const mv = (ins: any, key: string) => { const m = (ins?.data || []).find((x: any) => x.name === key); return Number(m?.values?.[0]?.value || 0); };
  const all: any[] = [];
  const errs: string[] = [];
  for (const page of scanPages) {
    const pTok = page.access_token || userToken;
    try {
      const pj: any = await (await fetch(`${G}/${page.id}/published_posts?fields=${encodeURIComponent(flds)}&limit=50&access_token=${encodeURIComponent(pTok)}`, { cache: "no-store" })).json();
      if (pj.error) { errs.push(`${page.name}: ${pj.error.message || pj.error.code}`); continue; }
      for (const p of pj.data || []) {
        if (new Date(p.created_time).getTime() < cutoff) continue;
        const clicks = mv(p.insights, "post_clicks");
        const reactions = Number(p.reactions?.summary?.total_count || 0);
        const comments = Number(p.comments?.summary?.total_count || 0);
        const shares = Number(p.shares?.count || 0);
        all.push({ page: page.name, msg: (p.message || "(không chữ)").slice(0, 600), created: (p.created_time || "").slice(0, 10), reach: 0, clicks, reactions, comments, shares, engaged: reactions + comments + shares, engRate: 0, link: p.permalink_url || "" });
      }
    } catch (e: any) { errs.push(`${page.name}: ${String(e?.message || e)}`); }
  }

  if (!all.length && errs.length) throw new Error(`0 bài từ ${scanPages.length} page — lỗi: ${errs.slice(0, 3).join(" | ")}`);
  return all.sort((a: any, b: any) => (b.engaged + b.clicks) - (a.engaged + a.clicks));
}
