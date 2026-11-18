export type NhomMuc = "Nhân sự" | "Tài chính" | "Nội dung" | "Bán hàng" | "Vận hành";
export type MucDuyet = {
  id: string;
  nguon: string;
  nhom: NhomMuc;
  tieuDe: string;
  chiTiet?: string;
  luc: string;
  hanGio: number;
  link: string;
  ruiRo: "cao" | "vua" | "thap";
};
export type KetQuaHopDuyet = { muc: MucDuyet[]; nguonHong: string[] };

export function tuoiGio(m: Pick<MucDuyet, "luc">, now: number): number {
  const t = Date.parse(m.luc);
  return Number.isFinite(t) ? Math.max(0, (now - t) / 36e5) : 0;
}
export const quaHan = (m: Pick<MucDuyet, "luc" | "hanGio">, now: number) => tuoiGio(m, now) > m.hanGio;

export function sapXep(ds: MucDuyet[], now: number): MucDuyet[] {
  const rr = { cao: 0, vua: 1, thap: 2 } as const;
  return ds.slice().sort((a, b) =>
    Number(quaHan(b, now)) - Number(quaHan(a, now)) || rr[a.ruiRo] - rr[b.ruiRo] || tuoiGio(b, now) - tuoiGio(a, now));
}
