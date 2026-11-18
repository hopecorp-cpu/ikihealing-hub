import { NextResponse } from "next/server";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isBodRole } from "@/lib/auth";
import { vnDateStr } from "@/lib/payroll";
import { normalizePhone } from "@/lib/zalo";

export const dynamic = "force-dynamic";

const FLOW: Record<string, number[]> = {
  bought: [0, 3, 7, 14, 21, 28, 35],
  notBought: [0, 1, 3, 5, 7, 10],
  reorder: [0, 3, 7],
};

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isBodRole(user.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const phone = String(b.phone || "").trim();
  if (!phone) return NextResponse.json({ error: "missing phone" }, { status: 400 });

  const sb = getServiceClient();

  if (b.stop || b.resume) {
    const stop = !!b.stop;
    const reason = String(b.reason || b.note || "").trim();
    const row: any = {
      customer_phone: phone,
      customer_name: b.name || null,
      sale_name: b.sale_name || null,
      status: stop ? "stopped" : "active",
      next_due: stop ? null : vnDateStr(),
      updated_by: user.email || user.full_name || null,
      updated_at: new Date().toISOString(),
    };
    if (stop) row.note = reason ? `[Ngừng chăm] ${reason}` : "[Ngừng chăm]";
    const { error } = await sb.from("customer_care_log").upsert(row, { onConflict: "customer_phone" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    try {
      await sb.from("care_events").insert({
        customer_phone: normalizePhone(phone) || phone,
        customer_name: b.name || null,
        sale_name: b.sale_name || user.full_name || null,
        sale_id: (user as any).id || null,
        kind: "note",
        content: stop ? `NGỪNG CHĂM${reason ? ": " + reason : ""}` : "MỞ LẠI CHĂM SÓC",
        month: vnDateStr().slice(0, 7),
      });
    } catch { }
    return NextResponse.json({ ok: true, status: row.status, next_due: row.next_due });
  }

  const flow_type = ["notBought", "reorder"].includes(b.flow_type) ? b.flow_type : "bought";
  const current_day = Number(b.current_day) || 0;
  const today = vnDateStr();
  const milestones = FLOW[flow_type];
  const next = milestones.find(m => m > current_day);
  const next_due = next != null ? addDays(today, next - current_day) : null;
  const status = next == null ? "done" : "active";

  const { error } = await sb.from("customer_care_log").upsert({
    customer_phone: phone,
    customer_name: b.name || null,
    sale_name: b.sale_name || null,
    flow_type, current_day,
    last_contact: today, next_due, status,
    note: b.note || null,
    updated_by: user.email || user.full_name || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "customer_phone" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const nph = normalizePhone(phone) || phone;
    await sb.from("care_events").insert({
      customer_phone: nph,
      customer_name: b.name || null,
      sale_name: (b.sale_name || user.full_name || null),
      sale_id: (user as any).id || null,
      kind: b.gift ? "gift" : b.channel === "call" ? "call" : "message",
      channel: b.channel || "zalo",
      content: b.content || b.note || null,
      outcome: ["chot", "hen", "miss", "tuvan"].includes(b.callOutcome) ? b.callOutcome : null,
      flow_type,
      day_index: current_day,
      month: today.slice(0, 7),
    });
  } catch {  }

  if (b.channel === "call") {
    const saleName = (b.sale_name || user.full_name || "—").trim();
    const oc = ["chot", "hen", "miss", "tuvan"].includes(b.callOutcome) ? b.callOutcome : "tuvan";
    const { data: row } = await sb.from("config").select("value").eq("key", "call_log").maybeSingle();
    let log: Record<string, Record<string, any>> = {};
    try { log = JSON.parse(row?.value || "{}"); } catch { }
    log[today] ||= {};
    let cur = log[today][saleName];
    if (typeof cur === "number") cur = { n: cur, chot: 0, hen: 0, miss: 0, tuvan: 0 };
    if (!cur || typeof cur !== "object") cur = { n: 0, chot: 0, hen: 0, miss: 0, tuvan: 0 };
    cur.n = (cur.n || 0) + 1; cur[oc] = (cur[oc] || 0) + 1;
    log[today][saleName] = cur;
    const days = Object.keys(log).sort();
    for (const d of days.slice(0, Math.max(0, days.length - 60))) delete log[d];
    await sb.from("config").upsert({ key: "call_log", value: JSON.stringify(log) }, { onConflict: "key" });
  }

  if (b.gift) {
    const saleName = (b.sale_name || user.full_name || "—").trim();
    const { data: row } = await sb.from("config").select("value").eq("key", "gift_log").maybeSingle();
    let log: Record<string, Record<string, any>> = {};
    try { log = JSON.parse(row?.value || "{}"); } catch { }
    log[today] ||= {};
    let cur = log[today][saleName];
    if (!cur || typeof cur !== "object") cur = { n: 0 };
    cur.n = (cur.n || 0) + 1;
    log[today][saleName] = cur;
    const days = Object.keys(log).sort();
    for (const d of days.slice(0, Math.max(0, days.length - 60))) delete log[d];
    await sb.from("config").upsert({ key: "gift_log", value: JSON.stringify(log) }, { onConflict: "key" });
  }

  try {
    const nph = normalizePhone(phone);
    if (nph) {
      const { data: row } = await sb.from("config").select("value").eq("key", "care_touch_log").maybeSingle();
      let log: Record<string, any> = {}; try { log = JSON.parse(row?.value || "{}"); } catch { }
      const cur = log[nph] || { n: 0, first: today, sale: b.sale_name || "" };
      cur.n = (cur.n || 0) + 1; cur.last = today; if (!cur.first) cur.first = today;
      log[nph] = cur;
      const keys = Object.keys(log);
      if (keys.length > 4000) {
        keys.sort((a, c) => (log[a].last || "") < (log[c].last || "") ? -1 : 1);
        for (const k of keys.slice(0, keys.length - 4000)) delete log[k];
      }
      await sb.from("config").upsert({ key: "care_touch_log", value: JSON.stringify(log) }, { onConflict: "key" });
    }
  } catch { }
  return NextResponse.json({ ok: true, next_due, status });
}
