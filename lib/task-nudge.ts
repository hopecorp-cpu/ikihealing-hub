import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { layDauVetCham } from "@/lib/dau-vet-cham";
import { getLeadConfig } from "@/lib/leads";
import { computeReportReconcile } from "@/lib/report-reconcile";
import { vnDateStr } from "@/lib/payroll";
import { appLink } from "@/lib/app-url";

const STALE_CARING_DAYS = 2;
const COLD_DAYS = 7;
const RENUDGE_MS = 2 * 3600e3;

type Pending = { total: number; overdue: number; stale: number; noReport: boolean; daCham: number; khongSdt: number };

const tagOf = (name: string, tgId?: string) => {
  const id = (tgId || "").trim();
  return /^\d+$/.test(id) ? `<a href="tg://user?id=${id}">${esc(name)}</a>` : `<b>${esc(name)}</b>`;
};
const esc = (s: string) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const readJson = async (k: string): Promise<any> => { try { return JSON.parse((await getConfigValue(k)) || "null"); } catch { return null; } };

const sdt = (p: any) => String(p || "").replace(/\D/g, "").replace(/^84/, "0");

async function layHet(build: () => any): Promise<any[]> {
  const out: any[] = [];
  for (let f = 0; f < 20000; f += 1000) {
    const { data, error } = await build().range(f, f + 999);
    if (error || !data?.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

async function loadTouched(sb: any): Promise<Map<string, string>> {
  const { ban } = await layDauVetCham(sb, 90);
  return new Map([...ban].map(([k, v]) => [k, v.at]));
}

export async function buildSaleNudge(sb: any, opts?: { includeReports?: boolean }): Promise<{ ok: boolean; text?: string; tagged: number; skipped?: string }> {
  const cfg = await getLeadConfig();
  const now = Date.now();
  const today = vnDateStr();

  const { data: users } = await sb.from("users").select("id, full_name, active").eq("active", true);
  const nameById: Record<string, string> = {};
  const idByName: Record<string, string> = {};
  for (const u of users || []) { nameById[u.id] = u.full_name || ""; idByName[(u.full_name || "").trim().toLowerCase()] = u.id; }
  const tgMap: Record<string, string> = (await readJson("sale_tg_chat")) || {};

  const pend: Record<string, Pending> = {};
  const ensure = (uid: string) => (pend[uid] ??= { total: 0, overdue: 0, stale: 0, noReport: false, daCham: 0, khongSdt: 0 });

  const touched = await loadTouched(sb);

  {
    const slaCut = new Date(now - cfg.slaMinutes * 60000).toISOString();
    const freshCut = new Date(now - COLD_DAYS * 864e5).toISOString();
    const data = await layHet(() => sb.from("leads").select("assignee_id, assigned_at, phone").eq("status", "new").not("assignee_id", "is", null).gte("assigned_at", freshCut));
    for (const l of data) {
      const p = ensure(l.assignee_id);
      const k = sdt(l.phone);
      if (!k) { p.khongSdt++; continue; }
      if (touched.has(k)) { p.daCham++; continue; }
      p.total++;
      if (l.assigned_at && l.assigned_at < slaCut) p.overdue++;
    }
  }

  {
    const staleCut = new Date(now - STALE_CARING_DAYS * 864e5).toISOString();
    const data = await layHet(() => sb.from("leads").select("assignee_id, first_contact_at, assigned_at, phone").in("status", ["contacted", "caring"]).not("assignee_id", "is", null));
    for (const l of data) {
      const thuc = touched.get(sdt(l.phone)) || "";
      const anchor = [l.first_contact_at || "", l.assigned_at || "", thuc].sort().pop();
      if (anchor && anchor < staleCut) ensure(l.assignee_id).stale++;
    }
  }

  if (opts?.includeReports) {
    try {
      const rc = await computeReportReconcile(sb, today);
      for (const nr of rc.notReported || []) {
        const uid = idByName[(nr.name || "").trim().toLowerCase()];
        if (uid) ensure(uid).noReport = true;
      }
    } catch { }
  }

  const state: Record<string, { hash: string; at: number }> = (await readJson("sale_nudge_state")) || {};
  const lines: string[] = [];
  const newState = { ...state };
  let tagged = 0;

  for (const uid of Object.keys(pend)) {
    const p = pend[uid];
    const bits: string[] = [];
    if (p.total > 0) bits.push(`${p.total} lead chưa liên hệ${p.overdue ? ` (${p.overdue} quá hạn)` : ""}`);
    if (p.stale > 0) bits.push(`${p.stale} khách đang chăm bỏ quên >${STALE_CARING_DAYS} ngày`);
    if (p.khongSdt > 0) bits.push(`${p.khongSdt} tin nhắn Facebook chưa có số điện thoại (máy không kiểm chứng được)`);
    if (p.noReport) bits.push(`chưa nộp báo cáo hôm nay`);
    if (!bits.length) continue;

    if (p.daCham > 0) bits.push(`<i>(đã trừ ${p.daCham} khách anh/chị nhắn rồi)</i>`);

    const hash = `${p.total}|${p.overdue}|${p.stale}|${p.noReport}|${p.khongSdt}`;
    const prev = state[uid];

    if (prev && prev.hash === hash && now - prev.at < RENUDGE_MS) continue;

    lines.push(`• ${tagOf(nameById[uid] || "sale", tgMap[uid])}: ${bits.join(" · ")}`);
    newState[uid] = { hash, at: now };
    tagged++;
  }

  await setConfigValue("sale_nudge_state", JSON.stringify(newState), "Trạng thái đốc việc sale (chống nhắc trùng)");

  if (!lines.length) return { ok: true, tagged: 0, skipped: "không ai có việc tồn (hoặc đã nhắc gần đây)" };

  const text = `\u{1F514} <b>Trợ lý đốc việc</b> — việc còn tồn, mời các anh chị xử lý:\n\n${lines.join("\n")}\n\n`
    + `\u{1F449} Lead cần liên hệ: ${appLink("/leads")}\n`
    + `\u{1F449} Nộp báo cáo cuối ngày: ${appLink("/daily-report")}\n\n`
    + `Bấm thẳng vào đường link ở trên là mở đúng trang, không phải tìm menu. Bấm nút “Đã liên hệ” xong là hết nhắc nhé.`;
  return { ok: true, text, tagged };
}

export async function buildLeadBacklog(sb: any): Promise<string> {
  const coldCut = new Date(Date.now() - COLD_DAYS * 864e5).toISOString();
  const { data: users } = await sb.from("users").select("id, full_name");
  const nm: Record<string, string> = {};
  for (const u of users || []) nm[u.id] = u.full_name || "";
  const { data } = await sb.from("leads").select("assignee_id, assigned_at").eq("status", "new").lt("assigned_at", coldCut).limit(5000);
  const rows = data || [];
  if (!rows.length) return "\u{2705} Không có lead đọng — mọi lead chưa liên hệ đều còn trong 7 ngày.";
  const agg: Record<string, { count: number; oldest: string }> = {};
  for (const l of rows) {
    const k = l.assignee_id || "unassigned";
    const a = (agg[k] ??= { count: 0, oldest: l.assigned_at || "" });
    a.count++;
    if (l.assigned_at && (!a.oldest || l.assigned_at < a.oldest)) a.oldest = l.assigned_at;
  }
  const lines = Object.entries(agg).sort((a, b) => b[1].count - a[1].count)
    .map(([k, v]) => `• ${esc(nm[k] || "(chưa gán)")}: <b>${v.count}</b> lead (cũ nhất ${(v.oldest || "").slice(5, 10)})`);
  return `\u{1F9F9} <b>LEAD ĐỌNG >${COLD_DAYS} ngày chưa liên hệ</b> — tổng ${rows.length}:\n${lines.join("\n")}\n\nRà tại /leads: liên hệ lại hoặc đánh dấu "mất" để dọn. Lead đọng = tiền ads đã đổ mà chưa gọi.`;
}
