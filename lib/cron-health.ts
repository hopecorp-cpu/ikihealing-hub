import vercelConfig from "@/vercel.json";
import { checkAllSources, checkNumberAnomalies, type SourceHealth, type Anomaly } from "./watchdog";

export type CronRow = { path: string; schedule: string; group: string; name: string };

function groupOf(path: string): string {
  const p = path.toLowerCase();
  if (p.includes("telegram")) return "Báo cáo Telegram";
  if (p.includes("/tts-")) return "TikTok Shop";
  if (p.includes("content-factory") || p.includes("mkt")) return "Nội dung / Marketing";
  if (p.includes("lead") || p.includes("sale") || p.includes("care")) return "Sale / Chăm khách";
  if (p.includes("brain") || p.includes("covan")) return "Trợ lý AI";
  if (p.includes("report") || p.includes("profit") || p.includes("balance") || p.includes("finance") || p.includes("ads"))
    return "Tài chính / Đối chiếu";
  if (p.includes("zalo") || p.includes("oa")) return "Zalo";
  if (p.includes("watchdog") || p.includes("scout") || p.includes("research") || p.includes("funnel") || p.includes("digest") || p.includes("generate"))
    return "Canh gác / Trinh sát";
  return "Khác";
}

export function scheduleLabel(sched: string): string {
  const parts = sched.trim().split(/\s+/);
  if (parts.length !== 5) return sched;
  const [min, hr, , , dow] = parts;
  if (min.startsWith("*/")) return `mỗi ${min.slice(2)} phút`;
  if (hr.startsWith("*/")) return `mỗi ${hr.slice(2)} giờ`;
  if (hr.includes(",")) return `hằng ngày ${hr.split(",").map((h) => h + "h").join(", ")}`;
  const hh = /^\d+$/.test(hr) ? `${hr.padStart(2, "0")}:${(min || "0").padStart(2, "0")}` : sched;
  if (dow && dow !== "*") return `${hh} (thứ ${dow})`;
  return `hằng ngày ${hh}`;
}

export async function getCronHealth(): Promise<{
  crons: CronRow[];
  cronCount: number;
  sources: SourceHealth[];
  sourceOk: number;
  sourceBad: number;
  bad: SourceHealth[];
  anomalies: Anomaly[];
}> {
  const raw = ((vercelConfig as { crons?: Array<{ path: string; schedule: string }> }).crons || []);
  const crons: CronRow[] = raw
    .map((c) => ({
      path: c.path,
      schedule: c.schedule,
      group: groupOf(c.path),
      name: c.path.replace(/^\/api\/(cron\/)?/, "").split("?")[0],
    }))
    .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));

  let sources: SourceHealth[] = [];
  let anomalies: Anomaly[] = [];
  try {
    [sources, anomalies] = await Promise.all([checkAllSources(), checkNumberAnomalies()]);
  } catch {
    sources = [];
    anomalies = [];
  }
  const bad = sources.filter((s) => !s.ok);
  return {
    crons,
    cronCount: crons.length,
    sources,
    sourceOk: sources.filter((s) => s.ok).length,
    sourceBad: bad.length,
    bad,
    anomalies,
  };
}
