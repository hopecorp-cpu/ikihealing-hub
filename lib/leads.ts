import { appLink } from "@/lib/app-url";
import { tgEscape } from "@/lib/telegram";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { isSalePosition } from "@/lib/auth";
import { vnDateStr } from "@/lib/payroll";
import { layDauVetCham, lanChamCuoi } from "@/lib/dau-vet-cham";
import { themNhan } from "@/lib/nguon-lead";
import { docMaNguon, nguonTuMa } from "@/lib/ma-nguon";

export type LeadStatus = "new" | "contacted" | "caring" | "won" | "lost";
export type Lead = {
  id: string; created_at: string; customer_name: string | null; phone: string | null;
  source: string | null; product: string | null; channel: string | null;
  assignee_id: string | null; assigned_at: string | null; first_contact_at: string | null;
  status: LeadStatus; share_count: number; last_reassign_at: string | null;
  pancake_link: string | null; external_id: string | null; note: string | null; month: string | null;
};

export type LeadConfig = {
  slaMinutes: number;
  reassignMinutes: number;
  autoReassign: boolean;

  coldNudgeHours: number;

  coldReassignHours: number;

  autoCold: boolean;

  khongChuyenTay: boolean;

  maxShares: number;

  maxPushes: number;

  pushGapHours: number[];
  assignRule: "least_loaded" | "round_robin" | "weighted";

  weights: Record<string, number>;
  sourceRouting: Record<string, string>;

  excludeFromPool: string[];
};
export const DEFAULT_LEAD_CONFIG: LeadConfig = {
  slaMinutes: 15, reassignMinutes: 15, autoReassign: true,
  coldNudgeHours: 24, coldReassignHours: 48, autoCold: true, maxShares: 3,
  khongChuyenTay: true,
  maxPushes: 3, pushGapHours: [24, 48, 72],
  assignRule: "least_loaded", weights: {}, sourceRouting: {}, excludeFromPool: [],
};
export const LEAD_CONFIG_KEY = "leads_config";

export const GIO_BAT_DAU = 8;
export const GIO_KET_THUC = 21;

