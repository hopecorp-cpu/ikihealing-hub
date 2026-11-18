import { computePnl, tr, vnToday, type PnlSummary } from "./pnl";
import { addMemories, loadRecs, saveRecs, type CovanRec } from "./state";
import { storeLesson } from "./rag";

const METRICS: Record<string, "up"> = { revenue: "up", ads: "up", ship: "up" };
const DEFAULT_MEASURE_DAYS = 7;

const fmtVal = (v: number): string => (Math.abs(v) > 1000 ? tr(v) : String(Math.round(v * 10) / 10));

export function metricValue(summ: PnlSummary, key: string): number | null {
  const cur = vnToday().slice(0, 7);
  if (key === "revenue") {
    const done = summ.pnl.filter((p) => p.revenue > 0 && p.month < cur);
    return done.length ? done[done.length - 1].revenue : null;
  }
  if (key === "ads") return (summ.coverage.ads || []).length;
  if (key === "ship") return summ.pnl.filter((p) => p.ship > 0).length;
  return null;
}

export async function approve(recId: number, days = DEFAULT_MEASURE_DAYS): Promise<
  | { ok: false; error: string }
  | { ok: true; id: number; title: string; metric: string | null; baseline: number | null; measure_at: string }
> {
  const recs = await loadRecs();
  const rec = recs.find((r) => r.id === recId);
  if (!rec) return { ok: false, error: `Không có đề xuất id=${recId}` };
  if (rec.status === "approved") return { ok: false, error: `Đề xuất ${recId} đã duyệt rồi (đang đo)` };
  const summ = await computePnl();
  const baseline = metricValue(summ, rec.metric || "");
  const measureAt = new Date(Date.now() + 7 * 3600e3 + days * 86400e3).toISOString().slice(0, 10);
  rec.status = "approved";
  rec.baseline = baseline;
  rec.measure_at = measureAt;
  await saveRecs(recs);
  return { ok: true, id: rec.id, title: rec.title, metric: rec.metric, baseline, measure_at: measureAt };
}

export type Measured = { id: number; title: string; verdict: string; outcome: string };

export async function measureDue(force = false): Promise<{ ok: true; measured: Measured[]; count: number }> {
  const today = vnToday();
  const recs = await loadRecs();
  const due = recs.filter((r) => r.status === "approved" && (force || (r.measure_at || "9999") <= today));
  if (!due.length) return { ok: true, measured: [], count: 0 };

  const summ = await computePnl();
  const measured: Measured[] = [];
  for (const rec of due) {
    const baseline = rec.baseline;
    const nowVal = metricValue(summ, rec.metric || "");
    let verdict: string;
    let outcome: string;
    if (baseline === null || baseline === undefined || nowVal === null) {
      verdict = "chua-ro";
      outcome = "thiếu số liệu để so";
    } else {
      const delta = nowVal - baseline;
      const direction = METRICS[rec.metric || ""] || "up";

      const eps = Math.max(1, Math.abs(baseline) * 0.02);
      if (Math.abs(delta) < eps) verdict = "chua-ro";
      else if (delta > 0 === (direction === "up")) verdict = "thang";
      else verdict = "thua";
      outcome =
        `${rec.metric}: ${fmtVal(baseline)} -> ${fmtVal(nowVal)} ` +
        `(${delta >= 0 ? "+" : ""}${fmtVal(delta)})`;
    }
    rec.outcome = `[${verdict}] ${outcome}`;
    rec.status = "measured";

    await addMemories([
      { kind: "procedural", content: `Đề xuất '${rec.title}' kết quả ${verdict.toUpperCase()}: ${outcome}` },
    ]);

    if (verdict === "thang" || verdict === "thua") {
      const lesson =
        verdict === "thang"
          ? `Bài học thực chiến (đã đo): đề xuất "${rec.title}" -> THẮNG. ${outcome}. Nước đi này đã ăn tiền, cân nhắc lặp lại.`
          : `Bài học thực chiến (đã đo): đề xuất "${rec.title}" -> THUA. ${outcome}. Nước đi này chưa hiệu quả, tránh hoặc điều chỉnh trước khi làm lại.`;
      await storeLesson(rec.id, lesson).catch(() => false);
    }
    measured.push({ id: rec.id, title: rec.title, verdict, outcome });
  }
  await saveRecs(recs);
  return { ok: true, measured, count: measured.length };
}

export async function listRecommendations(): Promise<{
  proposed: CovanRec[];
  approved: CovanRec[];
  measured: CovanRec[];
}> {
  const recs = (await loadRecs()).slice().sort((a, b) => b.id - a.id);
  return {
    proposed: recs.filter((r) => r.status === "proposed"),
    approved: recs.filter((r) => r.status === "approved"),
    measured: recs.filter((r) => r.status === "measured").slice(0, 10),
  };
}
