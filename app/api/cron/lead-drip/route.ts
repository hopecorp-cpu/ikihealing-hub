import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { sweepLeadDrip } from "@/lib/leads";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const chanKhoa = await chanMay(req, [khoaCron({ bearer: true })]);
  if (chanKhoa) return chanKhoa;
  const sb = getServiceClient();
  const r = await sweepLeadDrip(sb);
  return NextResponse.json({ ok: true, ...r });
}
