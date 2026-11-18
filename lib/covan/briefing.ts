import { computePnl, tr, type PnlSummary } from "./pnl";
import { buildForecast, type Forecast } from "./forecast";
import { runAlerts, type AlertsResult } from "./alerts";
import { loadRecs } from "./state";
import { callClaude } from "./advisor";
import { layTienMat, tienMatThanhChu } from "./tien-mat";
import { vnDateStr } from "@/lib/payroll";

const BREAKEVEN_MONTH = 318_000_000;

type Pre = { pnl?: PnlSummary; forecast?: Forecast; alerts?: AlertsResult };

async function facts(pre: Pre): Promise<string> {
  const summ = pre.pnl ?? (await computePnl());
  const fc = pre.forecast ?? (await buildForecast(summ));
  const al = pre.alerts ?? (await runAlerts({ pnl: summ, forecast: fc }));

  const lines: string[] = ["# SỐ LIỆU"];

  const saleMonths = summ.pnl.filter((p) => p.revenue > 0).slice(-3);
  for (const p of saleMonths) {
    const expense = p.cogs + p.payroll + p.ship + p.interest + p.ads + p.opex;
    lines.push(`- ${p.month}: thu ${tr(p.revenue)}, chi ${tr(expense)}`);
  }

  const curMonth = vnDateStr().slice(0, 7);
  const cur = summ.pnl.find((p) => p.month === curMonth);
  if (cur) {
    const day = Number(vnDateStr().slice(8, 10));
    const daysInMonth = new Date(Number(curMonth.slice(0, 4)), Number(curMonth.slice(5, 7)), 0).getDate();
    const pace = Math.round((cur.revenue / Math.max(1, day)) * daysInMonth);
    const pct = Math.round((cur.revenue / BREAKEVEN_MONTH) * 100);
    lines.push(
      `- HÒA VỐN: tháng ${curMonth} thu ${tr(cur.revenue)} = ${pct}% mốc hòa vốn ${tr(BREAKEVEN_MONTH)}; ` +
        `nhịp hiện tại cả tháng ~${tr(pace)} (${pace >= BREAKEVEN_MONTH ? "TRÊN" : "DƯỚI"} hòa vốn)`
    );
  }
  const gm = summ.gross_margin;
  if (gm.gross_margin_pct !== null) {
    lines.push(
      `- Lãi gộp (${gm.months.join("+")}): ${tr(gm.gross_margin)} (biên ${gm.gross_margin_pct}%)`
    );
  }
  if (fc.ok) {
    const growth = fc.weekly_growth_pct >= 0 ? `+${fc.weekly_growth_pct}` : `${fc.weekly_growth_pct}`;
    lines.push(
      `- Dự báo: nền ${tr(fc.base_weekly_revenue)}/tuần, đà ${growth}%/tuần, ` +
        `dòng tiền 13 tuần ~${tr(fc.total_net_flow_13w)}`
    );
  }

  try {
    lines.push(`- ${tienMatThanhChu(await layTienMat())}`);
  } catch {
    lines.push("- Tiền mặt: chưa đọc được sao kê.");
  }
  lines.push("", "# CẢNH BÁO");
  if (al.alerts.length) {
    for (const a of al.alerts) lines.push(`- [${a.severity}] ${a.title}`);
  } else {
    lines.push("- Không có cảnh báo mở.");
  }

  const recs = (await loadRecs()).slice().sort((a, b) => b.id - a.id);
  const proposed = recs.filter((r) => r.status === "proposed").slice(0, 3);
  const measured = recs.filter((r) => r.status === "measured" && r.outcome).slice(0, 3);
  if (proposed.length) {
    lines.push("", "# ĐỀ XUẤT CHỜ ANH DUYỆT (Telegram: /dexuat rồi /duyet <số>)");
    for (const r of proposed) lines.push(`- #${r.id} ${r.title}`);
  }
  if (measured.length) {
    lines.push("", "# KẾT QUẢ ĐO ĐỀ XUẤT ĐÃ DUYỆT");
    for (const r of measured) lines.push(`- ${r.outcome} — ${r.title}`);
  }

  lines.push("", "# GIỚI HẠN DỮ LIỆU");
  for (const c of summ.caveats.slice(0, 2)) lines.push(`- ${c}`);
  return lines.join("\n");
}

export async function buildBriefing(pre: Pre = {}, polish = true): Promise<{
  ok: true;
  polished: boolean;
  briefing: string;
  facts: string;
}> {
  const f = await facts(pre);
  let text = f;
  let polished = false;
  if (polish && (process.env.ANTHROPIC_API_KEY || "").trim()) {
    try {
      const out = await callClaude(
        [{ role: "user", content: f }],
        "Bạn là cố vấn kinh doanh AI, xưng 'em', gọi CEO là 'anh'. " +
          "Viết lại dữ liệu dưới đây thành BẢN TIN SÁNG ngắn (tối đa 10 dòng): " +
          "1 dòng tình hình chung, các con số chính, điều đáng lo nhất, " +
          "1 việc nên làm hôm nay. TUYỆT ĐỐI không thêm con số nào " +
          "ngoài dữ liệu được cung cấp. KHÔNG dùng emoji. Tiếng Việt đủ dấu.",
        2000
      );
      if (out.trim()) {
        text = out.trim();
        polished = true;
      }
    } catch {
      text = f;
    }
  }
  return { ok: true, polished, briefing: text, facts: f };
}
