import { inFinanceWL, isAdmin, isBodRole, isManagerOrAbove } from "@/lib/auth";

export const KHOI = ["Chung", "KD", "KD-SÀN", "VHSP", "CSKH", "MKT", "TH", "TC", "NS", "KT"] as const;
export type Khoi = (typeof KHOI)[number];

export type NguoiXem = {
  role: string | null | undefined;
  email?: string | null;
  departmentMa?: string | null;
  departmentName?: string | null;
};

const THEO_MA: Record<string, Khoi[]> = {
  KD: ["KD", "KD-SÀN"],
  MKT: ["MKT", "TH"],
  TH: ["TH"],
  KHO: ["VHSP"],
  VHSP: ["VHSP"],
  CSKH: ["CSKH"],
  TC: ["TC"],
  BDH: ["NS", "KT"],
  NS: ["NS"],
  KT: ["KT"],
};

const THEO_TEN: { re: RegExp; khoi: Khoi[] }[] = [
  { re: /kinh doanh/i, khoi: ["KD", "KD-SÀN"] },
  { re: /marketing/i, khoi: ["MKT", "TH"] },
  { re: /thương hiệu|thuong hieu/i, khoi: ["TH"] },
  { re: /kho|hỗ trợ|ho tro/i, khoi: ["VHSP"] },
  { re: /chăm sóc|cham soc/i, khoi: ["CSKH"] },
  { re: /tài chính|tai chinh/i, khoi: ["TC"] },
  { re: /điều hành|dieu hanh/i, khoi: ["NS", "KT"] },
  { re: /nhân sự|nhan su/i, khoi: ["NS"] },
  { re: /kỹ thuật|ky thuat|dữ liệu|du lieu/i, khoi: ["KT"] },
];

export function khoiTheoPhong(ma?: string | null, ten?: string | null): Khoi[] {
  const m = (ma || "").trim().toUpperCase();
  if (m && THEO_MA[m]) return THEO_MA[m];
  const t = ten || "";
  for (const d of THEO_TEN) if (d.re.test(t)) return d.khoi;
  return [];
}

export const KHOI_BOD: Khoi[] = ["Chung", "KD", "KD-SÀN", "VHSP"];

export function khoiDuocXem(u: NguoiXem): Khoi[] | null {
  if (isBodRole(u.role)) return [...KHOI_BOD];
  if (!isManagerOrAbove(u.role)) return null;
  const goc: Khoi[] = isAdmin(u.role)
    ? [...KHOI]
    : ["Chung", ...khoiTheoPhong(u.departmentMa, u.departmentName)];
  const thayTC = isAdmin(u.role) || inFinanceWL(u.email);
  const ra = goc.filter((k, i) => goc.indexOf(k) === i && (k !== "TC" || thayTC));
  return ra;
}
