import { NextResponse } from "next/server";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (!b.task_date || !b.group_key || !b.time_slot) return NextResponse.json({ error: "missing key" }, { status: 400 });
  const sb = getServiceClient();
  const { error } = await sb.from("seeding_tasks").upsert({
    task_date: b.task_date, group_key: b.group_key, time_slot: b.time_slot,
    title: b.title || null, assigned_to: b.assigned_to || null,
    done: !!b.done, note: b.note || null,
    updated_by: user.email || user.full_name || null, updated_at: new Date().toISOString(),
  }, { onConflict: "task_date,group_key,time_slot" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
