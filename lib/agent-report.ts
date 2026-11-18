import { getServiceClient } from "@/lib/supabase-server";
import { sendTelegram, telegramConfigured, tgEscape } from "@/lib/telegram";
import { appLink } from "@/lib/app-url";
import { vnDateStr } from "@/lib/payroll";
import { computeRevenueLoop } from "@/lib/revenue-loop";
import { getFails } from "@/lib/campaign-memory";
import { getBriefs } from "@/lib/dispatch";

const CFG = async (key: string): Promise<any> => {
  const sb = getServiceClient();
  try { const v = (await sb.from("config").select("value").eq("key", key).maybeSingle()).data?.value; return v ? JSON.parse(v) : null; } catch { return null; }
};
const ageText = (iso?: string): string => {
  if (!iso) return "chưa có";
  const h = (Date.now() - new Date(iso).getTime()) / 3600e3;
  if (!isFinite(h)) return "chưa có";
  if (h < 1) return "vừa xong";
  if (h < 48) return `${Math.round(h)}h trước`;
  return `${Math.round(h / 24)} ngày trước`;
};
const vnd = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n || 0)) + "đ";
const lightDot = (l: string) => (l === "green" ? "\u{1F7E2}" : l === "red" ? "\u{1F534}" : "\u{1F7E1}");

export const MASTER_NAME = "Trợ lý AI";

export type AgentKey = "research" | "content" | "design" | "performance" | "dispatch" | "memory" | "plan" | "strategy" | "report";

export function matchAgentKey(text: string): AgentKey | "list" | null {
  const t = (text || "").toLowerCase().trim();
  if (/^(agent|tr[oợ] l[yý] mkt|c[aá]c agent|danh s[aá]ch agent)\b/.test(t)) return "list";
  if (/nghi[eê]n c[uứ]u|research|đ[oố]i th[uủ]|th[iị] tr[uườ]ng/.test(t)) return "research";
  if (/hi[eệ]u su[aấ]t|performance|qu[aả]ng c[aá]o|\bads?\b| roas|chi ti[eê]u/.test(t)) return "performance";
  if (/chi[eế]n d[iị]ch|dispatch|đi[eề]u ph[oố]i/.test(t)) return "dispatch";
  if (/n[oộ]i dung|content|nh[aà] m[aá]y b[aà]i|vi[eế]t b[aà]i/.test(t)) return "content";
  if (/thi[eế]t k[eế]|design|[aả]nh|carousel/.test(t)) return "design";
  if (/tr[ií] nh[oớ]|campaign memory|b[aà]i fail|b[aà]i h[oỏ]ng/.test(t)) return "memory";
  if (/k[eế] ho[aạ]ch|v[oò]ng l[aặ]p|doanh thu/.test(t)) return "plan";
  if (/chi[eế]n l[uượ]c|bsc|b[aả]n đ[oồ]/.test(t)) return "strategy";
  if (/b[aá]o c[aá]o|b[aả]n tin|gi[aá]m đ[oố]c/.test(t)) return "report";
  return null;
}

async function gather() {
  const month = vnDateStr().slice(0, 7);
  const [research, cf, ads, spendRaw, briefs, fails, loop] = await Promise.all([
    CFG("mkt_research"),
    CFG("content_factory_last"),
    CFG("ads_campaigns"),
    CFG(`mkt_spend_${month}`).catch(() => null),
    getBriefs().catch(() => []),
    getFails().catch(() => []),
    computeRevenueLoop(month).catch(() => null as any),
  ]);

  let todayN = 0, todayImg = 0;
  try {
    const sb = getServiceClient();
    const { data } = await sb.from("content_items").select("id").eq("publish_date", vnDateStr()).eq("status", "draft");
    todayN = (data || []).length;

  } catch { }
  if (cf?.date === vnDateStr()) { todayN = Math.max(todayN, Number(cf.n || 0)); }
  return { month, research, cf, ads, spend: spendRaw ? Number(String(spendRaw).replace(/\D/g, "")) : 0, briefs, fails, loop, todayN, todayImg };
}

type G = Awaited<ReturnType<typeof gather>>;

