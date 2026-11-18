import { getServiceClient } from "@/lib/supabase-server";
import { BRAND_DNA_FULL } from "@/lib/brand-dna";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { askGemini, geminiConfigured } from "@/lib/gemini";
import { findBanned } from "@/lib/banned-words";
import { vnDateStr } from "@/lib/payroll";
import { generateDrafts, persistDraft, pushDraftsToCEO, type SavedDraft } from "@/lib/content-factory";
import { getContentPlan } from "@/lib/content-plan-server";
import { buildSlots, FUNNEL_GOAL, FUNNEL_LABEL, type Funnel, type Slot } from "@/lib/content-plan";
import { recordFail } from "@/lib/campaign-memory";
import { addAgentLearning } from "@/lib/agent-learning";
import { sendTelegram, tgEscape } from "@/lib/telegram";

export type BriefType = "content" | "design" | "performance";
export type BriefStatus = "briefed" | "qa" | "passed" | "failed" | "published" | "waiting";
export type DispatchBrief = {
  id: string;
  campaign: string;
  type: BriefType;
  goal: string;
  funnel?: Funnel;
  channel?: string;
  status: BriefStatus;
  contentItemId?: string;
  qaNotes?: string;
  createdAt: string;
  updatedAt: string;
};

const KEY = "dispatch_log";
const MAX = 120;
let _seq = 0;
const newId = () => `br_${Date.now().toString(36)}_${(++_seq).toString(36)}`;

export async function getBriefs(): Promise<DispatchBrief[]> {
  try { const raw = await getConfigValue(KEY); if (raw) { const o = JSON.parse(raw); if (Array.isArray(o?.briefs)) return o.briefs; } } catch { }
  return [];
}
async function saveBriefs(briefs: DispatchBrief[]): Promise<void> {
  await setConfigValue(KEY, JSON.stringify({ briefs: briefs.slice(0, MAX), updatedAt: new Date().toISOString() }));
}
async function addBriefs(items: DispatchBrief[]): Promise<void> {
  const cur = await getBriefs();
  await saveBriefs([...items, ...cur]);
}

export async function runQaGate(title: string, body: string): Promise<{ pass: boolean; notes: string; banned: string[] }> {
  const banned = findBanned(`${title} ${body}`);
  if (banned.length) return { pass: false, notes: `Dính từ cấm (luật TPBS): ${banned.join(", ")}`, banned };
  if (!geminiConfigured()) return { pass: true, notes: "Qua chốt từ cấm (chưa cắm Gemini để chấm sâu)", banned: [] };
  try {
    const sys = `Bạn là CỬA QA nội dung của ACME Corp. Đối chiếu bài đăng dưới đây với DNA thương hiệu sau:

${BRAND_DNA_FULL}

Chấm theo 4 tiêu chí:
1. LUẬT: không phạm bất kỳ điều nào trong phần luật pháp lý ở trên. Người viết là HUẤN LUYỆN VIÊN sức khoẻ, KHÔNG phải bác sĩ.
2. TÊN GỌI: gọi đúng tên thương hiệu, đúng danh xưng, đúng giá niêm yết (sai giá hoặc sai tên Học Viện = TRƯỢT).
3. GIỌNG: ấm, tử tế, có chiều sâu; kể chuyện/nỗi đau lối sống; không giật gân, không sáo rỗng.
4. ĐỊNH VỊ: không hạ ACME xuống thành "chỗ bán thực phẩm bổ sung" — ta là hệ sinh thái chăm sóc sức khoẻ chủ động (app + cộng đồng + sản phẩm + học viện).
CHỈ trả JSON: {"pass": true/false, "reason": "ngắn gọn vì sao đạt/trượt"}`;
    const r = await askGemini(sys, [], `Tiêu đề: ${title}\n\nNội dung:\n${body.slice(0, 2500)}`, { maxOutputTokens: 300, temperature: 0.2 });
    if (!r.ok) return { pass: true, notes: "Chấm sâu lỗi → tạm cho qua (đã qua chốt từ cấm)", banned: [] };
    const m = String(r.text).match(/\{[\s\S]*\}/);
    const j = m ? JSON.parse(m[0]) : { pass: true, reason: "" };
    return { pass: j.pass !== false, notes: String(j.reason || "").slice(0, 160), banned: [] };
  } catch {
    return { pass: true, notes: "Chấm sâu lỗi → tạm cho qua (đã qua chốt từ cấm)", banned: [] };
  }
}

export type CampaignInput = { campaign: string; goal: string; channel?: string; funnel?: Funnel; nContent: number };

