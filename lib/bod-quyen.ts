import { isBodRole } from "@/lib/auth";

export type QuyetDinhBod = "khong-ap-dung" | "cho" | "cam";

export const DUONG_BOD_DUOC_XEM = [
  "/",
  "/dashboard",
  "/chi-so",
  "/bao-cao-thang",
  "/gop-y-bod",
  "/bao-cao-bod",
  "/change-password",
  "/admin/bang-viec",
] as const;

export const DUONG_BOD_CAM = [
  "/bang-luong",
  "/phieu-luong",
  "/luong-cua-toi",
  "/hoa-hong-sale",
  "/api/hoa-hong-sale",
  "/hop-dong",
  "/admin/contracts",
  "/admin/payroll-import",
  "/admin/bonus-rules",
  "/admin/livestream",
  "/admin/api-keys",
  "/admin/accounts",
  "/nhan-su",
  "/leads",
  "/quiz-leads",
  "/danh-ba-khach",
  "/khach-360",
  "/tep-khach",
  "/admin/blog-leads",
  "/zalo",
  "/sales/khach-cua-toi",
  "/khach-nong",
  "/api/telesales-leads",
  "/api/care",
  "/api/quiz-leads",
  "/api/finance",
  "/api/hop-thu-zalo",
  "/bao-cao-bod/04-co-che-luong-thuong-nhan-su.html",
] as const;

function chuan(path: string): string {
  const sach = (path || "/").split("?")[0].split("#")[0] || "/";
  if (sach.length > 1 && sach.endsWith("/")) return sach.slice(0, -1);
  return sach;
}

function khop(path: string, mau: string): boolean {
  if (mau === "/") return path === "/";
  if (mau.endsWith(".html")) return path === mau;
  return path === mau || path.startsWith(mau + "/");
}

export function quyetDinhDuong(role: string | null | undefined, path: string): QuyetDinhBod {
  if (!isBodRole(role)) return "khong-ap-dung";
  const p = chuan(path);
  if (DUONG_BOD_CAM.some((m) => khop(p, m))) return "cam";
  if (DUONG_BOD_DUOC_XEM.some((m) => khop(p, m))) return "cho";
  return "cam";
}
