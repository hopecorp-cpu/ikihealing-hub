export type CheDoOa = "nhap" | "tat" | "tu_gui";
export const CHE_DO_OA_MAC_DINH: CheDoOa = "nhap";
export const KHOA_CHE_DO_OA = "zalo_oa_agent";
export const KHOA_NHAP_OA = "zalo_oa_nhap";
export const TRAN_NHAP_OA = 200;

export const LOI_CHAO_FOLLOW_OA =
  "Chào bạn, cảm ơn bạn đã quan tâm NOVA/ACME. Bạn cần tư vấn về dưỡng sinh hay sản phẩm nào, cứ nhắn mình nhé.";

export function chuanHoaCheDoOa(raw: string | null | undefined): CheDoOa | null {
  const v = String(raw ?? "").trim().toLowerCase().replace(/-/g, "_");
  if (v === "nhap" || v === "tat" || v === "tu_gui") return v;
  return null;
}

export function chonCheDoOa(cfg: string | null | undefined, env: string | null | undefined): CheDoOa {
  return chuanHoaCheDoOa(cfg) ?? chuanHoaCheDoOa(env) ?? CHE_DO_OA_MAC_DINH;
}

export type NhapOa = {
  tinKhach: string;
  nhap: string;
  luc: string;
  suKien: "tin" | "follow";
  hot?: boolean; medical?: boolean; sdt?: string | null;
  cheDo: CheDoOa;
};

export function themNhapOa(kho: Record<string, NhapOa>, id: string, tin: NhapOa, tran = TRAN_NHAP_OA): Record<string, NhapOa> {
  const out: Record<string, NhapOa> = { ...kho, [id]: tin };
  const ids = Object.keys(out);
  if (ids.length > tran) {
    ids.sort((a, b) => String(out[a].luc).localeCompare(String(out[b].luc)));
    for (const x of ids.slice(0, ids.length - tran)) delete out[x];
  }
  return out;
}

export function nhanKhachOa(id: string): string { return `Khách Zalo OA ...${String(id).slice(-4)}`; }
