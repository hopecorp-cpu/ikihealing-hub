import { getConfigValue } from "@/lib/app-config";
import { computeRevenueLoop } from "@/lib/revenue-loop";
import { vnDateStr } from "@/lib/payroll";

const vnd = (n: number) => Math.round(n).toLocaleString("vi-VN") + "đ";
type Campaign = { name: string; status: string; spend: number; ctr: number; cpm: number; results: number; rtype: string; cpo: number };

export type AdsAdvice = { ok: boolean; lines: string[]; text: string; error?: string };

export async function buildAdsAdvice(): Promise<AdsAdvice> {
  let campaigns: Campaign[] = [];
  try {
    const raw = await getConfigValue("ads_campaigns");
    const o = raw ? JSON.parse(raw) : null;
    campaigns = Array.isArray(o?.campaigns) ? o.campaigns : [];
  } catch { }
  if (!campaigns.length) return { ok: false, lines: [], text: "", error: "chưa có dữ liệu ads_campaigns (cron ads-spend chưa kéo được — kiểm tra FB_ADS_TOKEN)" };

  const month = vnDateStr().slice(0, 7);
  const loop = await computeRevenueLoop(month).catch(() => null);
  const cpoCeil = loop?.ceil?.cpoCeiling || 0;
  const cpoBE = loop?.ceil?.cpoBreakeven || 0;
  const active = campaigns.filter((c) => /ACTIVE/i.test(c.status));
  const totalSpend = campaigns.reduce((s, c) => s + (c.spend || 0), 0);

  const props: string[] = [];
  const notes: string[] = [];

  const winners: Campaign[] = [];
  for (const c of active) {
    if (c.spend <= 0) continue;

    if (!c.results && c.spend >= 200_000) {
      props.push(`DỪNG/soát lại "${c.name}": đã đốt ${vnd(c.spend)} mà chưa ra kết quả nào.`);
      continue;
    }

    if (c.results && cpoCeil > 0 && c.cpo > cpoBE) {
      props.push(`TẮT "${c.name}": CPO ${vnd(c.cpo)} vượt cả HOÀ VỐN ${vnd(cpoBE)} — đang lỗ mỗi ${c.rtype}.`);
      continue;
    }
    if (c.results && cpoCeil > 0 && c.cpo > cpoCeil) {
      props.push(`TỐI ƯU "${c.name}": CPO ${vnd(c.cpo)} vượt trần lãi ${vnd(cpoCeil)} (còn trên hoà vốn) — siết đối tượng/creative.`);
      continue;
    }

    if (c.ctr > 0 && c.ctr < 1 && c.spend >= 100_000) {
      notes.push(`Creative yếu "${c.name}": CTR ${c.ctr}% (<1%) — thử hook/hình mới.`);
    }

    if (c.results && (cpoCeil === 0 || c.cpo <= cpoCeil)) winners.push(c);
  }

  if (winners.length) {
    const best = winners.sort((a, b) => (a.cpo || 9e9) - (b.cpo || 9e9))[0];
    props.push(`NHÂN NGÂN SÁCH "${best.name}": CPO ${vnd(best.cpo)}/${best.rtype} trong trần lãi — bài đang lời, tăng chi để nhân đơn.`);
  }

  if (loop) {
    if (loop.mktLight === "red" || loop.mktOverBudgetWarn) {
      notes.push(`Chi phí MKT/doanh thu đang ĐÈN ĐỎ${loop.mktPct != null ? ` (${loop.mktPct}%)` : ""} — vượt trần chống thất thoát ${vnd(loop.mktCapAmount)}, coi chừng lỗ.`);
    }
    if (loop.needOrders > 0 && loop.budgetNeeded > totalSpend * 1.3) {
      props.push(`TĂNG PHỦ: còn cần ~${loop.needOrders} đơn để đạt mục tiêu; ngân sách gợi ý ${vnd(loop.budgetNeeded)} (đang chi ${vnd(totalSpend)}) — dồn vào campaign thắng ở trên.`);
    }
  }

  const lines = [...props, ...notes];
  if (!lines.length) return { ok: true, lines: [], text: "" };

  const header = `\u{1F4B0} <b>Cố vấn Quảng cáo — ${active.length} campaign đang chạy · chi ${vnd(totalSpend)}</b>${cpoCeil ? ` · trần CPO lãi ${vnd(cpoCeil)}` : ""}`;
  const propBlock = props.length ? `\n\n<b>ĐỀ XUẤT:</b>\n• ${props.join("\n• ")}` : "";
  const noteBlock = notes.length ? `\n\n<i>Lưu ý:</i>\n• ${notes.join("\n• ")}` : "";
  return { ok: true, lines, text: `${header}${propBlock}${noteBlock}` };
}
