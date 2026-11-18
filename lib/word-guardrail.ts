import "server-only";
import { getServiceClient } from "@/lib/supabase-server";
import { BANNED_REPLACEMENTS, findBanned } from "@/lib/banned-words";

export type WordLesson = { phrase: string; safe: string; count: number };
export type TeamWordGuard = { days: number; weekViol: number; accountsAffected: number; lessons: WordLesson[] };

function safeFor(phrase: string): string {
  for (const { re, to } of BANNED_REPLACEMENTS) if (new RegExp(re.source, "i").test(phrase)) return to;
  return "nói theo thói quen sống lành mạnh (hỗ trợ/chăm sóc), không hứa kết quả";
}

export async function getTeamWordGuard(days = 7): Promise<TeamWordGuard> {
  const sb = getServiceClient();
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const { data } = await sb.from("salework_chat_analysis")
    .select("account_id, tags, weaknesses, suggestions, missed")
    .gte("analyzed_at", since);
  const rows = data || [];
  const isViol = (r: any) => Array.isArray(r.tags) && r.tags.some((t: string) => /^VI PH[ẠA]M/i.test(t));
  const viol = rows.filter(isViol);
  const accounts = new Set(viol.map((r: any) => r.account_id));

  const tally: Record<string, number> = {};
  for (const r of viol) {
    const text = [...(r.weaknesses || []), ...(r.suggestions || []), ...(r.missed || [])].join(" ");
    for (const p of findBanned(text)) tally[p] = (tally[p] || 0) + 1;
  }
  const lessons = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([phrase, count]) => ({ phrase, safe: safeFor(phrase), count }));
  return { days, weekViol: viol.length, accountsAffected: accounts.size, lessons };
}
