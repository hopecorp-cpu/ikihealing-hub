import { requireAdmin } from "@/lib/auth-server";
import { getServiceClient } from "@/lib/supabase-server";
import { vnDateStr } from "@/lib/payroll";
import { getLivestreamSessions } from "./actions";
import { LivestreamClient } from "./client";

export const dynamic = "force-dynamic";

export default async function LivestreamPage({ searchParams }: { searchParams: { m?: string } }) {
  await requireAdmin();
  const month = searchParams.m ?? vnDateStr().slice(0, 7);
  const sb = getServiceClient();
  const { data: users } = await sb.from("users")
    .select("id, full_name, position")
    .eq("active", true)
    .order("full_name");

  const eligible = (users ?? []).filter((u: any) => /(sale|mkt|marketing|trực page|tư vấn|media|content)/i.test(u.position || ""));
  const { ready, rows } = await getLivestreamSessions(month);

  return <LivestreamClient month={month} users={eligible.length ? eligible : (users ?? [])} rows={rows} ready={ready} />;
}