const gioVN = (t: number) => Number(new Date(t).toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", hour12: false }));

export function gioLamViec(tuMs: number, denMs: number): number {
  if (denMs <= tuMs) return 0;
  const BUOC = 15 * 60e3;
  let dem = 0;
  for (let t = tuMs; t < denMs; t += BUOC) {
    const g = gioVN(t);
    if (g >= GIO_BAT_DAU && g < GIO_KET_THUC) dem++;
  }
  return dem / 4;
}

export const RR_POINTER_KEY = "lead_rr_pointer";

export function docLeadConfig(raw: string | null): LeadConfig {
  try {
    const d = JSON.parse(raw || "{}");
    return {
      slaMinutes: Math.max(1, Number(d.slaMinutes) || DEFAULT_LEAD_CONFIG.slaMinutes),
      reassignMinutes: Math.max(1, Number(d.reassignMinutes) || DEFAULT_LEAD_CONFIG.reassignMinutes),
      autoReassign: d.autoReassign !== false,
      coldNudgeHours: Math.max(1, Number(d.coldNudgeHours) || DEFAULT_LEAD_CONFIG.coldNudgeHours),
      coldReassignHours: Math.max(2, Number(d.coldReassignHours) || DEFAULT_LEAD_CONFIG.coldReassignHours),
      autoCold: d.autoCold !== false,
      khongChuyenTay: d.khongChuyenTay !== false,
      maxShares: Math.max(1, Number(d.maxShares) || DEFAULT_LEAD_CONFIG.maxShares),
      maxPushes: Math.max(1, Number(d.maxPushes) || DEFAULT_LEAD_CONFIG.maxPushes),
      pushGapHours: Array.isArray(d.pushGapHours) && d.pushGapHours.length ? d.pushGapHours.map(Number) : DEFAULT_LEAD_CONFIG.pushGapHours,
      assignRule: d.assignRule === "round_robin" ? "round_robin" : d.assignRule === "weighted" ? "weighted" : "least_loaded",
      weights: d.weights && typeof d.weights === "object" ? d.weights : {},
      sourceRouting: d.sourceRouting && typeof d.sourceRouting === "object" ? d.sourceRouting : {},
      excludeFromPool: Array.isArray(d.excludeFromPool) ? d.excludeFromPool : [],
    };
  } catch { return { ...DEFAULT_LEAD_CONFIG }; }
}
export async function getLeadConfig(): Promise<LeadConfig> {
  try { return docLeadConfig(await getConfigValue(LEAD_CONFIG_KEY)); }
  catch { return { ...DEFAULT_LEAD_CONFIG }; }
}
export async function saveLeadConfig(cfg: Partial<LeadConfig>): Promise<void> {
  const cur = await getLeadConfig();
  await setConfigValue(LEAD_CONFIG_KEY, JSON.stringify({ ...cur, ...cfg }), "Cấu hình chia lead");
}

export const PANCAKE_LINKS_KEY = "pancake_thread_links";
export async function getPancakeThreadLinks(): Promise<Record<string, string>> {
  try {
    const raw = await getConfigValue(PANCAKE_LINKS_KEY);
    const m = JSON.parse(raw || "{}");
    return m && typeof m === "object" ? m : {};
  } catch { return {}; }
}

export type SaleLite = { id: string; name: string; position: string };
export async function activeSales(sb: any): Promise<SaleLite[]> {
  const { data } = await sb.from("users").select("id, full_name, position, active").eq("active", true);
  return (data || []).filter((u: any) => isSalePosition(u.position)).map((u: any) => ({ id: u.id, name: u.full_name || "", position: u.position || "" }));
}

export async function openCounts(sb: any, saleIds: string[]): Promise<Record<string, number>> {
  const m: Record<string, number> = {}; for (const id of saleIds) m[id] = 0;
  try {
    const { data } = await sb.from("leads").select("assignee_id").in("status", ["new", "contacted", "caring"]).not("assignee_id", "is", null);
    for (const r of data || []) if (r.assignee_id in m) m[r.assignee_id]++;
  } catch { }
  return m;
}

const chuanTen = (s: string) =>
  String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d")
    .toLowerCase().replace(/\s+/g, " ").trim();

export async function chuHoiThoaiZalo(sb: any, source?: string | null): Promise<string | null> {
  if (!chuanTen(String(source || "").replace(/^zalo\s*/i, ""))) return null;
  try {
    const { data } = await sb.from("users").select("id, full_name").eq("active", true);
    return khopChuHoiThoaiZalo(source, data || []);
  } catch { return null; }
}

export function khopChuHoiThoaiZalo(source: string | null | undefined, users: { id: string; full_name: string | null }[]): string | null {
  const ten = chuanTen(String(source || "").replace(/^zalo\s*/i, ""));
  if (!ten) return null;
  const hit = users.find((u) => chuanTen(u.full_name || "") === ten);
  return hit?.id || null;
}

export const laZalo = (l: any) => String(l?.channel || "").toLowerCase() === "zalo" || /^zalo\b/i.test(String(l?.source || ""));

export async function pickAssignee(sb: any, opts: { source?: string | null; product?: string | null; exclude?: string | null }): Promise<string | null> {
  const cfg = await getLeadConfig();
  const sales = await activeSales(sb);
  const pool = sales.filter((s) => s.id !== opts.exclude && !cfg.excludeFromPool.includes(s.id));
  if (!pool.length) return null;
  let rrLast: string | null = null;
  let counts: Record<string, number> = {};
  if (cfg.assignRule === "round_robin") {
    try { rrLast = (await getConfigValue(RR_POINTER_KEY)) || null; } catch { }
  } else {
    counts = await openCounts(sb, pool.map((s) => s.id));
  }
  const kq = chonSaleNhanLead({ sales, cfg, counts, source: opts.source, exclude: opts.exclude, rrLast });
  if (kq.vongLanLuot && kq.id) {
    try { await setConfigValue(RR_POINTER_KEY, kq.id, "Người vừa được chia lead (chia lần lượt)"); } catch { }
  }
  return kq.id;
}

export function chonSaleNhanLead(o: {
  sales: SaleLite[]; cfg: LeadConfig; counts: Record<string, number>;
  source?: string | null; exclude?: string | null; rrLast?: string | null;
}): { id: string | null; vongLanLuot: boolean } {
  const { cfg, counts } = o;

  const pool = o.sales.filter((s) => s.id !== o.exclude && !cfg.excludeFromPool.includes(s.id));
  if (!pool.length) return { id: null, vongLanLuot: false };
  if (o.source && cfg.sourceRouting[o.source]) {
    const forced = pool.find((s) => s.id === cfg.sourceRouting[o.source!]);
    if (forced) return { id: forced.id, vongLanLuot: false };
  }

  if (cfg.assignRule === "weighted") {
    const wOf = (id: string) => Math.max(0, Number(cfg.weights[id]) || 0);
    const eligible = pool.filter((s) => wOf(s.id) > 0);
    if (eligible.length) {
      const totalW = eligible.reduce((s, x) => s + wOf(x.id), 0);
      const totalN = eligible.reduce((s, x) => s + (counts[x.id] || 0), 0) + 1;
      let best = eligible[0], bestGap = -Infinity;
      for (const s of eligible) {
        const target = (wOf(s.id) / totalW) * totalN;
        const gap = target - (counts[s.id] || 0);
        if (gap > bestGap || (gap === bestGap && s.id.localeCompare(best.id) < 0)) { best = s; bestGap = gap; }
      }
      return { id: best.id, vongLanLuot: false };
    }

  }

  if (cfg.assignRule === "round_robin") {
    const order = [...pool].sort((a, b) => a.id.localeCompare(b.id));
    const i = o.rrLast ? order.findIndex((s) => s.id === o.rrLast) : -1;
    const next = order[(i + 1) % order.length];
    return { id: next.id, vongLanLuot: true };
  }

  const sorted = [...pool].sort((a, b) => (counts[a.id] || 0) - (counts[b.id] || 0) || a.id.localeCompare(b.id));
  return { id: sorted[0].id, vongLanLuot: false };
}

export function phaiGiuKhach(khongChuyenTay: boolean, nguoiGiuConLam: boolean): boolean {
  return khongChuyenTay && nguoiGiuConLam;
}

export async function insertAndAssign(
  sb: any,
  lead: Partial<Lead>,
  opts?: { notify?: boolean; assigneeId?: string; maNguon?: string | null },
): Promise<{ ok: boolean; id?: string; assignee_id?: string | null; dedup?: boolean; error?: string }> {
  try {
    if (lead.external_id) {
      const { data: ex } = await sb.from("leads").select("id, assignee_id").eq("external_id", lead.external_id).maybeSingle();
      if (ex) return { ok: true, id: ex.id, assignee_id: ex.assignee_id, dedup: true };
    }

    const assignee = opts?.assigneeId || (laZalo(lead) ? await chuHoiThoaiZalo(sb, lead.source) : null)
      || await pickAssignee(sb, { source: lead.source, product: lead.product });
    const now = new Date().toISOString();

    const maNguon = opts?.maNguon || docMaNguon(lead.note);
    const source = maNguon && lead.source ? themNhan(lead.source, nguonTuMa(maNguon)) : (lead.source || null);
    const row = {
      customer_name: lead.customer_name || null, phone: lead.phone || null, source,
      product: lead.product || null, channel: lead.channel || null, pancake_link: lead.pancake_link || null,
      external_id: lead.external_id || null, note: lead.note || null,
      assignee_id: assignee, assigned_at: assignee ? now : null, status: "new", share_count: 1,
      month: (lead.created_at || vnDateStr()).slice(0, 7),
    };
    const { data, error } = await sb.from("leads").insert(row).select("id, assignee_id").single();
    if (error) return { ok: false, error: error.message };

    try { const { guiLeadCapi } = await import("@/lib/meta-capi"); await guiLeadCapi({ id: data.id, phone: row.phone, created_at: now }); } catch {  }

    if (opts?.notify !== false) {
      try {

        let panFirst: string | null = null;
        try { if (lead.external_id) panFirst = (await getPancakeThreadLinks())[lead.external_id] || null; } catch { }
        const { notifyNewLead } = await import("@/lib/lead-notify");
        await notifyNewLead(sb, { id: data.id, customer_name: row.customer_name, phone: row.phone, source: row.source, channel: row.channel, pancake_link: row.pancake_link, pancake_thread_link: panFirst, note: row.note }, data.assignee_id, "new");
      } catch {  }
    }
    return { ok: true, id: data.id, assignee_id: data.assignee_id };
  } catch (e: any) { return { ok: false, error: String(e) }; }
}

export async function sweepReassign(sb: any): Promise<number> {
  try {
    const cfg = await getLeadConfig();
    if (!cfg.autoReassign) return 0;
    const cutoff = new Date(Date.now() - cfg.reassignMinutes * 60000).toISOString();

    const { ban: daCham } = await layDauVetCham(sb, 14);
    const panMap = await getPancakeThreadLinks();

    const conLam = new Set((await activeSales(sb)).map((s: any) => s.id));
    const { data } = await sb.from("leads").select("id, assignee_id, assigned_at, source, product, share_count, customer_name, phone, channel, pancake_link, external_id, note")
      .eq("status", "new").is("first_contact_at", null).lt("assigned_at", cutoff)

      .not("phone", "is", null)

      .lt("share_count", cfg.maxShares)
      .limit(200);
    let n = 0;
    for (const l of data || []) {

      if (laZalo(l)) continue;

      const vet = lanChamCuoi(daCham, (l as any).phone);
      if (vet && vet.at >= ((l as any).assigned_at || "")) {
        await sb.from("leads").update({ first_contact_at: vet.at, status: "contacted" }).eq("id", l.id);
        continue;
      }

      if (phaiGiuKhach(cfg.khongChuyenTay, conLam.has(l.assignee_id))) {
        try {
          const { pushToUsers } = await import("@/lib/push");
          await pushToUsers([l.assignee_id], {
            title: `Chưa ai chạm: ${(l as any).customer_name || (l as any).phone || "khách"}`,
            body: `Khách về ${cfg.reassignMinutes} phút rồi mà chưa có ai nhắn. Khách đang chờ bạn — vào chăm ngay.`,
            url: "/leads", tag: `chua-cham-${l.id}`, important: true,
          });
        } catch {  }

        await sb.from("leads").update({
          share_count: (l.share_count || 1) + 1,
          last_reassign_at: new Date().toISOString(),
        }).eq("id", l.id);
        n++;
        continue;
      }
      const next = await pickAssignee(sb, { source: l.source, product: l.product, exclude: l.assignee_id });
      if (!next || next === l.assignee_id) continue;
      const now = new Date().toISOString();
      await sb.from("leads").update({ assignee_id: next, assigned_at: now, last_reassign_at: now, share_count: (l.share_count || 1) + 1 }).eq("id", l.id);

      try {
        const { notifyNewLead } = await import("@/lib/lead-notify");
        await notifyNewLead(sb, { id: l.id, customer_name: (l as any).customer_name, phone: (l as any).phone, source: l.source, channel: (l as any).channel, pancake_link: (l as any).pancake_link, pancake_thread_link: panMap[(l as any).external_id] || null, note: (l as any).note }, next, "reassign");
      } catch {  }
      n++;
    }
    return n;
  } catch { return 0; }
}

export async function sweepLeadDrip(sb: any): Promise<{ dripped: number; perDay: number; perSale: Record<string, number> }> {
  const perSale: Record<string, number> = {};
  try {
    const { data: cfgRow } = await sb.from("config").select("value").eq("key", "lead_drip_per_day").maybeSingle();
    const perDay = Math.max(1, Number(cfgRow?.value) || 20);
    const { data } = await sb.from("leads")
      .select("id, assignee_id, created_at")
      .eq("status", "backlog").not("assignee_id", "is", null)
      .order("created_at", { ascending: true }).limit(3000);
    if (!data?.length) return { dripped: 0, perDay, perSale };
    const ids: string[] = [];
    for (const l of data) {
      const a = l.assignee_id as string;
      if ((perSale[a] || 0) >= perDay) continue;
      perSale[a] = (perSale[a] || 0) + 1;
      ids.push(l.id);
    }
    if (!ids.length) return { dripped: 0, perDay, perSale };
    const now = new Date().toISOString();
    await sb.from("leads").update({ status: "new", assigned_at: now }).in("id", ids);

    try {
      const { pushToUsers } = await import("@/lib/push");
      for (const [uid, n] of Object.entries(perSale)) {
        if (n <= 0) continue;
        await pushToUsers([uid], { title: `${n} khách Facebook cần nhắn hôm nay`, body: `Hệ thống vừa chuyển ${n} khách từ kho chờ vào danh sách của bạn. Vào nhắn để không bỏ sót.`, url: "/leads", tag: "lead-drip", important: false });
      }
    } catch {  }
    return { dripped: ids.length, perDay, perSale };
  } catch { return { dripped: 0, perDay: 0, perSale }; }
}

export async function autoTouchByExternalId(sb: any, externalId: string): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    const { data } = await sb.from("leads")
      .update({ first_contact_at: now, status: "contacted" })
      .eq("external_id", externalId).is("first_contact_at", null)
      .in("status", ["new", "contacted"])
      .select("id");
    return !!(data && data.length);
  } catch { return false; }
}

