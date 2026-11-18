import { NextResponse } from "next/server";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isBodRole } from "@/lib/auth";
import { vnDateStr } from "@/lib/payroll";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isBodRole(user.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const day = url.searchParams.get("d") || vnDateStr();
  const sb = getServiceClient();
  const ident = (user.email || user.full_name || "").trim();
  const { data, error } = await sb
    .from("customer_care_log")
    .select("customer_phone,customer_name,sale_name,flow_type,current_day,last_contact,next_due,status,note,updated_at")
    .eq("updated_by", ident)
    .eq("last_contact", day)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, day, leads: data || [] });
}
