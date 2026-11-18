import { khongDau } from "@/lib/covan/loc-y-dinh";

export type MaVung = "agent" | "kho" | "baihoc" | "baihoc_covan" | "nho_fail" | "kynang" | "nhatky";

export const VUNG: { ma: MaVung; ten: string; mau: string; goiY: string }[] = [
  { ma: "agent", ten: "Agent & máy", mau: "#059669", goiY: "Các trợ lý AI và máy chạy theo lịch" },
  { ma: "kho", ten: "Kho cố vấn", mau: "#2563eb", goiY: "Kho tri thức đã chắt, nạp RAG cho cố vấn và bot" },
  { ma: "baihoc", ten: "Bài học của agent", mau: "#d97706", goiY: "Bài học tự rút từ kết quả thật (thắng / hỏng / ghi nhận)" },
  { ma: "baihoc_covan", ten: "Bài học cố vấn", mau: "#ea580c", goiY: "Đề xuất của cố vấn đã đo xong, lưu lại để lần sau truy hồi" },
  { ma: "nho_fail", ten: "Bài bị loại", mau: "#dc2626", goiY: "Campaign Memory: bài bị bỏ khi duyệt hoặc dính từ cấm" },
  { ma: "kynang", ten: "Kỹ năng bot", mau: "#7c3aed", goiY: "Việc bot não làm được khi được gọi, kèm mức quyền" },
  { ma: "nhatky", ten: "Nhật ký máy", mau: "#64748b", goiY: "Các lượt máy chạy gần nhất (sổ agent_runs)" },
];

export type Nut = {
  id: string;
  vung: MaVung;
  ten: string;
  tom?: string;

  luc?: string | null;
  link?: string | null;

  so?: number | null;

  hong?: boolean;
};

export type Canh = [string, string];

export type DoThi = { nut: Nut[]; canh: Canh[]; nguonHong: string[] };

export const chuTim = (s: string) => khongDau(String(s || "")).replace(/\s+/g, " ").trim();

export function khopTim(n: Nut, q: string): boolean {
  const tu = chuTim(q).split(" ").filter(Boolean);
  if (!tu.length) return true;
  const hay = chuTim(`${n.ten} ${n.tom || ""}`);
  return tu.every((t) => hay.includes(t));
}

export const GIO_MOI = 48;
export function laMoi(n: Nut, now: number): boolean {
  if (!n.luc) return false;
  const t = new Date(n.luc).getTime();
  return Number.isFinite(t) && now - t < GIO_MOI * 3600e3 && now >= t - 60e3;
}

export function lamSachCanh(nut: Nut[], canh: Canh[]): Canh[] {
  const co = new Set(nut.map((n) => n.id));
  const da = new Set<string>();
  const out: Canh[] = [];
  for (const [a, b] of canh) {
    if (a === b || !co.has(a) || !co.has(b)) continue;
    const k = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (da.has(k)) continue;
    da.add(k);
    out.push([a, b]);
  }
  return out;
}

export function bac(canh: Canh[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const [a, b] of canh) { m.set(a, (m.get(a) || 0) + 1); m.set(b, (m.get(b) || 0) + 1); }
  return m;
}

export function boCuc(nut: Nut[], canh: Canh[], W = 900, H = 640, hatGiong = 7): Map<string, { x: number; y: number }> {
  let s = hatGiong;
  const rand = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const vungCo = VUNG.filter((v) => nut.some((n) => n.vung === v.ma));
  const tam = new Map<string, { x: number; y: number }>();
  vungCo.forEach((v, i) => {
    const g = (i / Math.max(1, vungCo.length)) * Math.PI * 2 - Math.PI / 2;
    tam.set(v.ma, { x: W / 2 + Math.cos(g) * W * 0.3, y: H / 2 + Math.sin(g) * H * 0.32 });
  });
  const p = nut.map((n) => {
    const c = tam.get(n.vung) || { x: W / 2, y: H / 2 };
    return { id: n.id, vung: n.vung, x: c.x + (rand() - 0.5) * 120, y: c.y + (rand() - 0.5) * 120, vx: 0, vy: 0 };
  });
  const chiSo = new Map(p.map((q, i) => [q.id, i]));
  const lk = canh.map(([a, b]) => [chiSo.get(a), chiSo.get(b)]).filter((x): x is [number, number] => x[0] != null && x[1] != null);
  const VONG = 220;
  for (let it = 0; it < VONG; it++) {
    const nhiet = 1 - it / VONG;
    for (let i = 0; i < p.length; i++) {
      for (let j = i + 1; j < p.length; j++) {
        const dx = p[i].x - p[j].x, dy = p[i].y - p[j].y;
        const d2 = dx * dx + dy * dy || 0.01;
        if (d2 > 9000) continue;
        const f = 240 / d2;
        p[i].vx += dx * f; p[i].vy += dy * f; p[j].vx -= dx * f; p[j].vy -= dy * f;
      }
    }
    for (const q of p) {
      const c = tam.get(q.vung)!;
      q.vx += (c.x - q.x) * 0.012; q.vy += (c.y - q.y) * 0.012;
    }
    for (const [a, b] of lk) {
      const dx = p[b].x - p[a].x, dy = p[b].y - p[a].y;
      p[a].vx += dx * 0.004; p[a].vy += dy * 0.004; p[b].vx -= dx * 0.004; p[b].vy -= dy * 0.004;
    }
    for (const q of p) {
      q.x += q.vx * nhiet; q.y += q.vy * nhiet; q.vx *= 0.6; q.vy *= 0.6;
      q.x = Math.min(W - 12, Math.max(12, q.x)); q.y = Math.min(H - 12, Math.max(12, q.y));
    }
  }
  return new Map(p.map((q) => [q.id, { x: q.x, y: q.y }]));
}
