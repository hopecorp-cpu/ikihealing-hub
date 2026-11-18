import { NextResponse } from "next/server";
import { generateDueRecurringTasks } from "@/app/tasks/recurring/actions";
import { chanMay, khoaCron } from "@/lib/kiem-cron";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {

  const chanKhoa = await chanMay(req, [khoaCron({ bearer: true })]);
  if (chanKhoa) return chanKhoa;

  const result = await generateDueRecurringTasks();
  return NextResponse.json(result);
}
