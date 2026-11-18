import "server-only";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import {
  KEY_DUNG, KEY_NHAT_KY_DUNG, NHAT_KY_TOI_DA, cauChan, docTrangThai, nhomBiDung,
  type NhatKyDung, type NhomDung, type TrangThaiDung,
} from "@/lib/dung-khan-cap-core";

export async function docDungKhanCap(): Promise<TrangThaiDung> {
  return docTrangThai(await getConfigValue(KEY_DUNG));
}

export async function lyDoDung(nhom: Exclude<NhomDung, "toan_he">): Promise<string | null> {
  try {
    const lan = nhomBiDung(await docDungKhanCap(), nhom);
    return lan ? cauChan(nhom, lan) : null;
  } catch (e: any) {
    console.error("[dung-khan-cap] không đọc được công tắc, tạm cho chạy:", e?.message || e);
    return null;
  }
}

export async function datDungKhanCap(o: { nhom: NhomDung; dung: boolean; boi: string; lyDo: string }): Promise<TrangThaiDung> {
  const tt = await docDungKhanCap();
  const luc = new Date().toISOString();
  if (o.dung) tt[o.nhom] = { luc, boi: o.boi, lyDo: o.lyDo };
  else delete tt[o.nhom];
  await setConfigValue(KEY_DUNG, JSON.stringify(tt), "Dừng khẩn cấp: nhóm nào có mặt là đang dừng (xem lib/dung-khan-cap-core.ts)");

  let nk: NhatKyDung[] = [];
  try { nk = JSON.parse((await getConfigValue(KEY_NHAT_KY_DUNG)) || "[]"); if (!Array.isArray(nk)) nk = []; } catch { nk = []; }
  nk.push({ luc, boi: o.boi, viec: o.dung ? "dung" : "mo", nhom: o.nhom, lyDo: o.lyDo });
  await setConfigValue(KEY_NHAT_KY_DUNG, JSON.stringify(nk.slice(-NHAT_KY_TOI_DA)), "Nhật ký bấm Dừng khẩn cấp");
  return tt;
}

export async function docNhatKyDung(): Promise<NhatKyDung[]> {
  try { const nk = JSON.parse((await getConfigValue(KEY_NHAT_KY_DUNG)) || "[]"); return Array.isArray(nk) ? nk.slice().reverse() : []; } catch { return []; }
}
