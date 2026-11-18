import { computePnl, tr } from "./pnl";
import { buildForecast } from "./forecast";
import { runAlerts } from "./alerts";
import { measureDue } from "./learning";
import { isCampaignRec, sendAfterActionReport } from "./after-action";
import { layTienMat, tienMatThanhChu } from "./tien-mat";
import { costLineForBriefing } from "./cost";
import { maskPIIDay } from "./pii-ten";

const sach = (s: string) => s.replace(/[<>&]/g, " ");

export async function mucCoVanSang(dry = false): Promise<string> {
  const lines: string[] = [dry ? "CỐ VẤN ALEX — sáng nay (CHẠY THỬ, bỏ đo đề xuất/cảnh báo)" : "CỐ VẤN ALEX — sáng nay"];

  try {
    const tm = await layTienMat();
    lines.push(tienMatThanhChu(tm));
    if (tm.cuQua7Ngay) lines.push("CHÚ Ý: có tài khoản sao kê cũ quá 7 ngày — số dư trên KHÔNG phải số hôm nay.");
  } catch {
    lines.push("Tiền mặt: chưa đọc được sao kê.");
  }

  if (!dry) try {
    const measured = await measureDue(false);
    for (const m of measured.measured) {
      if (isCampaignRec(m.title)) await sendAfterActionReport(m).catch(() => false);
    }
    if (measured.measured.length) {
      lines.push("Kết quả đo đề xuất:");
      for (const m of measured.measured.slice(0, 3)) lines.push(`- #${m.id} [${m.verdict.toUpperCase()}] ${m.title} — ${m.outcome}`);
    }
  } catch {  }

  try {
    const pnl = await computePnl();
    const fc = await buildForecast(pnl);
    const al = dry ? { alerts: [], recommendations_count: 0 } : await runAlerts({ pnl, forecast: fc });
    if (fc.ok) {
      const growth = fc.weekly_growth_pct >= 0 ? `+${fc.weekly_growth_pct}` : `${fc.weekly_growth_pct}`;
      lines.push(`Dự báo 13 tuần: nền ${tr(fc.base_weekly_revenue)}/tuần, đà ${growth}%/tuần, dòng tiền ~${tr(fc.total_net_flow_13w)}` +
        (fc.runway_week ? ` — CẠN TIỀN Ở TUẦN ${fc.runway_week}` : ""));
    }
    const top = al.alerts.filter((a) => a.severity === "critical" || a.severity === "warning").slice(0, 4);
    if (dry) {
      lines.push("Cảnh báo: (bỏ qua ở chế độ chạy thử)");
    } else if (top.length) {
      lines.push("Cảnh báo:");
      for (const a of top) lines.push(`- [${a.severity.toUpperCase()}] ${a.title}`);
    } else {
      lines.push("Cảnh báo: không có mục nghiêm trọng.");
    }
    if (al.recommendations_count) lines.push(`Đề xuất mới chờ duyệt: ${al.recommendations_count} (Telegram Cố vấn AI: /dexuat).`);
  } catch {
    lines.push("Cảnh báo/dự báo: chưa đọc được số liệu.");
  }

  try {
    const cost = await costLineForBriefing();
    if (cost) lines.push(cost);
  } catch {  }

  return sach(await maskPIIDay(lines.join("\n")));
}
