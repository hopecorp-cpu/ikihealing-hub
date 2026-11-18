export type Role = "admin" | "ceo" | "manager" | "employee" | "bod" | "bod_viewer";

export const ROLE_GAN: { value: Role; label: string }[] = [
  { value: "employee", label: "Nhân viên" },
  { value: "manager", label: "Manager" },
  { value: "ceo", label: "CEO" },
  { value: "admin", label: "Admin (HR)" },
  { value: "bod", label: "BOD — xem và ghi nhận" },
  { value: "bod_viewer", label: "BOD — chỉ xem" },
];

export function isAdmin(role: Role | string | null | undefined): boolean {
  return role === "admin" || role === "ceo";
}

export function isManager(role: Role | string | null | undefined): boolean {
  return role === "manager";
}

export function isManagerOrAbove(role: Role | string | null | undefined): boolean {
  return isAdmin(role) || isManager(role);
}

export function isEmployee(role: Role | string | null | undefined): boolean {
  return role === "employee";
}

export function isBod(role: Role | string | null | undefined): boolean {
  return role === "bod";
}

export function isBodViewer(role: Role | string | null | undefined): boolean {
  return role === "bod_viewer";
}

export function isBodRole(role: Role | string | null | undefined): boolean {
  return role === "bod" || role === "bod_viewer";
}

export function coTheGhiNhanBaoCao(role: Role | string | null | undefined): boolean {
  return !isBodViewer(role);
}

export function isMktPosition(position?: string | null): boolean {
  return /mkt|marketing|content|media|page|truyền thông/i.test(position || "");
}

export function isAccountantPosition(position?: string | null): boolean {
  return /kế toán|ke toan|tài chính|tai chinh|accountant/i.test(position || "");
}

export function isSalePosition(position?: string | null): boolean {
  return /sale|kinh doanh|t[uư]\s*v[aấ]n|tr[uự]c\s*page|chốt đơn/i.test(position || "");
}

export function isCskhPosition(position?: string | null): boolean {
  return /cskh|ch[aă]m\s*s[oó]c|customer\s*care|customer\s*success|h[aậ]u\s*m[aã]i/i.test(position || "");
}

export function isKhoPosition(position?: string | null): boolean {
  return /kho|warehouse|v[aậ]n\s*h[aà]nh|logistic|h[oỗ]\s*tr[oợ]/i.test(position || "");
}

export function isAdvisorPosition(position?: string | null): boolean {
  return /c[oố]\s*v[aấ]n|advisor|board/i.test(position || "");
}

const dsEmail = (v?: string) => (v || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
export const BOD_EMAILS = dsEmail(process.env.NEXT_PUBLIC_BOD_EMAILS);
export const ACCOUNTANT_EMAILS = dsEmail(process.env.NEXT_PUBLIC_ACCOUNTANT_EMAILS);
export const DATAROOM_WHITELIST = [...BOD_EMAILS, ...ACCOUNTANT_EMAILS];

export const FULL_TRU_INVESTOR = dsEmail(process.env.NEXT_PUBLIC_INVESTOR_EMAILS);
export const isFullTruInvestor = (email?: string | null) => FULL_TRU_INVESTOR.includes((email || "").toLowerCase().trim());

export const FINANCE_WHITELIST = [...DATAROOM_WHITELIST, ...FULL_TRU_INVESTOR];
export const inFinanceWL = (email?: string | null) => FINANCE_WHITELIST.includes((email || "").toLowerCase().trim());

export function canViewDataroom(user?: { role?: string | null; email?: string | null; position?: string | null } | null): boolean {
  if (!user) return false;
  if (isFullTruInvestor(user.email)) return false;
  if (isAdmin(user.role)) return true;
  const email = (user.email || "").toLowerCase().trim();
  if (DATAROOM_WHITELIST.includes(email)) return true;
  return isAdvisorPosition(user.position);
}

export function canViewTuanThu(user?: { role?: string | null; email?: string | null; position?: string | null } | null): boolean {
  return canViewDataroom(user) || (!!user && isFullTruInvestor(user.email));
}

export function canManageDataroom(user?: { role?: string | null; email?: string | null } | null): boolean {
  if (!user) return false;
  if (isFullTruInvestor(user.email)) return false;
  if (isAdmin(user.role)) return true;
  return DATAROOM_WHITELIST.includes((user.email || "").toLowerCase().trim());
}

export const can = {
  manageEmployees: (role: string | null | undefined) => isAdmin(role),
  viewAllPayroll: (role: string | null | undefined) => isAdmin(role),
  viewOwnPayslip: (role: string | null | undefined) => !isBodRole(role),
  empireAudit: (role: string | null | undefined) => isAdmin(role),
  viewAllKpi: (role: string | null | undefined) => isAdmin(role),
  viewTeamKpi: (role: string | null | undefined) => isManagerOrAbove(role),
  manageSalesOps: (role: string | null | undefined) => isManagerOrAbove(role),
  managePhongBan: (role: string | null | undefined) => isAdmin(role),
  manageChuKy: (role: string | null | undefined) => isAdmin(role),
  approveLeaves: (role: string | null | undefined) => isManagerOrAbove(role),
  viewBIDashboard: (role: string | null | undefined) => isManagerOrAbove(role),
  editAttendance: (role: string | null | undefined) => isAdmin(role)
};
