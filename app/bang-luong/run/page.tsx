import { requireAdmin } from "@/lib/auth-server";
import { previewMonthlyCalc } from "./actions";
import { RunWizard } from "./client";

export const dynamic = "force-dynamic";

export default async function RunPayrollPage({ searchParams }: { searchParams: { m?: string } }) {
  await requireAdmin();
  const month = searchParams.m || new Date().toISOString().slice(0, 7);

  let preview: any = null;
  try {
    preview = await previewMonthlyCalc(month);
  } catch (err: any) {
    preview = { error: err.message };
  }

  return <RunWizard month={month} preview={preview} />;
}
