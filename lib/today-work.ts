import "server-only";
import { getServiceClient } from "@/lib/supabase-server";
import { vnDateStr } from "@/lib/payroll";

export const QUOTA_NGAY = 20;

export type ViecItem = {
  id: string;
  customer_name: string | null;
  note: string | null;
  pancake_link: string | null;
  source: string | null;
  status: string;
  assigned_at: string | null;
  nong: boolean;
  tuoiNgay: number;
};

export type ViecHomNay = {
  items: ViecItem[];
  soNong: number;
  soCu: number;

  tongKho: number;
  daXong: number;
};

const ngayTuoi = (iso?: string | null) => {
  if (!iso) return 999;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 864e5));
};

export async function layViecHomNay(userId: string, quota = QUOTA_NGAY): Promise<ViecHomNay> {
  const sb = getServiceClient();
  const homNay = vnDateStr();

  const { data: nong } = await sb.from("leads")
    .select("id, customer_name, note, pancake_link, source, status, assigned_at")
    .eq("assignee_id", userId).eq("status", "new")
    .order("created_at", { ascending: false }).limit(quota);

  const conLai = Math.max(0, quota - (nong?.length || 0));
  let cu: any[] = [];
  if (conLai > 0) {

    const { data } = await sb.from("leads")
      .select("id, customer_name, note, pancake_link, source, status, assigned_at")
      .eq("assignee_id", userId).eq("status", "backlog")
      .order("assigned_at", { ascending: false, nullsFirst: false }).limit(conLai);
    cu = data || [];
  }

  const { count: tongKho } = await sb.from("leads").select("id", { count: "exact", head: true })
    .eq("assignee_id", userId).in("status", ["new", "backlog"]);

  const { count: daXong } = await sb.from("leads").select("id", { count: "exact", head: true })
    .eq("assignee_id", userId).gte("first_contact_at", `${homNay}T00:00:00`);

  const map = (r: any, nongFlag: boolean): ViecItem => ({
    id: r.id, customer_name: r.customer_name, note: r.note, pancake_link: r.pancake_link,
    source: r.source, status: r.status, assigned_at: r.assigned_at,
    nong: nongFlag, tuoiNgay: ngayTuoi(r.assigned_at),
  });

  return {
    items: [...(nong || []).map((r) => map(r, true)), ...cu.map((r) => map(r, false))],
    soNong: nong?.length || 0,
    soCu: cu.length,
    tongKho: tongKho || 0,
    daXong: daXong || 0,
  };
}
