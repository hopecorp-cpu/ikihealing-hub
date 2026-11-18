"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { tinhLaiKyChuaTra } from "@/lib/lai-vay";

async function requireAdmin() {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập");
  const sb = getServiceClient();
  const { data: profile } = await sb.from("users").select("role").eq("id", user.id).maybeSingle();
  if (!profile || (profile.role !== "admin" && profile.role !== "ceo")) throw new Error("Không có quyền");
  return { sb, adminId: user.id };
}

export async function markPaymentPaid(input: { paymentId: string; paid_date: string; ref_code?: string; payment_method?: string }) {
  const { sb } = await requireAdmin();
  const { data: pay } = await sb.from("loan_payments").select("*").eq("id", input.paymentId).maybeSingle();
  if (!pay) return { success: false, error: "Không tìm thấy" };
  await sb.from("loan_payments").update({
    status: "paid",
    paid_date: input.paid_date,
    ref_code: input.ref_code,
    payment_method: input.payment_method,
    paid_at: new Date().toISOString()
  }).eq("id", input.paymentId);

  if (pay.payment_type === "principal") {
    const { data: loan } = await sb.from("loans").select("outstanding_principal,principal_amount").eq("id", pay.loan_id).maybeSingle();
    if (loan) {
      const newOutstanding = Math.max(0, (loan.outstanding_principal || 0) - (pay.gross_amount || 0));
      const newStatus = newOutstanding === 0 ? "paid_off" : "active";
      await sb.from("loans").update({ outstanding_principal: newOutstanding, status: newStatus }).eq("id", pay.loan_id);
    }

    await tinhLaiKyChuaTra(sb, pay.loan_id);
  }

  revalidatePath("/admin/loans");
  return { success: true };
}

export async function seedLoansFromFile() {
  const { sb } = await requireAdmin();

  const { data: hd1Existing } = await sb.from("loans").select("id").eq("contract_code", "HĐ1-2024").maybeSingle();
  let hd1Id = hd1Existing?.id;
  if (!hd1Id) {
    const { data: hd1 } = await sb.from("loans").insert({
      contract_code: "HĐ1-2024", lender: "Bùi Thị Hạnh",
      principal_amount: 300_000_000, interest_rate: 0.06, withholding_tax_rate: 0.05,
      start_date: "2024-07-14", end_date: "2026-03-27",
      payment_frequency: "quarterly", outstanding_principal: 0,
      status: "paid_off", notes: "Tất toán 27/03/2026"
    }).select("id").single();
    hd1Id = hd1?.id;
  }

  const { data: hd2Existing } = await sb.from("loans").select("id").eq("contract_code", "HĐ2-2026").maybeSingle();
  let hd2Id = hd2Existing?.id;
  if (!hd2Id) {
    const { data: hd2 } = await sb.from("loans").insert({
      contract_code: "HĐ2-2026", lender: "Bùi Thị Hạnh",
      principal_amount: 1_000_000_000, interest_rate: 0.06, withholding_tax_rate: 0.05,
      start_date: "2026-01-15", payment_frequency: "quarterly",
      outstanding_principal: 1_000_000_000, status: "active",
      notes: "1 tỷ, lãi 6%/năm"
    }).select("id").single();
    hd2Id = hd2?.id;
  }

  if (!hd1Id || !hd2Id) return { success: false, error: "Không tạo được loan" };

  await sb.from("loan_payments").delete().in("loan_id", [hd1Id, hd2Id]);

  const hd1Payments = [
    { period: "Q3/2024", period_start: "2024-07-14", period_end: "2024-10-13", days_in_period: 92, gross_amount: 4536986, withholding_tax: 226849, net_amount: 4310137, status: "paid", payment_type: "interest" },
    { period: "Q4/2024", period_start: "2024-10-14", period_end: "2025-01-13", days_in_period: 92, gross_amount: 4536986, withholding_tax: 226849, net_amount: 4310137, status: "paid", payment_type: "interest" },
    { period: "Q1/2025", period_start: "2025-01-14", period_end: "2025-04-13", days_in_period: 90, gross_amount: 4438356, withholding_tax: 221918, net_amount: 4216438, status: "paid", payment_type: "interest" },
    { period: "Q2/2025", period_start: "2025-04-14", period_end: "2025-07-13", days_in_period: 91, gross_amount: 4487671, withholding_tax: 224384, net_amount: 4263288, status: "paid", payment_type: "interest" },
    { period: "Q3/2025", period_start: "2025-07-14", period_end: "2025-10-13", days_in_period: 92, gross_amount: 4536986, withholding_tax: 226849, net_amount: 4310137, status: "paid", payment_type: "interest" },
    { period: "Q4/2025", period_start: "2025-10-14", period_end: "2026-01-13", days_in_period: 92, gross_amount: 4536986, withholding_tax: 226849, net_amount: 4310137, status: "paid", payment_type: "interest" },
    { period: "Q1/2026 + Tất toán", period_start: "2026-01-14", period_end: "2026-03-27", paid_date: "2026-03-27", gross_amount: 11897256, withholding_tax: 594863, net_amount: 11302393, status: "paid", payment_method: "MB Bank", ref_code: "FT26086882535802", payment_type: "interest", notes: "Lãi cuối + tất toán cùng ngày" },
    { period: "Tất toán gốc", paid_date: "2026-03-27", gross_amount: 300000000, net_amount: 300000000, status: "paid", payment_method: "MB Bank", ref_code: "FT26086072053416", payment_type: "principal", notes: "Tất toán gốc HĐ1" }
  ].map(p => ({ ...p, loan_id: hd1Id }));

  const quarterlyInt = Math.round(1_000_000_000 * 0.06 / 4);
  const hd2Payments = [
    { period: "Q1/2026 (trả trước)", paid_date: "2026-02-26", gross_amount: 5096000, withholding_tax: 254900, net_amount: 4841100, status: "paid", payment_method: "MB Bank", payment_type: "interest", notes: "Trả trước bà Thuyết" },
    { period: "Q2/2026", period_start: "2026-04-15", period_end: "2026-07-14", due_date: "2026-07-15", gross_amount: quarterlyInt, withholding_tax: Math.round(quarterlyInt * 0.05), net_amount: quarterlyInt - Math.round(quarterlyInt * 0.05), status: "pending", payment_type: "interest" },
    { period: "Q3/2026", period_start: "2026-07-15", period_end: "2026-10-14", due_date: "2026-10-15", gross_amount: quarterlyInt, withholding_tax: Math.round(quarterlyInt * 0.05), net_amount: quarterlyInt - Math.round(quarterlyInt * 0.05), status: "pending", payment_type: "interest" },
    { period: "Q4/2026", period_start: "2026-10-15", period_end: "2027-01-14", due_date: "2027-01-15", gross_amount: quarterlyInt, withholding_tax: Math.round(quarterlyInt * 0.05), net_amount: quarterlyInt - Math.round(quarterlyInt * 0.05), status: "pending", payment_type: "interest" }
  ].map(p => ({ ...p, loan_id: hd2Id }));

  await sb.from("loan_payments").insert([...hd1Payments, ...hd2Payments]);

  revalidatePath("/admin/loans");
  return { success: true, hd1Payments: hd1Payments.length, hd2Payments: hd2Payments.length };
}
