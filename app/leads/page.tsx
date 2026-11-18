import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { tuChoiBod } from "@/lib/auth-server";
import { isManagerOrAbove, isSalePosition } from "@/lib/auth";
import { sweepReassign, leadStats, getLeadConfig, activeSales, getPancakeThreadLinks, type Lead } from "@/lib/leads";
import { vnDateStr } from "@/lib/payroll";
import { layNhatKyCham, sdt0, type DongCham } from "@/lib/quiz-cham-soc";
import { maCtvTuGhiChu } from "@/lib/affiliate-don";
import LeadsClient from "./LeadsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chia lead | IKIHEALING Hub" };

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  tuChoiBod(user);
  const canSeeAll = isManagerOrAbove(user.role);
  if (!canSeeAll && !isSalePosition((user as any).position)) redirect("/?denied=leads");

  const sb = getServiceClient();

  await sweepReassign(sb).catch(() => { });

  const month = vnDateStr().slice(0, 7);

  const docLead = async (): Promise<{ leads: Lead[]; tableReady: boolean }> => {
    try {
      let q = sb.from("leads").select("*").order("assigned_at", { ascending: false, nullsFirst: false }).limit(200);
      if (!canSeeAll) q = q.eq("assignee_id", (user as any).id);
      const { data, error } = await q;
      return error ? { leads: [], tableReady: false } : { leads: data || [], tableReady: true };
    } catch { return { leads: [], tableReady: false }; }
  };
  const docTen = async () => {
    const m: Record<string, string> = {};
    try { const { data } = await sb.from("users").select("id, full_name"); for (const u of data || []) m[u.id] = u.full_name || ""; } catch { }
    return m;
  };
  const [{ leads, tableReady }, panMap, sales, idMap, stats, cfg] = await Promise.all([
    docLead(),
    getPancakeThreadLinks().catch(() => null),
    activeSales(sb),
    docTen(),
    leadStats(sb, month),
    getLeadConfig(),
  ]);

  if (panMap) for (const l of leads) (l as any).pancake_thread_link = panMap[(l as any).external_id] || null;

  for (const l of leads) (l as any).ma_ctv = maCtvTuGhiChu((l as any).note) || null;

  let nhatKy: Record<string, DongCham[]> = {};
  try {
    const phones = [...new Set(leads.map((l: any) => sdt0(l.phone)).filter(Boolean))] as string[];
    if (phones.length) nhatKy = await layNhatKyCham(sb, phones);
  } catch { nhatKy = {}; }

  return (
    <LeadsClient
      leads={leads as any} sales={sales} idMap={idMap} stats={stats} cfg={cfg} nhatKy={nhatKy}
      canSeeAll={canSeeAll} meId={(user as any).id} tableReady={tableReady} month={month}
    />
  );
}
