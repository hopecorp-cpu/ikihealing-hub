type KhoanVay = { id: string; principal_amount: number; interest_rate: number; withholding_tax_rate: number | null };
type KyTra = {
  id: string; payment_type: string; status: string;
  period_start: string | null; period_end: string | null;
  paid_date: string | null; gross_amount: number | null;
};

const NGAY = 86_400_000;
const d = (s: string) => new Date(`${s}T00:00:00Z`).getTime();

export function laiTrongKy(vay: KhoanVay, ky: KyTra[], tu: string, den: string): number {
  const traGoc = ky
    .filter((k) => k.payment_type === "principal" && k.status === "paid" && k.paid_date)
    .map((k) => ({ ngay: d(k.paid_date as string), tien: Number(k.gross_amount) || 0 }));
  let tong = 0;
  for (let t = d(tu); t <= d(den); t += NGAY) {
    const daTra = traGoc.filter((g) => g.ngay <= t).reduce((s, g) => s + g.tien, 0);
    const duNo = Math.max(0, Number(vay.principal_amount) - daTra);
    tong += (duNo * Number(vay.interest_rate)) / 365;
  }
  return Math.round(tong);
}

export async function tinhLaiKyChuaTra(sb: any, loanId: string): Promise<{ doi: number; loi?: string }> {
  const [{ data: vay, error: e1 }, { data: ky, error: e2 }] = await Promise.all([
    sb.from("loans").select("id,principal_amount,interest_rate,withholding_tax_rate").eq("id", loanId).maybeSingle(),
    sb.from("loan_payments").select("id,payment_type,status,period_start,period_end,paid_date,gross_amount").eq("loan_id", loanId),
  ]);
  if (e1 || e2 || !vay) return { doi: 0, loi: e1?.message || e2?.message || "Không thấy khoản vay" };
  const thue = Number(vay.withholding_tax_rate ?? 0.05);
  let doi = 0;
  for (const k of (ky as KyTra[]).filter((k) => k.payment_type === "interest" && k.status === "pending" && k.period_start && k.period_end)) {
    const gross = laiTrongKy(vay, ky, k.period_start as string, k.period_end as string);
    if (gross === Number(k.gross_amount)) continue;
    const tax = Math.round(gross * thue);
    const { error } = await sb.from("loan_payments")
      .update({ gross_amount: gross, withholding_tax: tax, net_amount: gross - tax })
      .eq("id", k.id).eq("status", "pending");
    if (error) return { doi, loi: error.message };
    doi++;
  }
  return { doi };
}
