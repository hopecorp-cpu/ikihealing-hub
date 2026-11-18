import { getServiceClient } from "@/lib/supabase-server";

export type BankBalance = { name: string; account: string; balance: number; periodTo: string };

export async function getBankBalances(): Promise<{ banks: BankBalance[]; total: number }> {
  const sb = getServiceClient();
  const { data } = await sb
    .from("bank_statements")
    .select("bank_name, account_number, period_to, total_credit, total_debit, uploaded_at")
    .order("uploaded_at", { ascending: false });
  const seen = new Set<string>();
  const banks: BankBalance[] = [];
  for (const s of data ?? []) {
    const key = `${s.bank_name}|${s.account_number}`;
    if (seen.has(key)) continue;
    seen.add(key);
    banks.push({
      name: s.bank_name || "?",
      account: s.account_number || "",
      balance: (s.total_credit || 0) - (s.total_debit || 0),
      periodTo: s.period_to || "",
    });
  }
  const total = banks.reduce((a, b) => a + b.balance, 0);
  return { banks, total };
}
