export const TRU_SO_CU = "63/253 đường Ngô Quyền, P. Lê Thanh Nghị, TP. Hải Phòng";
export const TRU_SO_MOI = "Số 1 Đường Mẫu, Phường Mẫu, Thành phố Mẫu";
export const NGAY_DOI_TRU_SO = "2026-09-24";

export function truSoTheoNgay(ngay?: string | null): string {
  const d = String(ngay || "").slice(0, 10);
  return d && d < NGAY_DOI_TRU_SO ? TRU_SO_CU : TRU_SO_MOI;
}
