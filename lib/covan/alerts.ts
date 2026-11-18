import { computePnl, tr, type PnlSummary } from "./pnl";
import { buildForecast, type Forecast } from "./forecast";
import { loadRecs, saveRecs, type CovanRec } from "./state";

export type CovanAlert = { severity: "info" | "warning" | "critical"; title: string; detail: string };

export type AlertsResult = {
  ok: true;
  alerts: CovanAlert[];
  recommendations: CovanRec[];
  alerts_count: number;
  recommendations_count: number;
};

export async function runAlerts(pre?: { pnl?: PnlSummary; forecast?: Forecast }): Promise<AlertsResult> {
  const summ = pre?.pnl ?? (await computePnl());
  const fc = pre?.forecast ?? (await buildForecast(summ));
  const cov = summ.coverage;
  const pnl = summ.pnl;

  const alerts: CovanAlert[] = [];
  const recDrafts: Array<Omit<CovanRec, "id" | "baseline" | "measure_at" | "outcome" | "status">> = [];

  const add = (severity: CovanAlert["severity"], title: string, detail: string) =>
    alerts.push({ severity, title, detail });
  const addRec = (title: string, evidence: string[], action: string, metric: string | null) =>
    recDrafts.push({ title, evidence, action, metric });

  const revMonths = pnl.filter((p) => p.revenue > 0);
  if (revMonths.length >= 3) {
    const done = revMonths.slice(0, -1);
    const last = done[done.length - 1];
    const prev = done[done.length - 2];
    if (prev.revenue > 0) {
      const chg = ((last.revenue - prev.revenue) / prev.revenue) * 100;
      if (chg <= -10) {
        add(
          "warning",
          `Doanh thu ${last.month} giảm ${Math.abs(Math.round(chg))}% so ${prev.month}`,
          `${prev.month}: ${tr(prev.revenue)} -> ${last.month}: ${tr(last.revenue)}. ` +
            "Nhịp bán đang chậm lại."
        );
        addRec(
          `Rà nguyên nhân doanh thu tụt tháng ${last.month}`,
          [`${prev.month} ${tr(prev.revenue)} -> ${last.month} ${tr(last.revenue)} (${Math.round(chg)}%)`],
          "So sánh số đơn/AOV/kênh 2 tháng, tìm kênh hụt để bơm lại.",
          "revenue"
        );
      }
    }
  }

  const gm = summ.gross_margin;
  if (gm.gross_margin_pct !== null && gm.gross_margin_pct < 50) {
    add(
      "warning",
      `Biên lãi gộp thấp: ${gm.gross_margin_pct}%`,
      `DT ${tr(gm.revenue)} - vốn ${tr(gm.cogs)} trên ${gm.months.length} tháng.`
    );
  }

  const full = pnl.filter((p) => p.revenue > 0 && p.cogs > 0 && p.payroll > 0);
  if (full.length) {
    const last = full[full.length - 1];
    if (last.net_operating < 0) {
      add(
        "critical",
        `Tháng ${last.month} VẬN HÀNH ÂM ${tr(last.net_operating)}`,
        `DT ${tr(last.revenue)} - vốn ${tr(last.cogs)} - lương ${tr(last.payroll)} ` +
          `- chi khác = ${tr(last.net_operating)}.`
      );
    }
  }

  const shipMonths = cov.ship || [];
  if (shipMonths.length && shipMonths[shipMonths.length - 1] < "2026-05") {
    const maxShip = shipMonths[shipMonths.length - 1];
    add(
      "info",
      `Phí ship NGỪNG ghi sau ${maxShip}`,
      "orders.shipping_cost = 0 từ T5 -> chi phí thật đang cao hơn số sổ."
    );
    addRec(
      "Ghi lại phí ship vào orders từ T5 trở đi",
      [`ship có số đến ${maxShip}, sau đó = 0`],
      "Kế toán/vận đơn cập nhật shipping_cost mỗi đơn hoặc nhập tổng tháng.",
      "ship"
    );
  }
  if ((cov.ads || []).length <= 1) {
    add(
      "info",
      "Chi quảng cáo ghi thiếu nghiêm trọng",
      "Config mkt_spend mới có 1 tháng (~4tr) trong khi bank có vết chuyển " +
        "~13tr 'chạy quảng cáo' T4-T5 chưa vào sổ."
    );
    addRec(
      "Ghi chi ads hằng tháng vào mkt_spend_YYYY-MM",
      ["ads mới ghi 1 tháng; bank thấy ~13tr chuyển chạy QC T4-T5"],
      "Tổng hợp chi ads thật mỗi tháng (FB+Google) nhập vào /vong-lap-doanh-thu.",
      "ads"
    );
  }
  add(
    "info",
    "1,16 tỷ 'expense_other' chưa phân loại",
    "Trong đó có trả gốc vay 300tr + thiết bị + dịch vụ 1 lần — chưa tính vào " +
      "P&L để tránh sai. Cần bóc tay để biết chi phí vận hành thật."
  );

  if (fc.ok) {
    if (fc.runway_week) {
      add(
        "critical",
        `Dự báo tiền cạn ở tuần ${fc.runway_week}`,
        `Với số dư đầu kỳ ${tr(fc.opening_cash ?? 0)} (${fc.opening_cash_text}), dòng tiền âm dần.`
      );
    }
    if (fc.total_net_flow_13w < 0) {
      add(
        "warning",
        "Dòng tiền vận hành 13 tuần dự báo ÂM",
        `Tổng net flow 13 tuần ~ ${tr(fc.total_net_flow_13w)}.`
      );
    }
  }

  const existing = await loadRecs();
  const kept = existing.filter((r) => r.status !== "proposed");
  let nextId = existing.reduce((mx, r) => Math.max(mx, r.id), 0) + 1;
  const proposed: CovanRec[] = recDrafts.map((d) => ({
    ...d,
    id: nextId++,
    baseline: null,
    measure_at: null,
    outcome: null,
    status: "proposed",
  }));
  await saveRecs([...kept, ...proposed]);

  return {
    ok: true,
    alerts,
    recommendations: proposed,
    alerts_count: alerts.length,
    recommendations_count: proposed.length,
  };
}
