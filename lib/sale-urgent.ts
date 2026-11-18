import { getServiceClient } from "@/lib/supabase-server";
import { getConfigValue } from "@/lib/app-config";
import { isManagerOrAbove, isSalePosition } from "@/lib/auth";
import { vnDateStr } from "@/lib/payroll";
import { getSaleByAccount } from "@/lib/sale-accounts";

export type SaleUrgent = { unreplied: number; oldestHours: number; oldestName: string; careToday: number; callsToday: number; fbTotal: number; fbInbox: number; fbComment: number; fbOldestHours: number; coachCount: number; coachViol: number };

const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").trim();
const match = (a: string, b: string) => a === b || (a && b && (a.includes(b) || b.includes(a)));

export async function getMySaleUrgent(user: any): Promise<SaleUrgent | null> {
  if (!user || isManagerOrAbove(user.role) || !isSalePosition(user.position)) return null;
  const me = norm(user.full_name);
  const today = vnDateStr();

  let unreplied = 0, oldestHours = 0, oldestName = "";
  try {
    const u = JSON.parse((await getConfigValue("sale_unreplied")) || "{}");
    for (const s of (u.bySale || [])) { if (match(norm(s.sale), me)) { unreplied = s.count || 0; oldestHours = s.oldestHours || 0; oldestName = s.oldestName || ""; break; } }
  } catch { }

  let fbTotal = 0, fbInbox = 0, fbComment = 0, fbOldestHours = 0;
  try {
    const f = JSON.parse((await getConfigValue("fb_unreplied")) || "{}");
    fbTotal = f.total || 0; fbInbox = f.inbox || 0; fbComment = f.comment || 0; fbOldestHours = f.oldestHours || 0;
  } catch { }

  let callsToday = 0;
  try {
    const cl = JSON.parse((await getConfigValue("call_log")) || "{}");
    for (const [sale, v] of Object.entries(cl[today] || {})) { if (match(norm(sale), me)) callsToday += typeof v === "number" ? v : ((v as any)?.n || 0); }
  } catch { }

  let careToday = 0;
  try {
    const sb = getServiceClient();
    const { data } = await sb.from("customer_care_log").select("sale_name").eq("last_contact", today);
    for (const r of data || []) if (match(norm(r.sale_name || ""), me)) careToday++;
  } catch { }

  let coachCount = 0, coachViol = 0;
  try {
    const myWords = me.split(/\s+/);
    const saleMap = await getSaleByAccount();

    const accts = Object.entries(saleMap).map(([acc, name]) => ({ acc, words: norm(name).split(/\s+/).filter(Boolean) }));
    const mine = accts.filter((a) => a.words.some((w) => myWords.includes(w)));
    if (mine.length) {
      const sb = getServiceClient();

      const { data } = await sb.from("salework_chat_analysis").select("score, tags").in("account_id", mine.map((a) => a.acc)).gte("analyzed_at", `${today}T00:00:00`);
      for (const r of data || []) {
        const viol = Array.isArray(r.tags) && r.tags.some((t: string) => /^VI PH[ẠA]M/i.test(t));
        if (viol || (r.score ?? 10) <= 5) coachCount++;
        if (viol) coachViol++;
      }
    }
  } catch { }

  return { unreplied, oldestHours, oldestName, careToday, callsToday, fbTotal, fbInbox, fbComment, fbOldestHours, coachCount, coachViol };
}