const AGENT_TAG: Record<AgentKey, { icon: string; name: string; role: string }> = {
  strategy: { icon: "\u{1F9ED}", name: "Chiến lược", role: "bản đồ mục tiêu & đèn" },
  plan: { icon: "\u{1F4CA}", name: "Kế hoạch", role: "vòng lặp doanh thu" },
  research: { icon: "\u{1F52C}", name: "Research", role: "nghiên cứu thị trường" },
  content: { icon: "\u{1F4DD}", name: "Content", role: "nhà máy bài" },
  design: { icon: "\u{1F3A8}", name: "Design", role: "ảnh & logo" },
  performance: { icon: "\u{1F4C8}", name: "Performance", role: "quảng cáo Meta" },
  dispatch: { icon: "\u{1F3AF}", name: "Dispatch", role: "điều phối chiến dịch" },
  memory: { icon: "\u{1F9E0}", name: "Campaign Memory", role: "trí nhớ bài fail" },
  report: { icon: "\u{1F305}", name: "Báo cáo", role: "bản tin điều hành" },
};

function bodyFor(key: AgentKey, g: G): string {
  switch (key) {
    case "research": {
      const at = g.research?.at ? String(g.research.at).slice(0, 10) : null;
      return at ? `nghiên cứu tuần cập nhật ${at}` : "chưa có dữ liệu (tự chạy Chủ Nhật hằng tuần)";
    }
    case "content":
      return g.cf?.date === vnDateStr() ? `đã tạo ${g.cf?.n || 0} bài hôm nay` : `chưa tạo hôm nay (lần cuối ${ageText(g.cf?.at)})`;
    case "design":
      return "ảnh + logo NOVA tự động mỗi bài (đa tỉ lệ feed/vuông/story)";
    case "performance": {
      if (!g.ads && !g.spend) return "chưa kéo được số (kiểm token Meta)";
      const nCamp = Array.isArray(g.ads?.campaigns) ? g.ads.campaigns.length : 0;
      return `chi ${vnd(g.spend)}/tháng · ${nCamp} chiến dịch · cập nhật ${ageText(g.ads?.generatedAt)}`;
    }
    case "dispatch": {
      const last = g.briefs?.[0];
      if (!last) return "chưa chạy chiến dịch nào (vào /dispatch để giao)";
      const camp = (g.briefs || []).filter((b: any) => b.campaign === last.campaign);
      const pass = camp.filter((b: any) => b.status === "passed").length;
      const fail = camp.filter((b: any) => b.status === "failed").length;
      return `"${tgEscape(String(last.campaign).slice(0, 40))}" — ${pass} đạt / ${fail} trượt`;
    }
    case "memory":
      return `đang nhớ ${g.fails?.length || 0} bài FAIL để tránh lặp`;
    case "plan":
      return g.loop ? `${lightDot(g.loop.finLight)} nhịp ${g.loop.pacePct}% (kỳ vọng ${g.loop.expectedPct}%) · dự phóng ${g.loop.projectedPct}%` : "chưa tính được";
    case "strategy": {
      if (!g.loop) return "chưa tính được";
      const q = g.loop.quarter;
      return `${lightDot(g.loop.finLight)} DT tháng ${vnd(g.loop.monthActual)}/${vnd(g.loop.monthTarget)}${q ? ` · ${q.label} ${q.pct != null ? q.pct + "%" : "—"}` : ""}`;
    }
    case "report":
      return "bản tin sáng/chiều/CN gửi tự động";
  }
}

function lineFor(key: AgentKey, g: G): string {
  const t = AGENT_TAG[key];
  return `${t.icon} <b>${t.name}</b> <i>(${t.role})</i>: ${bodyFor(key, g)}`;
}

