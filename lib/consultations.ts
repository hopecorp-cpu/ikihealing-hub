import { getServiceClient } from "@/lib/supabase-server";
import { vnDateStr } from "@/lib/payroll";

export const SLOT_MINUTES = 30;

export const DEFAULT_SLOTS = (() => {
  const out: string[] = [];
  for (let h = 9; h <= 20; h++) {
    if (h === 12) continue;
    out.push(`${String(h).padStart(2, "0")}:00`, `${String(h).padStart(2, "0")}:30`);
  }
  return out;
})();

export type ConsultStatus = "dat" | "den" | "vang" | "huy";

export type Consultation = {
  id: string;
  slot_date: string;
  slot_time: string;
  staff_id: string | null;
  staff_name: string | null;
  customer_name: string;
  customer_phone: string | null;
  channel: string | null;
  source: string | null;
  note: string | null;
  status: ConsultStatus;
  reminded_at: string | null;
  outcome: string | null;
};

export type StaffLite = { id: string; full_name: string };

export async function consultStaff(): Promise<StaffLite[]> {
  const sb = getServiceClient();
  const { data } = await sb.from("users").select("id,full_name,position,active").eq("active", true);
  const rows = (data || []) as Array<{ id: string; full_name: string; position: string | null }>;
  const wanted = /sale|kinh doanh|cskh|chăm sóc|tư vấn|giám đốc/i;
  const picked = rows.filter((u) => wanted.test(u.position || ""));
  return (picked.length ? picked : rows).map((u) => ({ id: u.id, full_name: u.full_name }));
}

export async function listByDate(date: string): Promise<Consultation[]> {
  const sb = getServiceClient();
  const { data } = await sb.from("consultations").select("*").eq("slot_date", date).order("slot_time");
  return (data || []) as Consultation[];
}

export async function listRange(from: string, to: string): Promise<Consultation[]> {
  const sb = getServiceClient();
  const { data } = await sb.from("consultations").select("*").gte("slot_date", from).lte("slot_date", to).order("slot_date").order("slot_time");
  return (data || []) as Consultation[];
}

export type BookInput = {
  slot_date: string; slot_time: string; staff_id: string; staff_name: string;
  customer_name: string; customer_phone?: string; channel?: string; source?: string; note?: string;
  created_by?: string;
};

export async function book(input: BookInput): Promise<{ ok: boolean; error?: string }> {
  const sb = getServiceClient();
  const { error } = await sb.from("consultations").insert({
    slot_date: input.slot_date,
    slot_time: input.slot_time,
    staff_id: input.staff_id,
    staff_name: input.staff_name,
    customer_name: input.customer_name.trim(),
    customer_phone: (input.customer_phone || "").replace(/\D/g, "") || null,
    channel: input.channel || "zalo",
    source: input.source || null,
    note: input.note || null,
    created_by: input.created_by || null,
  });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { ok: false, error: "Khung giờ này của chuyên viên đã có khách rồi ạ." };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function setStatus(id: string, status: ConsultStatus, outcome?: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getServiceClient();
  const patch: Record<string, unknown> = { status };
  if (outcome !== undefined) patch.outcome = outcome || null;
  const { error } = await sb.from("consultations").update(patch).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export type ShowRate = { total: number; den: number; vang: number; huy: number; cho: number; ratePct: number | null };

export async function showRate(from: string, to: string): Promise<ShowRate> {
  const rows = await listRange(from, to);
  const den = rows.filter((r) => r.status === "den").length;
  const vang = rows.filter((r) => r.status === "vang").length;
  const huy = rows.filter((r) => r.status === "huy").length;
  const cho = rows.filter((r) => r.status === "dat").length;
  const judged = den + vang;
  return { total: rows.length, den, vang, huy, cho, ratePct: judged ? Math.round((den / judged) * 100) : null };
}

export async function tomorrowUnreminded(): Promise<Consultation[]> {
  const tomorrow = new Date(Date.now() + 7 * 3600e3 + 86400e3).toISOString().slice(0, 10);
  const sb = getServiceClient();
  const { data } = await sb.from("consultations").select("*").eq("slot_date", tomorrow).eq("status", "dat").is("reminded_at", null).order("slot_time");
  return (data || []) as Consultation[];
}

export async function markReminded(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const sb = getServiceClient();
  await sb.from("consultations").update({ reminded_at: new Date().toISOString() }).in("id", ids);
}

export async function consultSummary(): Promise<{ today: number; todayDone: number; weekRate: ShowRate }> {
  const today = vnDateStr();
  const weekAgo = new Date(Date.now() + 7 * 3600e3 - 7 * 86400e3).toISOString().slice(0, 10);
  const [rows, rate] = await Promise.all([listByDate(today), showRate(weekAgo, today)]);
  return { today: rows.length, todayDone: rows.filter((r) => r.status === "den").length, weekRate: rate };
}
