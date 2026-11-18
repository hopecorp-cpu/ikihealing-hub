import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove, canManageDataroom } from "@/lib/auth";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { getRouting, type EmailRec } from "@/lib/gmail";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const manager = isManagerOrAbove(user.role) || canManageDataroom(user as any);
  const myEmail = (user.email || "").toLowerCase().trim();
  const b = await req.json().catch(() => ({}));
  const action = b.action as string;

  let emails: EmailRec[] = [];
  try { emails = JSON.parse((await getConfigValue("gmail_emails")) || "[]"); } catch { }

  if (action === "assign") {
    if (!manager) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const e = emails.find(x => x.id === b.id);
    if (e) { e.assignee = String(b.assignee || "").toLowerCase().trim(); e.assignedBy = myEmail; e.updatedAt = new Date().toISOString(); }
    await setConfigValue("gmail_emails", JSON.stringify(emails), "Gmail emails");
    return NextResponse.json({ ok: true });
  }

  if (action === "setStatus") {
    const e = emails.find(x => x.id === b.id);
    if (!e) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!manager && e.assignee !== myEmail) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    if (["new", "doing", "done"].includes(b.status)) { e.status = b.status; e.updatedAt = new Date().toISOString(); }
    await setConfigValue("gmail_emails", JSON.stringify(emails), "Gmail emails");
    return NextResponse.json({ ok: true });
  }

  if (action === "setRouting") {
    if (!manager) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const cur = await getRouting();
    const next = { ...cur, ...(b.routing || {}) };
    await setConfigValue("gmail_routing", JSON.stringify(next), "Gmail routing nhóm→người phụ trách");
    return NextResponse.json({ ok: true, routing: next });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
