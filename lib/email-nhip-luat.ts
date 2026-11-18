export const DAY = 24 * 3600 * 1000;
export const TRAN = { motThuMoi: 2 * DAY, cuaSo7: 7 * DAY, toiDaTrong7: 3, sanPhamMoi: 14 * DAY } as const;

export type MucGui = { luc: number; luong: string; mau: string; neuSanPham: boolean };
export type LyDoChan = "tran-1-thu-2-ngay" | "tran-3-thu-7-ngay" | "tran-san-pham-14-ngay";

export function kiemTran(lichSu: MucGui[], now: number, neuSanPham: boolean): { ok: true } | { ok: false; lyDo: LyDoChan } {
  const truoc = lichSu.filter((m) => m.luc <= now);
  if (truoc.some((m) => now - m.luc < TRAN.motThuMoi)) return { ok: false, lyDo: "tran-1-thu-2-ngay" };
  if (truoc.filter((m) => now - m.luc < TRAN.cuaSo7).length >= TRAN.toiDaTrong7) return { ok: false, lyDo: "tran-3-thu-7-ngay" };
  if (neuSanPham && truoc.some((m) => m.neuSanPham && now - m.luc < TRAN.sanPhamMoi)) return { ok: false, lyDo: "tran-san-pham-14-ngay" };
  return { ok: true };
}

export function gopLichSu(...nguon: MucGui[][]): MucGui[] {
  const m = new Map<string, MucGui>();
  for (const ds of nguon) for (const x of ds) {
    if (!Number.isFinite(x.luc)) continue;
    const k = `${x.luong}|${x.mau}`;
    const c = m.get(k);
    if (!c || x.luc > c.luc) m.set(k, x);
  }
  return [...m.values()].sort((a, b) => a.luc - b.luc);
}
