import "server-only";
import { getConfigNumber } from "@/lib/app-config";
import { lyDoDung } from "@/lib/dung-khan-cap";

const G = "https://graph.facebook.com/v21.0";
const adsToken = () => (process.env.FB_ADS_TOKEN || process.env.FB_USER_TOKEN || "").trim();
export const adsControlConfigured = () => !!adsToken();

export function adAccount() {
  let a = (process.env.FB_AD_ACCOUNT || "000000000000000").trim();
  if (!/^act_/.test(a)) a = "act_" + a.replace(/\D/g, "");
  return a;
}

export type AdCampaign = { id: string; name: string; status: string; dailyBudget: number; spend: number };

export async function listCampaigns(): Promise<{ ok: boolean; campaigns?: AdCampaign[]; error?: string }> {
  const token = adsToken();
  if (!token) return { ok: false, error: "Chưa cắm token Meta (FB_ADS_TOKEN/FB_USER_TOKEN)" };
  try {
    const flds = `id,name,effective_status,daily_budget,insights.date_preset(this_month){spend}`;
    const j: any = await (await fetch(`${G}/${adAccount()}/campaigns?fields=${encodeURIComponent(flds)}&limit=100&access_token=${encodeURIComponent(token)}`, { cache: "no-store" })).json();
    if (j?.error) return { ok: false, error: j.error.message || j.error.code };
    const campaigns: AdCampaign[] = (j.data || []).map((c: any) => ({
      id: c.id, name: c.name, status: c.effective_status,
      dailyBudget: Math.round(Number(c.daily_budget || 0)),
      spend: Math.round(Number(c.insights?.data?.[0]?.spend || 0)),
    })).sort((a: AdCampaign, b: AdCampaign) => b.spend - a.spend);
    return { ok: true, campaigns };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}

async function post(id: string, fields: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
  const token = adsToken();
  if (!token) return { ok: false, error: "Chưa cắm FB_ADS_TOKEN" };
  try {
    const body = new URLSearchParams({ ...fields, access_token: token });
    const r = await fetch(`${G}/${id}`, { method: "POST", body, cache: "no-store" });
    const j: any = await r.json().catch(() => ({}));
    if (j?.error) return { ok: false, error: j.error.message || j.error.code || "lỗi Graph API" };
    return { ok: !!(j?.success ?? true) };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}

export async function setCampaignStatus(id: string, status: "PAUSED" | "ACTIVE") {

  if (status === "ACTIVE") { const dung = await lyDoDung("quang_cao"); if (dung) return { ok: false, error: dung }; }
  return post(id, { status });
}

export async function getCampaignBudget(id: string): Promise<number | null> {
  const token = adsToken();
  if (!token) return null;
  try {
    const j: any = await (await fetch(`${G}/${id}?fields=daily_budget&access_token=${encodeURIComponent(token)}`, { cache: "no-store" })).json();
    if (j?.error) return null;
    return Math.round(Number(j.daily_budget || 0)) || null;
  } catch { return null; }
}

export async function adjustCampaignBudget(id: string, deltaPct: number): Promise<{ ok: boolean; newBudget?: number; oldBudget?: number; error?: string; capped?: boolean }> {
  const cur = await getCampaignBudget(id);
  if (cur == null || cur <= 0) return { ok: false, error: "Không đọc được ngân sách hiện tại (chiến dịch có thể đặt ngân sách ở nhóm QC, không ở cấp chiến dịch)" };

  if (deltaPct > 0) { const dung = await lyDoDung("quang_cao"); if (dung) return { ok: false, error: dung, oldBudget: cur }; }
  let next = Math.round((cur * (1 + deltaPct / 100)) / 1000) * 1000;
  if (next < 10000) next = 10000;

  let capped = false;
  const cap = await getConfigNumber("ads_max_daily_budget", 1_000_000);
  if (deltaPct > 0 && cap > 0 && next > cap) {
    if (cur >= cap) return { ok: false, error: `Đã chạm trần ngân sách ${cap.toLocaleString("vi-VN")}đ/ngày — không tăng thêm (đổi trần ở config ads_max_daily_budget).`, oldBudget: cur };
    next = Math.floor(cap / 1000) * 1000; capped = true;
  }
  const r = await post(id, { daily_budget: String(next) });
  return r.ok ? { ok: true, newBudget: next, oldBudget: cur, capped } : { ok: false, error: r.error, oldBudget: cur };
}