export async function latestAgentReport(key: AgentKey | "list"): Promise<string> {
  if (key === "list") {
    return `\u{1F916} <b>8 agent MKT</b> — gõ tên để xem báo cáo:\n` +
      `• <b>research</b> — nghiên cứu thị trường\n• <b>nội dung</b> — nhà máy bài\n• <b>thiết kế</b> — ảnh/carousel\n` +
      `• <b>hiệu suất</b> — quảng cáo Meta\n• <b>chiến dịch</b> — điều phối Dispatch\n• <b>trí nhớ</b> — bài fail\n` +
      `• <b>kế hoạch</b> — vòng lặp doanh thu\n• <b>chiến lược</b> — bản đồ BSC\n• <b>báo cáo</b> — bản tin`;
  }
  const g = await gather();
  switch (key) {
    case "research": {
      if (!g.research?.summary) return "\u{1F52C} <b>Research</b>\nChưa có dữ liệu — agent tự chạy Chủ Nhật hằng tuần, kết quả sẽ về đây.";
      return `\u{1F52C} <b>Research — nghiên cứu thị trường</b> (cập nhật ${String(g.research.at || "").slice(0, 10)})\n\n${tgEscape(String(g.research.summary).slice(0, 3200))}`;
    }
    case "performance": {
      if (!g.ads && !g.spend) return "\u{1F4C8} <b>Performance</b>\nChưa cắm token Meta (FB_ADS_TOKEN + FB_AD_ACCOUNT) trên Vercel → chưa kéo được số quảng cáo. Cắm xong em kéo chi tiêu/CPO từng chiến dịch về ngay.";
      const camps = (Array.isArray(g.ads?.campaigns) ? g.ads.campaigns : []).slice(0, 6);
      const lines = camps.map((c: any) => `• ${tgEscape(String(c.name).slice(0, 32))}: ${vnd(c.spend)} · ${c.results || 0} ${c.rtype || ""}${c.cpo ? ` · CPO ${vnd(c.cpo)}` : ""}`);
      return `\u{1F4C8} <b>Performance — quảng cáo Meta</b> (cập nhật ${ageText(g.ads?.generatedAt)})\nTổng chi tháng: <b>${vnd(g.spend)}</b>\n${lines.join("\n") || "(chưa có chiến dịch đang chạy)"}\n\n<a href="${appLink("/do-luong-mkt")}">Xem chi tiết</a>`;
    }
    case "dispatch": {
      if (!g.briefs?.length) return "\u{1F3AF} <b>Dispatch</b>\nChưa chạy chiến dịch nào. Vào /dispatch để giao 1 chiến dịch.";
      const byCamp = new Map<string, any[]>();
      for (const b of g.briefs.slice(0, 40)) { const k = b.campaign; if (!byCamp.has(k)) byCamp.set(k, []); byCamp.get(k)!.push(b); }
      const blocks = Array.from(byCamp.entries()).slice(0, 5).map(([camp, arr]) => {
        const pass = arr.filter((b) => b.status === "passed").length, fail = arr.filter((b) => b.status === "failed").length, wait = arr.filter((b) => b.status === "waiting").length;
        return `• <b>${tgEscape(camp.slice(0, 40))}</b>: ${pass} đạt / ${fail} trượt${wait ? ` / ${wait} chờ` : ""}`;
      });
      return `\u{1F3AF} <b>Dispatch — điều phối</b>\n${blocks.join("\n")}\n\n<a href="${appLink("/dispatch")}">Mở Dispatch</a>`;
    }
    case "content":
      return `\u{1F4DD} <b>Content — nhà máy bài</b>\n${g.cf?.date === vnDateStr() ? `Hôm nay đã tạo ${g.cf?.n || 0} bài nháp.` : `Lần tạo gần nhất: ${ageText(g.cf?.at)} (${g.cf?.n || 0} bài).`}\nChờ duyệt hôm nay: ${g.todayN} bài.\n\n<a href="${appLink("/content")}">Xem pipeline</a> · gõ "tạo bài" để tạo ngay.`;
    case "design":
      return `\u{1F3A8} <b>Design — ảnh cho bài</b>\nMỗi bài tự vẽ ảnh (Gemini → dự phòng Pollinations free) + dán logo NOVA. Đã ép ảnh tĩnh vật để hết vỡ méo. Đang mở rộng đa tỉ lệ (feed/vuông/story) + carousel.`;
    case "memory": {
      if (!g.fails?.length) return "\u{1F9E0} <b>Campaign Memory</b>\nChưa ghi bài fail nào. Khi 1 bài bị bỏ khi duyệt / dính từ cấm, em nhớ để không viết lại kiểu đó.";
      const lines = g.fails.slice(0, 10).map((f: any) => `• "${tgEscape(String(f.title).slice(0, 50))}" — ${tgEscape(String(f.reason).slice(0, 60))}`);
      return `\u{1F9E0} <b>Campaign Memory — ${g.fails.length} bài FAIL đang tránh</b>\n${lines.join("\n")}`;
    }
    case "plan": {
      if (!g.loop) return "\u{1F4CA} <b>Kế hoạch</b>\nChưa tính được vòng lặp doanh thu.";
      return `\u{1F4CA} <b>Kế hoạch — vòng lặp doanh thu (${g.month})</b>\n${lightDot(g.loop.finLight)} Nhịp ${g.loop.pacePct}% (kỳ vọng ${g.loop.expectedPct}%) · dự phóng ${g.loop.projectedPct}%\nDT: ${vnd(g.loop.monthActual)} / mục tiêu ${vnd(g.loop.monthTarget)}\nCần thêm: ${g.loop.needLeads} lead · ngân sách ads đề xuất ${vnd(g.loop.budgetNeeded)}\n\n<a href="${appLink("/vong-lap-doanh-thu")}">Mở vòng lặp</a>`;
    }
    case "strategy": {
      if (!g.loop) return "\u{1F9ED} <b>Chiến lược</b>\nChưa tính được.";
      const q = g.loop.quarter;
      return `\u{1F9ED} <b>Chiến lược — bản đồ (${g.month})</b>\n${lightDot(g.loop.finLight)} DT tháng ${vnd(g.loop.monthActual)} / ${vnd(g.loop.monthTarget)} (${g.loop.pacePct}% nhịp)${q ? `\n${q.label}: ${vnd(q.actual)} / ${vnd(q.target)}${q.pct != null ? ` (${q.pct}%)` : ""}` : ""}\n%MKT: ${g.loop.mktPct == null ? "chưa có" : g.loop.mktPct + "%"} ${lightDot(g.loop.mktLight)}\n\n<a href="${appLink("/ban-do-chien-luoc")}">Mở bản đồ chiến lược</a>`;
    }
    case "report":
      return `\u{1F305} <b>Báo cáo</b>\nBản tin Tổng giám đốc gửi tự động: sáng 7:30, chiều 21:00, chiến lược tuần CN 8:00. Xem <a href="${appLink("/giam-doc-ai")}">Giám đốc AI</a>.`;
  }
}

