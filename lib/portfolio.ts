import { getServiceClient } from "@/lib/supabase-server";
import { vnDateStr } from "@/lib/payroll";

export type ProjectStatus = "idea" | "building" | "active" | "paused" | "done";
export type Priority = "low" | "medium" | "high" | "urgent";

export type PortfolioItem = {
  id: string;
  name: string;
  area: string;
  status: ProjectStatus;
  priority: Priority;
  nextStep: string;
  lastUpdate: string;
  link?: string;
  makesMoney?: boolean;
  note?: string;
};

const STALE_DAYS: Record<Priority, number> = { urgent: 5, high: 8, medium: 14, low: 25 };

export function daysSince(dateStr: string): number {
  try {
    const d = new Date(dateStr + "T00:00:00");
    const now = new Date(vnDateStr() + "T00:00:00");
    return Math.max(0, Math.round((now.getTime() - d.getTime()) / 864e5));
  } catch { return 999; }
}
export function isStale(p: PortfolioItem): boolean {
  if (p.status === "done" || p.status === "paused") return false;
  return daysSince(p.lastUpdate) >= (STALE_DAYS[p.priority] ?? 14);
}

export const DEFAULT_PORTFOLIO: PortfolioItem[] = [
  { id: "du-an-mau-1", name: "Dự án mẫu 1", area: "Vận hành", status: "active", priority: "high", nextStep: "Việc kế tiếp mẫu", lastUpdate: "2026-01-01", link: "/vong-lap-doanh-thu", makesMoney: true },
  { id: "du-an-mau-2", name: "Dự án mẫu 2", area: "Marketing", status: "building", priority: "medium", nextStep: "Việc kế tiếp mẫu", lastUpdate: "2026-01-01" },
  { id: "du-an-mau-3", name: "Dự án mẫu 3", area: "Sale Page", status: "paused", priority: "low", nextStep: "Việc kế tiếp mẫu", lastUpdate: "2026-01-01" },
];

export async function getPortfolio(): Promise<PortfolioItem[]> {
  const sb = getServiceClient();
  const raw = (await sb.from("config").select("value").eq("key", "projects_portfolio").maybeSingle()).data?.value;
  if (raw) { try { const j = JSON.parse(raw); if (Array.isArray(j) && j.length) return j; } catch {} }
  await savePortfolio(DEFAULT_PORTFOLIO);
  return DEFAULT_PORTFOLIO;
}

export async function savePortfolio(list: PortfolioItem[]): Promise<void> {
  const sb = getServiceClient();
  await sb.from("config").upsert({ key: "projects_portfolio", value: JSON.stringify(list) }, { onConflict: "key" });
}

export async function touchProject(idOrName: string, patch: Partial<PortfolioItem>): Promise<PortfolioItem | null> {
  const list = await getPortfolio();
  const q = idOrName.toLowerCase().trim();
  const i = list.findIndex((p) => p.id === q || p.name.toLowerCase().includes(q));
  if (i < 0) return null;
  list[i] = { ...list[i], ...patch, lastUpdate: patch.lastUpdate || vnDateStr() };
  await savePortfolio(list);
  return list[i];
}

export async function buildPortfolioContext(): Promise<string> {
  try {
    const list = await getPortfolio();
    const running = list.filter((p) => p.status !== "done");
    const stale = running.filter(isStale).sort((a, b) => daysSince(b.lastUpdate) - daysSince(a.lastUpdate));
    const hot = running.filter((p) => (p.priority === "urgent" || p.priority === "high") && !stale.includes(p));
    const money = list.filter((p) => p.makesMoney && (p.status === "active" || p.status === "done"));

    const lines: string[] = [`[DANH MỤC DỰ ÁN] ${running.length} đang chạy / ${list.length} tổng.`];
    if (stale.length) lines.push(`[BỎ BẴNG — cần thúc] ${stale.slice(0, 8).map((p) => `${p.name} (${daysSince(p.lastUpdate)} ngày, ${p.priority}) → ${p.nextStep}`).join(" | ")}`);
    else lines.push(`[BỎ BẴNG] không có dự án nào quá hạn động tới — tốt!`);
    if (hot.length) lines.push(`[ƯU TIÊN CAO đang chạy] ${hot.slice(0, 6).map((p) => `${p.name} → ${p.nextStep}`).join(" | ")}`);
    if (money.length) lines.push(`[ỨNG VIÊN ĐÓNG GÓI BÁN] các thứ đã/đang ra tiền, cân nhắc đóng gói thành sản phẩm/khoá đào tạo bán ra ngoài: ${money.map((p) => p.name).join(", ")}.`);
    return lines.join("\n");
  } catch (e: any) {
    return `[DANH MỤC DỰ ÁN] (chưa đọc được: ${String(e?.message || e).slice(0, 50)})`;
  }
}