export async function markContacted(sb: any, leadId: string, saleId?: string): Promise<{ ok: boolean }> {
  const now = new Date().toISOString();
  const patch: any = { first_contact_at: now, status: "contacted" };
  await sb.from("leads").update(patch).eq("id", leadId).is("first_contact_at", null);
  return { ok: true };
}

export type SaleLeadStat = { id: string; name: string; total: number; contacted: number; onTime: number; onTimePct: number; avgRespMin: number | null; avgWaitMin: number | null; fast5: number; won: number; reassignedIn: number };

export async function leadStats(sb: any, month: string): Promise<{ perSale: SaleLeadStat[]; totalLeads: number; unassigned: number; overSla: number; reassignedLeads: number; slaMinutes: number; contacted: number; fast5: number; fast5Pct: number; avgWaitMin: number | null }> {
  const cfg = await getLeadConfig();
  const sales = await activeSales(sb);
  const byId: Record<string, SaleLite> = {}; for (const s of sales) byId[s.id] = s;
  let rows: Lead[] = [];
  try {
    const { data } = await sb.from("leads").select("*").eq("month", month).limit(5000);
    rows = data || [];
  } catch { }
  const agg: Record<string, SaleLeadStat> = {};
  const ensure = (id: string) => (agg[id] ??= { id, name: byId[id]?.name || "(khác)", total: 0, contacted: 0, onTime: 0, onTimePct: 0, avgRespMin: null, avgWaitMin: null, fast5: 0, won: 0, reassignedIn: 0 });
  let unassigned = 0, overSla = 0, reassignedLeads = 0;
  const respSum: Record<string, number> = {}, respN: Record<string, number> = {};
  const waitSum: Record<string, number> = {}, waitN: Record<string, number> = {};
  let contactedAll = 0, fast5All = 0, waitSumAll = 0, waitNAll = 0;
  const now = Date.now();
  for (const l of rows) {
    if (l.share_count > 1) reassignedLeads++;
    if (!l.assignee_id) { unassigned++; continue; }
    const a = ensure(l.assignee_id); a.total++;
    if (l.share_count > 1) a.reassignedIn++;
    if (l.status === "won") a.won++;
    if (l.first_contact_at && l.assigned_at) {
      a.contacted++; contactedAll++;
      const mins = (new Date(l.first_contact_at).getTime() - new Date(l.assigned_at).getTime()) / 60000;
      respSum[l.assignee_id] = (respSum[l.assignee_id] || 0) + mins; respN[l.assignee_id] = (respN[l.assignee_id] || 0) + 1;
      if (mins <= cfg.slaMinutes) a.onTime++;

      if (l.created_at) {
        const wait = (new Date(l.first_contact_at).getTime() - new Date(l.created_at).getTime()) / 60000;
        if (wait >= 0) {
          waitSum[l.assignee_id] = (waitSum[l.assignee_id] || 0) + wait; waitN[l.assignee_id] = (waitN[l.assignee_id] || 0) + 1;
          waitSumAll += wait; waitNAll++;
          if (wait <= 5) { a.fast5++; fast5All++; }
        }
      }
    } else if (l.status === "new" && l.assigned_at) {
      const mins = (now - new Date(l.assigned_at).getTime()) / 60000;
      if (mins > cfg.slaMinutes) overSla++;
    }
  }
  const perSale = Object.values(agg).map((a) => ({
    ...a,
    onTimePct: a.contacted ? Math.round((a.onTime / a.contacted) * 100) : 0,
    avgRespMin: respN[a.id] ? Math.round((respSum[a.id] / respN[a.id]) * 10) / 10 : null,
    avgWaitMin: waitN[a.id] ? Math.round((waitSum[a.id] / waitN[a.id]) * 10) / 10 : null,
  })).sort((x, y) => y.total - x.total);
  return {
    perSale, totalLeads: rows.length, unassigned, overSla, reassignedLeads, slaMinutes: cfg.slaMinutes,
    contacted: contactedAll, fast5: fast5All,
    fast5Pct: contactedAll ? Math.round((fast5All / contactedAll) * 100) : 0,
    avgWaitMin: waitNAll ? Math.round((waitSumAll / waitNAll) * 10) / 10 : null,
  };
}

