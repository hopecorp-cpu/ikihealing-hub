import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { getFunnel } from "@/lib/funnel";

const KEY = "google_ads_daily";

export type AdsCampaign = {
  name: string;
  cost: number;
  clicks: number;
  cpc: number;
  impr: number;
  conv: number;
  status?: string;
};
export type AdsDay = {
  date: string;
  campaigns: AdsCampaign[];
  totals: { cost: number; clicks: number; conv: number; cpc: number };
};

export function num(v: any): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = parseInt(String(v ?? "").replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

export function computeTotals(cs: AdsCampaign[]) {
  const cost = cs.reduce((s, c) => s + num(c.cost), 0);
  const clicks = cs.reduce((s, c) => s + num(c.clicks), 0);
  const conv = cs.reduce((s, c) => s + num(c.conv), 0);
  const cpc = clicks > 0 ? Math.round(cost / clicks) : 0;
  return { cost, clicks, conv, cpc };
}

export function normalizeDay(input: { date?: string; campaigns: any[] }): AdsDay {
  const campaigns: AdsCampaign[] = (input.campaigns || []).map((c) => ({
    name: String(c.name || "").trim() || "(không tên)",
    cost: num(c.cost),
    clicks: num(c.clicks),
    cpc: num(c.cpc),
    impr: num(c.impr ?? c.impressions),
    conv: num(c.conv ?? c.conversions),
    status: c.status ? String(c.status).trim() : undefined,
  }));
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(input.date || ""))
    ? String(input.date)
    : yesterdayVN();
  return { date, campaigns, totals: computeTotals(campaigns) };
}

function yesterdayVN(): string {
  const now = new Date(Date.now() + 7 * 3600 * 1000);
  now.setUTCDate(now.getUTCDate() - 1);
  return now.toISOString().slice(0, 10);
}

export async function getHistory(): Promise<AdsDay[]> {
  const raw = await getConfigValue(KEY);
  try {
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export async function saveAdsDay(day: AdsDay): Promise<void> {
  return saveAdsDays([day]);
}

export async function saveAdsDays(days: AdsDay[]): Promise<void> {
  if (!days.length) return;
  const hist = await getHistory();
  for (const day of days) {
    const i = hist.findIndex((d) => d.date === day.date);
    if (i >= 0) hist[i] = day; else hist.push(day);
  }
  hist.sort((a, b) => (a.date < b.date ? -1 : 1));
  const cutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().slice(0, 10); })();
  const pruned = hist.filter((d) => d.date >= cutoff);
  await setConfigValue(KEY, JSON.stringify(pruned), "Lịch sử Google Ads hằng ngày (số cào từ giao diện)");
}

export async function ngayConThieu(nDays = 7): Promise<string[]> {
  const hist = await getHistory();
  const co = new Set(hist.map((d) => d.date));
  const out: string[] = [];
  const now = new Date(Date.now() + 7 * 3600 * 1000);
  for (let i = 1; i <= nDays; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const s = d.toISOString().slice(0, 10);
    if (!co.has(s)) out.push(s);
  }
  return out.sort();
}

function pctStr(cur: number, prev: number): string {
  if (prev <= 0) return cur > 0 ? "mới có số" : "0%";
  const d = Math.round(((cur - prev) / prev) * 100);
  return (d >= 0 ? "+" : "") + d + "%";
}
function vnd(n: number) { return Math.round(n).toLocaleString("vi-VN") + "đ"; }

function avgTotals(hist: AdsDay[], excludeDate: string, n: number) {
  const rows = hist.filter((d) => d.date !== excludeDate).slice(-n);
  if (!rows.length) return null;
  const cost = rows.reduce((s, d) => s + d.totals.cost, 0) / rows.length;
  const clicks = rows.reduce((s, d) => s + d.totals.clicks, 0) / rows.length;
  const conv = rows.reduce((s, d) => s + d.totals.conv, 0) / rows.length;
  return { cost, clicks, conv, days: rows.length };
}

