import { NextRequest, NextResponse } from "next/server";
import { FINANCE_WHITELIST, isBodRole } from "@/lib/auth";
import { requireUser } from "@/lib/auth-server";
import { getServiceClient } from "@/lib/supabase-server";
import { getConfigValue, setConfigValue } from "@/lib/app-config";

export const dynamic = "force-dynamic";

async function guard() {
  const user = await requireUser();
  if (isBodRole(user.role)) return false;
  const email = user.email?.toLowerCase().trim() || "";
  return FINANCE_WHITELIST.map(e => e.toLowerCase()).includes(email);
}
const isMonth = (m: string) => /^\d{4}-\d{2}$/.test(m || "");

export async function GET(req: NextRequest) {
  if (!(await guard())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  const type = sp.get("type"), month = sp.get("month") || "";
  if (!isMonth(month)) return NextResponse.json({ error: "bad month" }, { status: 400 });

  if (type === "product") {
    const sb = getServiceClient();
    const { data, error } = await sb.from("product_revenue_monthly")
      .select("sku, product_name, unit, quantity, gross_amount, discount, tax, net_revenue")
      .eq("month", month).order("net_revenue", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ rows: data ?? [] });
  }
  if (type === "staff") {
    const raw = await getConfigValue(`staff_revenue_${month}`);
    let rows: any[] = [];
    try { rows = raw ? JSON.parse(raw) : []; } catch { rows = []; }
    return NextResponse.json({ rows });
  }
  return NextResponse.json({ error: "bad type" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  if (!(await guard())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || !isMonth(body.month) || !Array.isArray(body.rows)) return NextResponse.json({ error: "bad body" }, { status: 400 });
  const { type, month, rows } = body;
  const n = (v: any) => Number(String(v ?? "").toString().replace(/[^\d.-]/g, "")) || 0;

  if (type === "product") {
    const sb = getServiceClient();
    const recs = rows
      .filter((r: any) => (r.product_name || r.sku))
      .map((r: any) => ({
        month, sku: String(r.sku || "").trim() || null, product_name: String(r.product_name || "").trim(),
        unit: String(r.unit || "").trim(), quantity: n(r.quantity), gross_amount: n(r.gross_amount),
        discount: n(r.discount), tax: n(r.tax),
        net_revenue: r.net_revenue != null ? n(r.net_revenue) : n(r.gross_amount) - n(r.discount) - n(r.tax),
        source: "manual",
      }));
    await sb.from("product_revenue_monthly").delete().eq("month", month);
    if (recs.length) {
      const { error } = await sb.from("product_revenue_monthly").upsert(recs, { onConflict: "month,sku" });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, saved: recs.length });
  }
  if (type === "staff") {
    const recs = rows
      .filter((r: any) => (r.name || r.code))
      .map((r: any) => ({
        code: String(r.code || "").trim(), name: String(r.name || "").trim(),
        gross: n(r.gross), shipping: n(r.shipping), discount: n(r.discount), tax: n(r.tax),
        net: r.net != null ? n(r.net) : n(r.gross) - n(r.shipping) - n(r.discount) - n(r.tax),
      }));
    await setConfigValue(`staff_revenue_${month}`, JSON.stringify(recs), "Doanh thu theo nhân viên (kế toán nhập)");
    return NextResponse.json({ ok: true, saved: recs.length });
  }
  return NextResponse.json({ error: "bad type" }, { status: 400 });
}
