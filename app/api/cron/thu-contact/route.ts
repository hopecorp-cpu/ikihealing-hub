import { NextResponse } from "next/server";
import { quetThuContact } from "@/lib/thu-contact";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;
  const r = await quetThuContact();

  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
