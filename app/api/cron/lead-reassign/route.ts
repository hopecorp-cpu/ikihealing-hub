import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { sweepReassign, sweepColdLeads, reportStuckLeads, sweepPushCycle } from "@/lib/leads";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const chanKhoa = await chanMay(req, [khoaCron({ bearer: true })]);
  if (chanKhoa) return chanKhoa;
  const sb = getServiceClient();
  const moved = await sweepReassign(sb);
  const cold = await sweepColdLeads(sb);
  const stuck = await reportStuckLeads(sb);
  const push = await sweepPushCycle(sb);
  return NextResponse.json({
    ok: true, reassigned: moved,
    coldNudged: cold.nudged, coldReassigned: cold.reassigned, stuckReported: stuck,
    pushNudged: push.nudged, pushReassigned: push.reassigned, pushSkipped: push.skipped,
  });
}