const QUIZ_RE = /quiz|th[eể]\s*tr[aạ]ng|the\s*trang|the\s*tang|đông\s*y|dong\s*y/i;

/**
 * Dựng báo cáo text (tiếng Việt, KHÔNG markdown/emoji — gửi Telegram).
 * @param latest ngày mới nhất cần báo; null = lấy ngày cuối trong lịch sử.
 */
export async function buildAdsReport(latest?: AdsDay | null): Promise<string> {
  const hist = await getHistory();
  const day = latest || hist[hist.length - 1] || null;
  if (!day) {
    return "BAO CAO GOOGLE ADS\n\nChua co du lieu nao duoc luu. Task cao so sang nay chua chay hoac chua gui ve. Anh mo Chrome roi cho em chay lai.";
  }
  const out: string[] = [];
  out.push(`BÁO CÁO GOOGLE ADS — ngày ${day.date}`);
  out.push(`(Trợ lý AI tổng hợp; số đọc từ giao diện Google Ads)`);
  out.push("");

  out.push("Từng chiến dịch:");
  for (const c of day.campaigns) {
    const parts = [
      `${vnd(c.cost)}`,
      `${c.clicks} nhấp`,
      `CPC ${vnd(c.cpc || (c.clicks ? Math.round(c.cost / c.clicks) : 0))}`,
      `${c.impr.toLocaleString("vi-VN")} hiển thị`,
    ];
    if (c.conv > 0) parts.push(`${c.conv} chuyển đổi`);
    let line = `- ${c.name}: ${parts.join(" · ")}`;
    if (c.status && !/active|đang chạy|eligible/i.test(c.status)) line += `  [${c.status}]`;
    out.push(line);
  }
  out.push("");

  const t = day.totals;
  out.push(`TỔNG: ${vnd(t.cost)} · ${t.clicks} nhấp · CPC TB ${vnd(t.cpc)} · ${t.conv} chuyển đổi`);
  const prevDay = hist.filter((d) => d.date < day.date).slice(-1)[0];
  if (prevDay) {
    const p = prevDay.totals;
    out.push(`So HÔM TRƯỚC (${prevDay.date}): chi phí ${pctStr(t.cost, p.cost)} · nhấp ${pctStr(t.clicks, p.clicks)} · chuyển đổi ${pctStr(t.conv, p.conv)}`);
  } else {
    out.push("So hôm trước: chưa có ngày trước để đối chiếu (đây là ngày đầu lưu lịch sử).");
  }
  const a7 = avgTotals(hist, day.date, 7);
  if (a7) {
    out.push(`So TB ${a7.days} ngày gần nhất: chi phí ${pctStr(t.cost, a7.cost)} · nhấp ${pctStr(t.clicks, a7.clicks)} · chuyển đổi ${pctStr(t.conv, a7.conv)}`);
  }
  out.push("");

  try {
    const f7 = await getFunnel(7);
    const q = f7["quiz"] || {};
    const qView = q["view"] || 0, qLead = q["lead"] || 0, qPaid = q["paid"] || 0;
    if (qView + qLead + qPaid > 0) {
      out.push("Vòng khép kín — phễu Quiz 7 ngày (ads trỏ /quiz):");
      out.push(`- Vào quiz ${qView} → để lại lead ${qLead} → thanh toán ${qPaid}`);

      const quizCost7 = hist.slice(-7).reduce((s, d) =>
        s + d.campaigns.filter((c) => QUIZ_RE.test(c.name)).reduce((ss, c) => ss + c.cost, 0), 0);
      if (quizCost7 > 0 && qLead > 0) {
        out.push(`- Chi phí ads quiz 7 ngày ${vnd(quizCost7)} ÷ ${qLead} lead ≈ ${vnd(Math.round(quizCost7 / qLead))}/lead`);
      }
      out.push("  (Ước tính: chỉ chiến dịch quiz mới trỏ /quiz; các campaign blog trỏ bài viết nên không tính vào đây.)");
      out.push("");
    }
  } catch {  }

  const notes: string[] = [];
  if (t.clicks === 0) notes.push("Chưa có nhấp nào — kiểm tra từ khoá/ngân sách/trạng thái duyệt chiến dịch.");
  if (t.conv > 0) notes.push(`Có ${t.conv} chuyển đổi — khi đủ ~1-2 tuần chuyển đổi ổn định nên cân nhắc đổi giá thầu sang Tối đa hoá chuyển đổi.`);
  if (prevDay && t.cost > prevDay.totals.cost * 1.2 && t.conv <= prevDay.totals.conv) {
    notes.push("Chi phí tăng >20% nhưng chuyển đổi chưa theo kịp — rà từ khoá đắt / nội dung trang đích.");
  }
  const paused = day.campaigns.filter((c) => c.status && /paus|dừng|tạm/i.test(c.status));
  if (paused.length) notes.push(`Đang tạm dừng: ${paused.map((c) => c.name).join(", ")}.`);
  const limited = day.campaigns.filter((c) => c.status && /limit|giới hạn|thiếu/i.test(c.status));
  if (limited.length) notes.push(`Bị giới hạn: ${limited.map((c) => c.name).join(", ")} — xem lại từ khoá/ngân sách.`);
  if (notes.length) out.push("Nhận xét: " + notes.join(" "));

  const isActive = (s?: string) => !s || /active|đang chạy|eligible/i.test(s);
  const agg: Record<string, { name: string; impr: number; clicks: number; cost: number; conv: number; status?: string }> = {};
  for (const d of hist.slice(-7)) for (const c of d.campaigns) {
    const k = c.name;
    (agg[k] ??= { name: k, impr: 0, clicks: 0, cost: 0, conv: 0, status: c.status });
    agg[k].impr += c.impr; agg[k].clicks += c.clicks; agg[k].cost += c.cost; agg[k].conv += c.conv; agg[k].status = c.status;
  }
  const rows = Object.values(agg);
  const props: string[] = [];
  for (const c of rows) {
    if (!isActive(c.status)) continue;
    if (c.clicks >= 20 && c.conv === 0) props.push(`"${c.name}" 7 ngày: ${c.clicks} nhấp / ${vnd(c.cost)} mà 0 chuyển đổi → rà trang đích/CTA lấy email; nếu vẫn 0 sau vài ngày thì tạm dừng để dồn ngân sách.`);
    if (c.impr === 0) props.push(`"${c.name}": 0 hiển thị (từ khoá không có lượt tìm) → mở rộng/sửa từ khoá, hoặc tắt để dồn tiền sang campaign đang chạy.`);
  }
  const best = rows.filter((c) => c.conv > 0).sort((a, b) => b.conv - a.conv)[0];
  if (best) props.push(`"${best.name}" đang có ${best.conv} chuyển đổi → tăng ngân sách + cân nhắc đổi giá thầu sang Tối đa hoá chuyển đổi.`);
  if (t.conv === 0 && t.clicks >= 30 && !best) props.push("Toàn tài khoản có nhấp nhưng 0 chuyển đổi → ưu tiên sửa phễu chốt (CTA lấy email) trước khi tăng chi tiêu.");
  out.push("");
  if (props.length) {
    out.push("ĐỀ XUẤT (chờ anh duyệt — nhắn em cái nào là em làm):");
    props.slice(0, 5).forEach((p, i) => out.push(`${i + 1}. ${p}`));
  } else {
    out.push("ĐỀ XUẤT: chưa có việc gấp cần đổi — tiếp tục theo dõi, khi có dữ liệu chuyển đổi em sẽ đề xuất tối ưu giá thầu.");
  }

  return out.join("\n");
}
