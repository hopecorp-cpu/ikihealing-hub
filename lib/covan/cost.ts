import { getConfigValue, setConfigValue } from "@/lib/app-config";

const KEY = "covan_api_cost";
export const USD_VND = 26000;
const MAX_DAYS = 450;

export const PRICE: Array<{ match: string; inUsd: number; outUsd: number }> = [
  { match: "opus", inUsd: 4, outUsd: 20 },
  { match: "sonnet", inUsd: 2, outUsd: 10 },
  { match: "haiku", inUsd: 0.1, outUsd: 0.5 },
];

type DayCost = { vnd: number; calls: number };
type CostMap = Record<string, DayCost>;

function todayVN(): string {
  return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
}

async function loadMap(): Promise<CostMap> {
  try {
    const raw = await getConfigValue(KEY);
    if (!raw) return {};
    const m = JSON.parse(raw) as CostMap;
    return m && typeof m === "object" ? m : {};
  } catch {
    return {};
  }
}

export async function recordCost(model: string, inputTokens: number, outputTokens: number, cacheDoc = 0, cacheGhi = 0): Promise<void> {
  try {
    const p = PRICE.find((x) => model.includes(x.match));
    if (!p) return;

    const usd = (inputTokens / 1e6) * p.inUsd + (outputTokens / 1e6) * p.outUsd
      + (cacheDoc / 1e6) * p.inUsd * 0.1 + (cacheGhi / 1e6) * p.inUsd * 1.25;
    const vnd = Math.round(usd * USD_VND);
    const map = await loadMap();
    const day = todayVN();
    const cur = map[day] || { vnd: 0, calls: 0 };
    map[day] = { vnd: cur.vnd + vnd, calls: cur.calls + 1 };
    const keys = Object.keys(map).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_DAYS))) delete map[k];
    await setConfigValue(KEY, JSON.stringify(map), "Sổ chi phí API AI Cố vấn theo ngày (VND)");
  } catch {

  }
}

function sumRange(map: CostMap, from: string, to: string): { vnd: number; calls: number } {
  let vnd = 0, calls = 0;
  for (const [day, c] of Object.entries(map)) {
    if (day >= from && day <= to) { vnd += c.vnd; calls += c.calls; }
  }
  return { vnd, calls };
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString("vi-VN") + "đ";
}

export async function costReport(): Promise<string> {
  const map = await loadMap();
  const now = new Date(Date.now() + 7 * 3600e3);
  const today = now.toISOString().slice(0, 10);
  const d = (days: number) => new Date(now.getTime() - days * 86400e3).toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);
  const quarter = Math.floor(now.getUTCMonth() / 3);
  const qStart = `${year}-${String(quarter * 3 + 1).padStart(2, "0")}-01`;

  const homNay = sumRange(map, today, today);
  const homQua = sumRange(map, d(1), d(1));
  const tuan = sumRange(map, d(6), today);
  const thang = sumRange(map, `${month}-01`, today);
  const quy = sumRange(map, qStart, today);
  const nam = sumRange(map, `${year}-01-01`, today);

  return [
    "CHI PHÍ AI CỐ VẤN (ước tính từ token thật, tỷ giá 26.000đ/$):",
    `- Hôm nay: ${fmt(homNay.vnd)} (${homNay.calls} lượt gọi)`,
    `- Hôm qua: ${fmt(homQua.vnd)} (${homQua.calls} lượt)`,
    `- 7 ngày qua: ${fmt(tuan.vnd)} (${tuan.calls} lượt)`,
    `- Tháng ${month.slice(5)}: ${fmt(thang.vnd)} (${thang.calls} lượt)`,
    `- Quý này: ${fmt(quy.vnd)}`,
    `- Năm ${year}: ${fmt(nam.vnd)}`,
    "Ghi chú: tự đo/so số/cào dữ liệu là code thuần 0 đồng — sổ này chỉ gồm những lần AI thật sự viết/nghĩ. Chưa gồm máy viết blog (bot riêng).",
  ].join("\n");
}

export async function monthCost(): Promise<{ vnd: number; calls: number; ceiling: number; overPct: number | null }> {
  const map = await loadMap();
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const thang = sumRange(map, `${today.slice(0, 7)}-01`, today);
  let ceiling = 0;
  try { ceiling = Number((await getConfigValue("ai_cost_ceiling")) || 0) || 0; } catch { }
  return { vnd: thang.vnd, calls: thang.calls, ceiling, overPct: ceiling > 0 ? Math.round((thang.vnd / ceiling) * 100) : null };
}

export async function costLineForBriefing(): Promise<string> {
  try {
    const map = await loadMap();
    const now = new Date(Date.now() + 7 * 3600e3);
    const today = now.toISOString().slice(0, 10);
    const yest = new Date(now.getTime() - 86400e3).toISOString().slice(0, 10);
    const homQua = sumRange(map, yest, yest);
    const thang = sumRange(map, `${today.slice(0, 7)}-01`, today);

    let warn = "";
    try {
      const ceiling = Number((await getConfigValue("ai_cost_ceiling")) || 0) || 0;
      if (ceiling > 0) {
        const pct = Math.round((thang.vnd / ceiling) * 100);
        if (pct >= 100) warn = ` VƯỢT TRẦN THÁNG (${pct}% của ${fmt(ceiling)}) — nên soát lại việc nào đang gọi AI nhiều.`;
        else if (pct >= 80) warn = ` Đã dùng ${pct}% trần tháng (${fmt(ceiling)}).`;
      }
    } catch { }
    return `Chi phí AI: hôm qua ${fmt(homQua.vnd)}, tháng này ${fmt(thang.vnd)} (gõ /chiphi xem đủ).${warn}`;
  } catch {
    return "";
  }
}