export async function mktDigest(): Promise<{ ok: boolean; sent: boolean; error?: string }> {
  if (!telegramConfigured()) return { ok: false, sent: false, error: "chưa cắm TELEGRAM_BOT_TOKEN/CHAT_ID" };
  const g = await gather();

  const warns: string[] = [];
  if (g.loop?.finLight === "red") warns.push(`\u{1F534} <b>Doanh thu ĐÈN ĐỎ</b>: nhịp ${g.loop.pacePct}% dưới kỳ vọng ${g.loop.expectedPct}%`);
  if (g.loop?.mktLight === "red") warns.push(`\u{1F534} <b>%Chi phí MKT vượt trần</b>: ${g.loop.mktPct}%`);
  if (!g.ads && !g.spend) warns.push(`\u{26A0} Performance chưa cắm token Meta — chưa đo được quảng cáo`);

  const order: AgentKey[] = ["strategy", "plan", "research", "content", "design", "performance", "dispatch", "memory", "report"];
  const body = [
    `\u{1F4CA} <b>BẢN TIN MKT</b> — ${vnDateStr()}`,
    `<i>Em là ${MASTER_NAME}, trợ lý điều hành. Em tổng hợp báo cáo 8 agent gửi anh:</i>`,
    ...(warns.length ? ["", ...warns] : []),
    "",
    ...order.map((k) => lineFor(k, g)),
    "",
    `— <b>${MASTER_NAME}</b> tổng hợp · <a href="${appLink("/he-dieu-hanh-ai")}">Bản đồ Hệ điều hành AI</a>. Anh nhắn tên agent cho em để nghe chi tiết từng phòng.`,
  ].join("\n");

  const r = await sendTelegram(body);
  return { ok: true, sent: !!r.ok };
}
