import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { dienKpiChuKy } from "@/lib/kpi-tu-do";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;
  const sb = getServiceClient();
  let cycleId = url.searchParams.get("cycle");
  if (!cycleId) {
    const { data } = await sb.from("cycles").select("id").eq("status", "active").order("start_date", { ascending: false }).limit(1).maybeSingle();
    cycleId = data?.id || null;
  }
  if (!cycleId) return NextResponse.json({ ok: false, error: "không có chu kỳ đang mở" });
  const r = await dienKpiChuKy(sb, cycleId, url.searchParams.get("dry") === "1");
  return NextResponse.json({ ok: true, cycleId, ...r });
}
