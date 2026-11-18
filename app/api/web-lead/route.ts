import { NextResponse } from "next/server";
import { vuotGioiHan } from "@/lib/chan-spam";
import { getServiceClient } from "@/lib/supabase-server";
import { insertAndAssign } from "@/lib/leads";
import { docNguonTuBody, themNhan } from "@/lib/nguon-lead";
import { ganMaCtvLeadCu, ghiChuCoCtv } from "@/lib/affiliate-don";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function cors() {
  return {
    "Access-Control-Allow-Origin": "https://example.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: cors() }); }

export async function POST(req: Request) {
  let b: any = {};
  try { b = await req.json(); } catch {  }

  if (String(b._hp || b._honey || "").trim()) return NextResponse.json({ ok: true, skipped: "honeypot" }, { headers: cors() });

  let d = String(b.phone || "").replace(/\D/g, "");
  if (d.startsWith("84") && d.length === 11) d = "0" + d.slice(2);
  if (!/^0\d{9}$/.test(d)) {
    return NextResponse.json({ ok: false, error: "SĐT không hợp lệ" }, { status: 400, headers: cors() });
  }
  if (await vuotGioiHan(req, "web-lead", { moiIpMoiGio: 10, tongMoiNgay: 300 })) return NextResponse.json({ ok: false, error: "Bạn gửi nhiều quá, đợi một lát rồi thử lại giúp NOVA nhé." }, { status: 429, headers: cors() });

  try {
    const sb = getServiceClient();

    let nhan = "";
    try {
      const { docDongYTuBody, ghiDongY, ipCua } = await import("@/lib/du-lieu-ca-nhan");
      const dongY = docDongYTuBody(b);
      if (dongY.co) {
        await ghiDongY(sb, {
          phone: d, ten: String(b.customer || b.name || "").trim(), kenh: "web-shop",
          nguon: String(b.source || ""), mucDich: dongY.mucDich, vanBan: dongY.vanBan,
          phienBan: dongY.phienBan, ip: ipCua(req), ua: req.headers.get("user-agent"),
        });
      }
      if (!(dongY.co && dongY.tinTuVan)) nhan = " · [CHƯA đồng ý nhận tin tư vấn/QC — chỉ gọi đúng việc khách xin]";
    } catch {  }

    const r = await insertAndAssign(sb, {
      customer_name: String(b.customer || b.name || "").trim() || null,
      phone: d,
      channel: "website",
      source: themNhan(String(b.source || "web-lead").trim().slice(0, 80), docNguonTuBody(b)),
      product: String(b.product || "").trim() || null,
      external_id: "weblead:" + d,

      note: ghiChuCoCtv((String(b.note || "").trim().slice(0, 300 - nhan.length) + nhan) || null, b.ma_ctv),
    });
    if (r.ok && r.dedup) await ganMaCtvLeadCu(sb, r.id, b.ma_ctv);
    return NextResponse.json({ ok: r.ok, dedup: !!r.dedup, error: r.error }, { headers: cors() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500, headers: cors() });
  }
}
