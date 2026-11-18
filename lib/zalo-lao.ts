import { sanitizeContent, findBanned } from "./banned-words";

export type TinNhan = { role: "user" | "assistant"; content: string };

export const LAO_SO_LUOT = 8;
export const LAO_TRAN_USER = 1000;
export const LAO_TRAN_ASSISTANT = 600;
export const LAO_TRAN_TONG = 4000;

export const LAO_CAU_AN_TOAN = "Lão chưa nghĩ ra, bạn hỏi lại giúp Lão nhé.";

export function chuanHoaTinNhan(raw: unknown): TinNhan[] | null {
  if (!Array.isArray(raw)) return null;
  let msgs: TinNhan[] = raw
    .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-LAO_SO_LUOT)
    .map((m: any) => ({
      role: m.role,
      content: String(m.content).slice(0, m.role === "user" ? LAO_TRAN_USER : LAO_TRAN_ASSISTANT),
    }));
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return null;
  const tong = (a: TinNhan[]) => a.reduce((s, m) => s + m.content.length, 0);
  while (msgs.length > 1 && tong(msgs) > LAO_TRAN_TONG) msgs = msgs.slice(1);
  while (msgs.length && msgs[0].role !== "user") msgs = msgs.slice(1);
  return msgs.length ? msgs : null;
}

export function locDauRa(text: string): string {
  if (findBanned(text).length) return LAO_CAU_AN_TOAN;
  return sanitizeContent(text);
}

export function kiemOrigin(origin: string | null, danhSach: string[]): { cho: boolean; allowOrigin: string } {
  if (!danhSach.length) return { cho: true, allowOrigin: "*" };
  if (!origin) return { cho: true, allowOrigin: danhSach[0] };
  const o = origin.trim().toLowerCase();
  const khop = danhSach.some((d) => {
    const x = d.trim().toLowerCase();
    if (x.startsWith("*.")) { const goc = x.slice(1); try { return new URL(o).hostname.endsWith(goc); } catch { return false; } }
    return x === o;
  });
  return khop ? { cho: true, allowOrigin: origin } : { cho: false, allowOrigin: danhSach[0] };
}
