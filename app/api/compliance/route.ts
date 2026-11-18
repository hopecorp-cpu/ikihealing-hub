import { NextResponse } from "next/server";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { canManageDataroom } from "@/lib/auth";
import { getCompliance, saveCompliance, type CStatus } from "@/lib/compliance";
import { detectCompliance } from "@/lib/compliance-auto";

export const dynamic = "force-dynamic";
const STATUSES: CStatus[] = ["available", "need_update", "need_review", "missing", "na", ""];

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canManageDataroom(user as any)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const b = await req.json().catch(() => ({}));

  if (b.action === "autofill") {
    const force = b.force === true;
    const hits = await detectCompliance(getServiceClient());
    const c = await getCompliance();
    const items = { ...c.items };
    let applied = 0;
    for (const [key, hit] of Object.entries(hits)) {
      const cur = items[key] || {};
      const isAutoOrEmpty = !cur.status || cur.reviewedBy === "auto";
      if (!isAutoOrEmpty && !force) continue;
      if (cur.reviewedBy && cur.reviewedBy !== "auto" && !force) continue;
      items[key] = { ...cur, status: hit.status, note: `${hit.evidence}`, reviewedBy: "auto", reviewedAt: new Date().toISOString() };
      applied++;
    }
    const next = await saveCompliance({ items });
    return NextResponse.json({ ok: true, applied, compliance: next });
  }

  if (b.action !== "saveItem") return NextResponse.json({ error: "unknown action" }, { status: 400 });
  const key = String(b.key || "").trim();
  if (!key) return NextResponse.json({ error: "missing key" }, { status: 400 });

  const c = await getCompliance();
  const cur = c.items[key] || {};
  const items = {
    ...c.items,
    [key]: {
      ...cur,
      status: STATUSES.includes(b.status) ? b.status : cur.status,
      link: typeof b.link === "string" ? b.link.trim() : cur.link,
      note: typeof b.note === "string" ? b.note : cur.note,
      assignee: typeof b.assignee === "string" ? b.assignee.trim() : cur.assignee,
      reviewedAt: new Date().toISOString(),
      reviewedBy: user.email || user.full_name || "",
    },
  };
  const next = await saveCompliance({ items });
  return NextResponse.json({ ok: true, compliance: next });
}
