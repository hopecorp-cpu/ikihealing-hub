import type { Nguon } from "@/lib/nguon-lead";

const gon = (v: unknown, n: number) => String(v ?? "").toLowerCase().normalize("NFD")
  .replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, n);

export function taoMaNguon(kenh: string, bai?: string): string {
  const [k0, ...duoi] = gon(kenh, 20).split("-");
  const k = k0 || "khac";
  const b = gon([duoi.join("-"), bai].filter(Boolean).join("-"), 30);
  return b ? `s-${k}-${b}` : `s-${k}`;
}

export function docMaNguon(chu: unknown): string | null {
  const s = String(chu ?? "").toLowerCase();
  const m = s.match(/(?:^|[\s(\[#:=])(s-[a-z0-9]{2,12}(?:-[a-z0-9]{1,30}){0,5})(?=$|[\s)\].,;!?])/);
  return m ? m[1].slice(0, 60) : null;
}

export function nguonTuMa(ma: string | null | undefined): Nguon | null {
  const m = String(ma || "").match(/^s-([a-z0-9]{1,12})(?:-(.+))?$/);
  if (!m) return null;
  return { s: m[1], m: "ma-nguon", c: (m[2] || "").slice(0, 40) || undefined };
}

export function linkMessenger(page: string, ma: string): string {
  return `https://m.me/${encodeURIComponent(String(page).trim())}?ref=${encodeURIComponent(ma)}`;
}