export async function sweepColdLeads(sb: any): Promise<{ nudged: number; reassigned: number }> {
  const out = { nudged: 0, reassigned: 0 };
  try {
    const cfg = await getLeadConfig();
    if (!cfg.autoCold) return out;

    const nudgeAt = new Date(Date.now() - cfg.coldNudgeHours * 3600e3).toISOString();
    const panMap = await getPancakeThreadLinks();
    const { data: leads } = await sb.from("leads")
      .select("id, assignee_id, customer_name, phone, source, product, channel, pancake_link, external_id, note, share_count, first_contact_at")
      .in("status", ["contacted", "caring"])
      .not("assignee_id", "is", null)
      .lt("first_contact_at", nudgeAt)
      .limit(200);
    if (!leads?.length) return out;

    const { ban: daCham } = await layDauVetCham(sb, Math.ceil(cfg.coldReassignHours / 24) + 7);
    const conLam = new Set((await activeSales(sb)).map((s: any) => s.id));

    const now = Date.now();
    for (const l of leads) {
      const anchor = lanChamCuoi(daCham, l.phone)?.at || l.first_contact_at;
      if (!anchor) continue;

      const hours = gioLamViec(new Date(anchor).getTime(), now);

      if (hours >= cfg.coldReassignHours && !laZalo(l)) {

        if (phaiGiuKhach(cfg.khongChuyenTay, conLam.has(l.assignee_id))) {
          try {
            const { pushToUsers } = await import("@/lib/push");
            await pushToUsers([l.assignee_id], {
              title: `Khách nguội ${Math.round(hours)}h: ${l.customer_name || l.phone || "khách"}`,
              body: "Khách này vẫn là của bạn, không ai lấy mất. Nhưng để lâu là mất khách thật — gọi hoặc nhắn lại hôm nay.",
              url: "/leads", tag: `cold-${l.id}`, important: true,
            });
          } catch {  }
          out.nudged++;
          continue;
        }
        const next = await pickAssignee(sb, { source: l.source, product: l.product, exclude: l.assignee_id });
        if (!next || next === l.assignee_id) continue;
        const iso = new Date().toISOString();
        await sb.from("leads").update({
          assignee_id: next, assigned_at: iso, last_reassign_at: iso,
          status: "new", first_contact_at: null,
          share_count: (l.share_count || 1) + 1,
        }).eq("id", l.id);
        try {
          const { notifyNewLead } = await import("@/lib/lead-notify");
          await notifyNewLead(sb, {
            id: l.id, customer_name: l.customer_name, phone: l.phone, source: l.source,
            channel: l.channel, pancake_link: l.pancake_link, pancake_thread_link: panMap[(l as any).external_id] || null,
            note: `Khách nguội ${Math.round(hours)}h không có động tĩnh — chuyển sang bạn`,
          }, next, "reassign");
        } catch {  }
        out.reassigned++;
        continue;
      }

      if (hours >= cfg.coldNudgeHours) {
        const left = Math.max(1, Math.round(cfg.coldReassignHours - hours));
        try {
          const { pushToUsers } = await import("@/lib/push");
          await pushToUsers([l.assignee_id], {
            title: `Khách nguội: ${l.customer_name || l.phone || "khách"}`,
            body: cfg.khongChuyenTay
              ? `${Math.round(hours)}h chưa có động tĩnh. Khách vẫn của bạn — chăm sớm giúp khách còn nhớ mình.`
              : `${Math.round(hours)}h chưa có động tĩnh. Còn ${left}h nữa hệ thống chuyển sang sale khác.`,
            url: "/leads", tag: `cold-${l.id}`, important: true,
          });
        } catch {  }
        out.nudged++;
      }
    }
  } catch {  }
  return out;
}

