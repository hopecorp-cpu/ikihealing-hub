import { NextResponse } from "next/server";
import crypto from "crypto";
import { getServiceClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const key2 = (process.env.ZALOPAY_KEY2 || "").trim();
  let body: any = {};
  try { body = await req.json(); } catch { try { body = JSON.parse(await req.text()); } catch { } }
  if (!key2) return NextResponse.json({ return_code: 0, return_message: "ZALOPAY_KEY2 chưa cấu hình" });

  const data = String(body.data || "");
  const mac = String(body.mac || "");
  const expect = crypto.createHmac("sha256", key2).update(data).digest("hex");
  if (mac !== expect) return NextResponse.json({ return_code: -1, return_message: "mac not equal" });

  let d: any = {};
  try { d = JSON.parse(data); } catch { }
  try {
    const sb = getServiceClient();
    await sb.from("config").upsert({
      key: `zalopay_order_${d.app_trans_id || d.apptransid || Date.now()}`,
      value: JSON.stringify({ paidAt: new Date().toISOString(), amount: d.amount, item: d.item, extradata: d.embed_data || d.extradata }),
    }, { onConflict: "key" });
  } catch { }
  return NextResponse.json({ return_code: 1, return_message: "success" });
}
