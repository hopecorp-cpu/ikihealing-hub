import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { leadsKey } from "@/lib/revenue-loop";
import { insertAndAssign, sweepReassign } from "@/lib/leads";
import { vnDateStr } from "@/lib/payroll";
import { docNguonTuBody, themNhan } from "@/lib/nguon-lead";
import { ganMaCtvLeadCu, ghiChuCoCtv } from "@/lib/affiliate-don";
import { chanMay } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function cors() {
  return {
    "Access-Control-Allow-Origin": "https://example.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-leads-token",
  } as Record<string, string>;
}
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: cors() }); }

export async function POST(req: Request) {

  const chanKhoa = await chanMay(req, [{ env: "LEADS_TOKEN", query: ["token"], headers: ["x-leads-token"] }]);
  if (chanKhoa) return chanKhoa;
  let body: any = {};
  try { body = await req.json(); } catch { }

  if (String(body._hp || "").trim()) return NextResponse.json({ ok: true, skipped: "honeypot" }, { headers: cors() });
  const channel = String(body.channel || "").trim();
  const phone = String(body.phone || body.customer_phone || "").trim();
  const customer = String(body.customer || body.customer_name || body.name || "").trim();
  const sb = getServiceClient();

  if (phone || customer) {

    let nhanDongY = "";
    try {
      const { docDongYTuBody, ghiDongY, ipCua } = await import("@/lib/du-lieu-ca-nhan");
      const dongY = docDongYTuBody(body);
      if (dongY.co) await ghiDongY(sb, { phone, ten: customer, kenh: channel === "website" ? "web-shop" : (channel || "webhook"), nguon: String(body.source || ""), mucDich: dongY.mucDich, vanBan: dongY.vanBan, phienBan: dongY.phienBan, ip: ipCua(req), ua: req.headers.get("user-agent") });
      if (channel === "website" && !(dongY.co && dongY.tinTuVan)) nhanDongY = " · [CHƯA đồng ý nhận tin tư vấn/QC — chỉ gọi đúng việc khách xin]";
    } catch {  }
    const r = await insertAndAssign(sb, {
      customer_name: customer || null, phone: phone || null, channel: channel || null,
      source: themNhan(String(body.source || "").trim(), docNguonTuBody(body)) || null, product: String(body.product || "").trim() || null,
      pancake_link: String(body.pancake_link || "").trim() || null, external_id: String(body.external_id || "").trim() || null,

      note: ghiChuCoCtv((String(body.note || "").trim().slice(0, 300 - nhanDongY.length) + nhanDongY) || null, body.ma_ctv),
    });
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error || "insert lỗi (đã chạy migration 036 chưa?)" }, { status: 200 });
    if (r.dedup) await ganMaCtvLeadCu(sb, r.id, body.ma_ctv);

    if (channel) await bumpChannelCount(sb, channel, 1);
    sweepReassign(sb).catch(() => { });
    return NextResponse.json({ ok: true, mode: "lead", id: r.id, assignee_id: r.assignee_id, dedup: r.dedup || false }, { headers: cors() });
  }

  if (!channel) return NextResponse.json({ ok: false, error: "thiếu channel hoặc phone/customer" }, { status: 400 });
  const count = Math.max(1, Math.round(Number(body.count) || 1));
  const month = /^\d{4}-\d{2}$/.test(body.month || "") ? body.month : vnDateStr().slice(0, 7);
  const total = await bumpChannelCount(sb, channel, count, month, String(body.source || "webhook").slice(0, 40));
  return NextResponse.json({ ok: true, mode: "count", month, channel, added: count, monthTotal: total });
}

async function bumpChannelCount(sb: any, channel: string, count: number, month?: string, source = "webhook"): Promise<number> {
  const mth = month || vnDateStr().slice(0, 7);
  const key = leadsKey(mth);
  const { data } = await sb.from("config").select("value").eq("key", key).maybeSingle();
  let cur: any = {}; try { cur = JSON.parse(data?.value || "{}"); } catch { }
  const byChannel = cur.byChannel || {};
  byChannel[channel] = (Number(byChannel[channel]) || 0) + count;
  await sb.from("config").upsert({ key, value: JSON.stringify({ byChannel, source: cur.source || source, updatedAt: new Date().toISOString() }) }, { onConflict: "key" });
  return Object.values(byChannel).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
}

export async function GET(req: Request) {
  const chanKhoa = await chanMay(req, [{ env: "LEADS_TOKEN", query: ["token"] }]);
  if (chanKhoa) return chanKhoa;
  const url = new URL(req.url);
  const month = /^\d{4}-\d{2}$/.test(url.searchParams.get("month") || "") ? url.searchParams.get("month")! : vnDateStr().slice(0, 7);
  const sb = getServiceClient();
  const { data } = await sb.from("config").select("value").eq("key", leadsKey(month)).maybeSingle();
  let cur: any = {}; try { cur = JSON.parse(data?.value || "{}"); } catch { }
  return NextResponse.json({ ok: true, month, ...cur });
}