export async function reportStuckLeads(sb: any): Promise<number> {
  try {
    const cfg = await getLeadConfig();
    const { data } = await sb.from("leads")
      .select("id, customer_name, phone, assignee_id, share_count, created_at")
      .eq("status", "new").is("first_contact_at", null).gte("share_count", cfg.maxShares).limit(200);
    if (!data?.length) return 0;

    const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const { data: wm } = await sb.from("config").select("value").eq("key", "lead_stuck_reported").maybeSingle();
    if ((wm?.value || "") === today) return 0;

    const { data: users } = await sb.from("users").select("id, full_name");
    const nameOf = (id: string | null) => (users || []).find((u: any) => u.id === id)?.full_name || "chưa gán";
    const by: Record<string, number> = {};
    for (const l of data) by[nameOf(l.assignee_id)] = (by[nameOf(l.assignee_id)] || 0) + 1;
    const oldest = Math.max(...data.map((l: any) => (Date.now() - new Date(l.created_at).getTime()) / 3600e3));

    const lines = [
      `\u{26A0} <b>${data.length} KHACH KHONG AI NHAN</b>`,
      cfg.khongChuyenTay
        ? `Da doc nguoi dang giu du ${cfg.maxShares} lan ma van chua ai cham. May DUNG nhac — can giao tay.`
        : `Da chuyen tay du ${cfg.maxShares} lan ma chua ai cham. He thong DUNG chuyen — can giao tay.`,
      `Khach cho lau nhat: <b>${Math.round(oldest)} gio</b>`,
      ``,
      `Dang dung ten (ngau nhien do vong chuyen dung o do):`,
      ...Object.entries(by).sort((a, b) => b[1] - a[1]).map(([n, c]) => `\u{2022} ${tgEscape(n)} — ${c} khach`),
      ``,
      `Xem & giao tay: ${appLink("/leads")}`,
    ];
    const { sendTelegram } = await import("@/lib/telegram");
    await sendTelegram(lines.join("\n"));
    await sb.from("config").upsert({ key: "lead_stuck_reported", value: today }, { onConflict: "key" });
    return data.length;
  } catch { return 0; }
}