export async function suggestCampaign(month?: string): Promise<{ input: CampaignInput; rationale: string; gap: number; needLeads: number; budget: number }> {
  const { computeRevenueLoop } = await import("@/lib/revenue-loop");
  const m = month || vnDateStr().slice(0, 7);
  const loop: any = await computeRevenueLoop(m).catch(() => null);
  if (!loop) return { input: { campaign: `Chiến dịch ${m}`, goal: "Tăng đơn trong tháng", funnel: "MOFU", channel: "Facebook", nContent: 3 }, rationale: "Chưa đọc được vòng lặp doanh thu → dùng mặc định.", gap: 0, needLeads: 0, budget: 0 };
  const gap = Math.max(0, loop.needGap || 0);
  const needLeads = loop.needLeads || 0;
  const budget = loop.budgetNeeded || 0;
  const behind = loop.finLight === "red" || loop.pacePct < loop.expectedPct - 5;

  const funnel: Funnel = behind ? "BOFU" : (loop.pacePct >= loop.expectedPct + 5 ? "TOFU" : "MOFU");
  const nContent = Math.min(5, Math.max(2, Math.round(needLeads / 40) || 3));
  const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n || 0)) + "đ";
  const goal = behind
    ? `Chốt gap doanh thu ${fmt(gap)} còn thiếu tháng ${m} — đẩy ưu đãi tặng quà, nhắc khách đang cân nhắc.`
    : `Nuôi phễu & mở rộng tệp cho ${loop.quarter?.label || "quý"} — kéo lead mới, kể chuyện lối sống.`;
  const rationale = `${loop.quarter?.label || "Quý"}: ${fmt(loop.quarter?.actual || 0)}/${fmt(loop.quarter?.target || 0)}${loop.quarter?.pct != null ? ` (${loop.quarter.pct}%)` : ""}. Tháng ${m}: nhịp ${loop.pacePct}% vs kỳ vọng ${loop.expectedPct}% → ${behind ? "CHẬM, ưu tiên chốt (BOFU)" : "ổn, nuôi phễu"}. Cần ~${needLeads} lead, ngân sách ads đề xuất ${fmt(budget)}.`;
  return { input: { campaign: `${behind ? "Chốt gap" : "Nuôi phễu"} ${m}`, goal, channel: "Facebook", funnel, nContent }, rationale, gap, needLeads, budget };
}

export async function runCampaign(input: CampaignInput): Promise<{ ok: boolean; passed: number; failed: number; error?: string }> {
  const n = Math.min(5, Math.max(1, input.nContent || 2));
  const campaign = input.campaign.trim() || `Chiến dịch ${vnDateStr()}`;
  const now = new Date().toISOString();

  let slots: Slot[];
  if (input.funnel) {
    const plan = await getContentPlan();
    const pillars = plan.pillars.filter((p) => p.funnel === input.funnel).map((p) => p.name);
    slots = Array.from({ length: n }, (_, i) => ({
      pillar: pillars.length ? pillars[i % pillars.length] : FUNNEL_LABEL[input.funnel!],
      funnel: input.funnel!, funnelLabel: FUNNEL_LABEL[input.funnel!], goal: FUNNEL_GOAL[input.funnel!],
    }));
  } else {
    slots = buildSlots(await getContentPlan(), n, new Date().getDate());
  }

  const g = await generateDrafts(n, slots);
  if (!g.ok) return { ok: false, passed: 0, failed: 0, error: g.error };

  const sb = getServiceClient();
  const briefs: DispatchBrief[] = [];
  const passedItems: SavedDraft[] = [];
  let passed = 0, failed = 0;
  for (let i = 0; i < g.drafts.length; i++) {
    const d = g.drafts[i];
    const slot = slots[i];
    const body = [d.hook, d.body, d.cta].join("\n");
    const qa = await runQaGate(d.title, body);
    const base = { id: newId(), campaign, type: "content" as BriefType, goal: input.goal || slot?.goal || "", funnel: slot?.funnel, channel: input.channel, createdAt: now, updatedAt: new Date().toISOString() };
    if (qa.pass) {
      const item = await persistDraft(sb, { ...d, pillar: slot?.pillar || d.pillar }, { campaign, funnel: slot?.funnel, qaNote: "đạt" });
      if (item) { passedItems.push(item); passed++; briefs.push({ ...base, status: "passed", contentItemId: item.id, qaNotes: qa.notes }); }
      else briefs.push({ ...base, status: "failed", qaNotes: "lưu bài lỗi" });
    } else {
      failed++;
      await recordFail(d.title, `Cửa QA trượt: ${qa.notes || qa.banned.join(", ")}`);
      await addAgentLearning("dispatch", `Bài "${d.title}" trượt Cửa QA: ${qa.notes || qa.banned.join(", ")} → tránh brief kiểu này`, "fail");
      briefs.push({ ...base, status: "failed", qaNotes: qa.notes || qa.banned.join(", ") });
    }
  }

  const withImg = passedItems.filter((it) => it.imageUrl).length;
  briefs.push({ id: newId(), campaign, type: "design", goal: "Vẽ ảnh + logo cho bài", channel: input.channel, status: passed ? "passed" : "waiting", qaNotes: `Đã vẽ ${withImg}/${passed} ảnh (Pollinations/Gemini + logo NOVA)`, createdAt: now, updatedAt: now });
  briefs.push({ id: newId(), campaign, type: "performance", goal: "Chạy & tối ưu quảng cáo", channel: input.channel, status: "waiting", qaNotes: "Cần cắm token Meta để đóng vòng ROAS", createdAt: now, updatedAt: now });

  await addBriefs(briefs);
  if (passedItems.length) await pushDraftsToCEO(passedItems);

  const summary = `\u{1F3AF} <b>Dispatch — chiến dịch xong</b>\n"${tgEscape(campaign)}"${input.funnel ? ` · phễu ${input.funnel}` : ""}\n${passed} bài ĐẠT (đã đẩy anh duyệt) · ${failed} trượt${withImg ? ` · ${withImg} ảnh` : ""}`;
  await sendTelegram(summary).catch(() => { });
  return { ok: true, passed, failed };
}
