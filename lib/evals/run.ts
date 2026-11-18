import { getConfigValue, setConfigValue } from "@/lib/app-config";
import type { CaEval, MaMay } from "./chung";

export type EvalChiTiet = { id: string; dat: boolean; ghiChu: string };
export type EvalKetQuaMay = {
  may: MaMay;
  diem: number;
  tong: number;
  chiTiet: EvalChiTiet[];
  thoiGian: string;
  lanTruoc: number | null;
  lichSuLoi: string | null;
};
type HistoryRow = { at: string; diem: number; tong: number; chiTiet: EvalChiTiet[] };

export const CAC_MAY: MaMay[] = ["chia_lead", "tra_loi_zalo", "cham_sale"];
export const TEN_MAY: Record<MaMay, string> = {
  chia_lead: "Máy chia lead",
  tra_loi_zalo: "Máy trả lời Zalo",
  cham_sale: "Máy chấm sale",
};
const MAX_HISTORY = 12;
export const keyLichSu = (may: MaMay) => `eval_history_${may}`;

async function layCa(may: MaMay): Promise<CaEval[]> {
  if (may === "chia_lead") return (await import("./chia-lead")).CA_CHIA_LEAD;
  if (may === "tra_loi_zalo") return (await import("./tra-loi-zalo")).CA_TRA_LOI_ZALO;
  return (await import("./cham-sale")).CA_CHAM_SALE;
}

export async function runEvalMay(may: MaMay, opt: { luuLichSu?: boolean } = {}): Promise<EvalKetQuaMay> {
  const luu = opt.luuLichSu !== false;
  const cas = await layCa(may);
  const chiTiet: EvalChiTiet[] = [];
  for (const c of cas) {
    let dat = false;
    let ghiChu = "";
    try {
      const kq = await c.chay();
      dat = kq.dat;
      ghiChu = kq.ghiChu;
    } catch (e) {
      ghiChu = `lỗi khi chạy ca: ${String(e instanceof Error ? e.message : e).slice(0, 150)}`;
    }
    chiTiet.push({ id: c.id, dat, ghiChu: `[${c.moTa}] ${ghiChu}` });
  }

  const diem = chiTiet.filter((c) => c.dat).length;
  const tong = cas.length;
  const thoiGian = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 16).replace("T", " ");

  let lanTruoc: number | null = null;
  let lichSuLoi: string | null = null;
  if (luu) {
    let lich: HistoryRow[] = [];
    try {
      const raw = await getConfigValue(keyLichSu(may));
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      if (Array.isArray(parsed)) lich = parsed as HistoryRow[];
    } catch {
      lich = [];
    }
    lanTruoc = lich.length ? Number(lich[lich.length - 1]?.diem) || 0 : null;
    try {
      lich.push({ at: thoiGian, diem, tong, chiTiet });
      await setConfigValue(keyLichSu(may), JSON.stringify(lich.slice(-MAX_HISTORY)), `Lịch sử eval ${TEN_MAY[may]} (12 lần gần nhất)`);
    } catch (e) {
      lichSuLoi = String(e instanceof Error ? e.message : e).slice(0, 150);
    }
  }

  return { may, diem, tong, chiTiet, thoiGian, lanTruoc, lichSuLoi };
}