const PUSH_PLAYBOOK = [
  { goal: "Xin số điện thoại & chốt đơn",
    how: "Khách đã nghe tư vấn rồi. Chốt bằng một câu hỏi dễ gật: hỏi xin SĐT để gửi thông tin, hoặc hỏi khách muốn nhận hàng ở đâu. Đừng hỏi 'anh/chị thấy sao' — câu đó dễ bị lơ." },
  { goal: "Đổi góc: gợi ý thứ khác phù hợp hơn (cross-sell)",
    how: "Khách im có thể vì món đầu chưa đúng nhu cầu. Nhắc lại ĐÚNG điều khách từng than, rồi gợi ý một lựa chọn KHÁC — đừng nhắc lại y cái cũ." },
  { goal: "Hạ ngưỡng: gói nhỏ hơn để khách thử (down-sell)",
    how: "Cơ hội cuối. Có thể khách ngại số tiền. Đề xuất gói nhỏ / lẻ 1 hộp để dùng thử. Bán được 1 hộp còn hơn mất khách." },
];

export async function sweepPushCycle(sb: any): Promise<{ nudged: number; reassigned: number; skipped?: string }> {
  const out = { nudged: 0, reassigned: 0 } as { nudged: number; reassigned: number; skipped?: string };
  try {
    const cfg = await getLeadConfig();
    const { data: leads, error } = await sb.from("leads")
      .select("id, assignee_id, customer_name, phone, source, product, channel, pancake_link, external_id, note, share_count, push_count, last_push_at, product_suggested, first_contact_at")
      .in("status", ["contacted", "caring"]).not("assignee_id", "is", null).limit(200);

    if (error) return { ...out, skipped: "chưa có cột push_count (migration 041 chưa chạy)" };
    if (!leads?.length) return out;

    const panMap = await getPancakeThreadLinks();

    const { ban: daCham } = await layDauVetCham(sb, 30);
    const conLam = new Set((await activeSales(sb)).map((s: any) => s.id));
    const now = Date.now();
    for (const l of leads) {
      const n = Number(l.push_count) || 0;
      const vet = lanChamCuoi(daCham, l.phone)?.at || "";
      const moc = l.last_push_at || l.first_contact_at || "";
      const anchor = vet > moc ? vet : moc;
      if (!anchor) continue;

      const hours = gioLamViec(new Date(anchor).getTime(), now);

      if (!l.product_suggested) {
        if (hours < 12) continue;
        try {
          const { pushToUsers } = await import("@/lib/push");
          await pushToUsers([l.assignee_id], {
            title: `Chưa chào hàng: ${l.customer_name || l.phone || "khách"}`,
            body: `Đã ${Math.round(hours)}h từ lúc chạm mà chưa gợi ý sản phẩm nào. Khách đang chờ.`,
            url: "/leads", tag: `nosug-${l.id}`, important: true,
          });
        } catch { }
        out.nudged++;
        continue;
      }

      if (n >= cfg.maxPushes) {

        if (phaiGiuKhach(cfg.khongChuyenTay, conLam.has(l.assignee_id))) {
          try {
            const { pushToUsers } = await import("@/lib/push");
            await pushToUsers([l.assignee_id], {
              title: `Đã thử ${cfg.maxPushes} lần: ${l.customer_name || l.phone || "khách"}`,
              body: "Khách vẫn im sau 3 góc tiếp cận. Mang ca này ra hỏi leader để tìm góc khác, đừng bỏ rơi.",
              url: "/leads", tag: `kho-${l.id}`, important: true,
            });
          } catch { }
          out.nudged++;
          continue;
        }

        const next = await pickAssignee(sb, { source: l.source, product: l.product, exclude: l.assignee_id });
        if (!next || next === l.assignee_id) continue;
        const iso = new Date().toISOString();
        await sb.from("leads").update({
          assignee_id: next, assigned_at: iso, last_reassign_at: iso,
          status: "new", first_contact_at: null, push_count: 0, last_push_at: null,
          share_count: (l.share_count || 1) + 1,
        }).eq("id", l.id);
        try {
          const { notifyNewLead } = await import("@/lib/lead-notify");
          await notifyNewLead(sb, {
            id: l.id, customer_name: l.customer_name, phone: l.phone, source: l.source,
            channel: l.channel, pancake_link: l.pancake_link, pancake_thread_link: panMap[(l as any).external_id] || null,
            note: `Người trước đã chào hàng và push ${cfg.maxPushes} lần, khách vẫn im. Bạn thử góc khác xem.`,
          }, next, "reassign");
        } catch { }
        out.reassigned++;
        continue;
      }

      const gap = cfg.pushGapHours[Math.min(n, cfg.pushGapHours.length - 1)] || 24;
      if (hours < gap) continue;

      const play = PUSH_PLAYBOOK[Math.min(n, PUSH_PLAYBOOK.length - 1)];
      try {
        const { pushToUsers } = await import("@/lib/push");
        await pushToUsers([l.assignee_id], {
          title: `Lần ${n + 1}/${cfg.maxPushes} — ${l.customer_name || l.phone || "khách"}: ${play.goal}`,
          body: play.how,
          url: "/leads", tag: `push-${l.id}`, important: true,
        });
      } catch { }
      await sb.from("leads").update({ push_count: n + 1, last_push_at: new Date().toISOString() }).eq("id", l.id);
      out.nudged++;
    }
  } catch {  }
  return out;
}
