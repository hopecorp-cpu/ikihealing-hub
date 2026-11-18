import { DAY, type MucGui } from "./email-nhip-luat";

export const BUOC = [0, 3, 7, 14, 21, 30] as const;
export const CACH_TOI_THIEU = 3 * DAY;
export const KET_THUC_SAU_NGAY = 31;

export const MOC_TAT = Date.parse("2026-10-03T12:29:00+07:00");

export type LeadLuat = { ts: number; sent: number[]; guiLuc?: Record<string, number>; tuChoi?: string; consent?: boolean; consentLuc?: number };
export type LyDoBoQua = "tu-choi" | "chua-dong-y" | "chua-thu-0" | "thu-0-truoc-moc-tat" | "ket-thuc-qua-30" | "chua-den-han" | "cach-duoi-3-ngay" | "mau-chua-duyet";
export type QuyetDinh = { buoc: number } | { boQua: LyDoBoQua };

export function mocGui(l: LeadLuat, buoc: number, now: number): number | null {
  const that = l.guiLuc?.[String(buoc)];
  if (Number.isFinite(that)) return that as number;
  if (!l.sent.includes(buoc)) return null;
  if (buoc === 0) return l.ts;
  return Math.min(l.ts + buoc * DAY + DAY, now);
}

export function lichSuChuoi(l: LeadLuat, now: number): MucGui[] {
  const out: MucGui[] = [];
  for (const b of BUOC) { const t = mocGui(l, b, now); if (t != null) out.push({ luc: t, luong: "blog-nurture", mau: `ngay-${b}`, neuSanPham: b === 30 }); }
  return out;
}

export function quyetDinhBuoc(l: LeadLuat, now: number, mauDuyet: Set<number>): QuyetDinh {
  if (l.tuChoi || l.consent === false) return { boQua: "tu-choi" };
  const sent = l.sent || [];
  if (!sent.includes(0)) {
    if (l.ts < MOC_TAT) return { boQua: "thu-0-truoc-moc-tat" };
    return mauDuyet.has(0) ? { buoc: 0 } : { boQua: "mau-chua-duyet" };
  }
  if (!(l.consent && l.consentLuc)) return { boQua: "chua-dong-y" };
  const t0 = mocGui(l, 0, now)!;
  const tuoi = (now - t0) / DAY;
  if (tuoi >= KET_THUC_SAU_NGAY) return { boQua: "ket-thuc-qua-30" };
  const ke = BUOC.find((b) => b > 0 && !sent.includes(b));
  if (ke == null) return { boQua: "ket-thuc-qua-30" };
  if (tuoi < ke) return { boQua: "chua-den-han" };
  const ganNhat = Math.max(...BUOC.filter((b) => sent.includes(b)).map((b) => mocGui(l, b, now) ?? 0));
  if (now - ganNhat < CACH_TOI_THIEU) return { boQua: "cach-duoi-3-ngay" };
  if (!mauDuyet.has(ke)) return { boQua: "mau-chua-duyet" };
  return { buoc: ke };
}
