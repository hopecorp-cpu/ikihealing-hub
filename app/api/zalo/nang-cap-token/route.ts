import { NextResponse } from "next/server";
import { nangCapMaHoa } from "@/lib/zalo-oa-token";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const chanKhoa = await chanMay(req, [khoaCron()]);
  if (chanKhoa) return chanKhoa;
  return NextResponse.json(await nangCapMaHoa());
}
