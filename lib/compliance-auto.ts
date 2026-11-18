import type { CStatus } from "@/lib/compliance";

export type AutoHit = { status: CStatus; evidence: string };

const headCount = async (sb: any, table: string, build?: (q: any) => any): Promise<number> => {
  try {
    let q = sb.from(table).select("id", { count: "exact", head: true });
    if (build) q = build(q);
    const { count } = await q;
    return count || 0;
  } catch { return 0; }
};

export async function detectCompliance(sb: any): Promise<Record<string, AutoHit>> {
  const out: Record<string, AutoHit> = {};
  const nowICT = new Date(Date.now() + 7 * 3600e3);
  const month = nowICT.toISOString().slice(0, 7);
  const monthStart = `${month}-01`;
  const ny = nowICT.getUTCMonth() === 11 ? nowICT.getUTCFullYear() + 1 : nowICT.getUTCFullYear();
  const nm = nowICT.getUTCMonth() === 11 ? 1 : nowICT.getUTCMonth() + 2;
  const nextMonthStart = `${ny}-${String(nm).padStart(2, "0")}-01`;

  const users = await headCount(sb, "users", q => q.eq("active", true));
  if (users > 0) {
    out.ds_lao_dong = { status: "available", evidence: `Danh sách ${users} nhân sự đang hoạt động (module Nhân sự)` };
    out.so_quan_ly_ld = { status: "available", evidence: `Sổ lao động điện tử: ${users} người trong hệ thống` };
  }

  const contracts = await headCount(sb, "employment_contracts");
  if (contracts > 0) {
    out.hdld = contracts >= users
      ? { status: "available", evidence: `${contracts} hợp đồng lao động trong hệ thống` }
      : { status: "need_review", evidence: `Mới ${contracts}/${users} nhân sự có HĐLĐ điện tử — cần bổ sung cho đủ` };
    const terminated = await headCount(sb, "employment_contracts", q => q.not("terminated_at", "is", null));
    if (terminated > 0) out.cham_dut_ban_giao = { status: "need_review", evidence: `${terminated} HĐLĐ đã chấm dứt — rà soát hồ sơ bàn giao` };
  }

  const payroll = await headCount(sb, "payroll");
  const attendance = await headCount(sb, "attendance");
  if (payroll > 0) out.bang_cong_luong = { status: "available", evidence: `${payroll} kỳ lương + ${attendance} bản ghi chấm công` };
  if (attendance > 0) {
    const leaves = await headCount(sb, "leaves");
    out.thoi_gio_lam_viec = { status: "available", evidence: `Chấm công (${attendance}) + nghỉ phép (${leaves}) có dữ liệu` };
  }

  const bonus = await headCount(sb, "bonus_rules", q => q.eq("active", true));
  if (bonus > 0) out.quy_che_luong_kpi = { status: "available", evidence: `${bonus} quy tắc lương/thưởng/KPI đã cấu hình` };

  const insured = await headCount(sb, "payroll", q => q.gt("employee_insurance", 0));
  if (insured > 0) out.bhxh = { status: "available", evidence: `${insured} kỳ lương có khấu trừ BHXH/BHYT/BHTN` };

  let misaOrders = 0;
  try {
    const { data } = await sb.from("mshopkeeper_line_items").select("order_code").gte("order_date", monthStart).lt("order_date", nextMonthStart);
    misaOrders = new Set((data || []).map((r: any) => r.order_code)).size;
  } catch { }
  const bankTxn = await headCount(sb, "bank_transactions");
  const bankStmt = await headCount(sb, "bank_statements");

  if (misaOrders > 0) {
    out.hoa_don = { status: "available", evidence: `MISA: ${misaOrders} đơn/hoá đơn điện tử tháng ${month}` };
    out.chung_tu_so_sach = { status: "available", evidence: `Sổ sách qua MISA${bankTxn ? ` + ${bankTxn} giao dịch ngân hàng` : ""}` };
    out.bctc = { status: "need_review", evidence: `Có P&L nội bộ + lãi gộp từ MISA — BCTC chính thức do kế toán lập/nộp` };
    out.luu_tru_ke_toan = { status: "need_review", evidence: `Chứng từ lưu trên MISA — rà soát thời hạn lưu theo luật` };
  }
  if (bankTxn > 0) out.dong_tien = { status: "available", evidence: `${bankTxn} giao dịch · ${bankStmt} sao kê ngân hàng đã nạp/đối chiếu` };

  const taxed = await headCount(sb, "payroll", q => q.gt("personal_income_tax", 0));
  if (taxed > 0) out.thue = { status: "need_review", evidence: `${taxed} kỳ lương khấu trừ TNCN; GTGT/TNDN do kế toán kê khai — xác nhận đã nộp` };

  const loans = await headCount(sb, "loans");
  if (loans > 0 || misaOrders > 0) out.cong_no = { status: "need_review", evidence: `${loans} khoản vay theo dõi${misaOrders ? ` + công nợ đơn hàng MISA` : ""} — đối chiếu định kỳ` };

  return out;
}
