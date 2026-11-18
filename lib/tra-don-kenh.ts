export const PHONE_IN_TEXT = /(?<!\d)(?:0\d{9}|84\d{9})(?!\d)/;

export const ORDER_CODE_IN_TEXT = /\b(?=[A-Za-z0-9-]*\d)[A-Za-z][A-Za-z0-9-]{4,19}\b/;

export type NguCanhTraDon =
  | { kenh: "zalo_oa"; senderId: string }
  | { kenh: "zalo_nhom" }
  | { kenh: "facebook" };

export function duocTraDon(nc?: NguCanhTraDon | null): nc is { kenh: "zalo_oa"; senderId: string } {
  return !!nc && nc.kenh === "zalo_oa" && typeof (nc as any).senderId === "string" && !!(nc as any).senderId.trim();
}

export function chuaSdtHoacMaDon(text: string): boolean {
  const t = String(text || "");
  if (!t) return false;
  const lienSo = t.replace(/(\d)[\s.-](?=\d)/g, "$1");
  return PHONE_IN_TEXT.test(t) || PHONE_IN_TEXT.test(lienSo) || ORDER_CODE_IN_TEXT.test(t);
}
