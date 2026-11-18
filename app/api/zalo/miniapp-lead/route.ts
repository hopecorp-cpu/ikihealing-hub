import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { insertAndAssign } from "@/lib/leads";
import { chanMay } from "@/lib/kiem-cron";
import { docDongYTuBody, ghiDongY } from "@/lib/du-lieu-ca-nhan";
import { exchangePhone } from "@/lib/zalo-miniapp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-leads-token",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {

  const chanKhoa = await chanMay(req, [{ env: "LEADS_TOKEN", query: ["token"], headers: ["x-leads-token"] }], { headers: CORS });
  if (chanKhoa) return chanKhoa;
  let body: any = {};
  try { body = JSON.parse(await req.text()); } catch { }

  let rawPhone = String(body.phone || "").trim();
  if (!rawPhone && body.phone_token && body.access_token) {
    rawPhone = (await exchangePhone(String(body.phone_token), String(body.access_token))) || "";
  }
  const phone = normalizePhoneVN(rawPhone);
  if (!phone) {
    return NextResponse.json({ ok: false, error: "chưa lấy được số điện thoại (chưa cấu hình ZALO_MINIAPP_SECRET hoặc user chưa cấp quyền)" }, { status: 200, headers: CORS });
  }

  const q = body.quiz || {};
  const productName = String(body.product || "").trim();
  const qty = Math.max(1, Math.round(Number(body.qty) || 1));
  const isOrder = !!productName;

  const noteParts = isOrder
    ? [`ĐẶT MUA: ${productName} x${qty}`, q.group ? `cơ địa:${q.group}` : ""]
    : [
        q.group ? `cơ địa:${q.group}` : "",
        q.score != null ? `điểm:${q.score}` : "",
        q.bodyAge != null ? `tuổi cơ thể:${q.bodyAge}` : "",
        q.zone ? q.zone : "",
        q.ageRange ? `tuổi:${q.ageRange}` : "",
      ];

  const sb = getServiceClient();

  const extId = isOrder ? `zmp-order:${phone}:${(body.sku || productName).slice(0, 24)}` : `zmp:${phone}`;
  const r = await insertAndAssign(sb, {
    customer_name: String(body.name || "").trim() || null,
    phone,
    source: isOrder ? "Zalo Mini App - Đặt mua" : String(body.source || "Zalo Mini App").trim(),
    product: isOrder ? productName.slice(0, 120) : null,
    channel: "zalo",
    external_id: extId,
    note: noteParts.filter(Boolean).join(" · ").slice(0, 200),
  }, { notify: true });

  if (!r.ok) return NextResponse.json({ ok: false, error: r.error || "insert lỗi" }, { status: 200, headers: CORS });
  const dongY = docDongYTuBody(body);
  if (dongY.co) {
    try {
      await ghiDongY(sb, { phone, ten: String(body.name || "").trim() || null, kenh: "zalo-mini-app", nguon: String(body.source || "Zalo Mini App"),
        mucDich: dongY.mucDich, vanBan: dongY.vanBan, phienBan: dongY.phienBan, ua: req.headers.get("user-agent") });
    } catch (e: any) { console.error("[miniapp-lead] ghi đồng ý lỗi:", e?.message); }
  }
  return NextResponse.json({ ok: true, id: r.id, assignee_id: r.assignee_id ? true : null, dedup: r.dedup || false } , { headers: CORS });
}

function normalizePhoneVN(raw: string): string | null {
  let p = (raw || "").replace(/[^0-9]/g, "");
  if (!p) return null;
  if (p.startsWith("84")) p = "0" + p.slice(2);
  if (!p.startsWith("0")) p = "0" + p;
  return /^0\d{8,10}$/.test(p) ? p : null;
}
