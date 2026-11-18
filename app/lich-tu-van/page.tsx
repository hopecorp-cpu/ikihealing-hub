import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { consultStaff, listByDate, showRate, DEFAULT_SLOTS } from "@/lib/consultations";
import { vnDateStr } from "@/lib/payroll";
import ConsultClient from "./ConsultClient";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Lịch tư vấn 1-1 | ACME Ops Hub") };
}

export default async function Page({ searchParams }: { searchParams?: { ngay?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const today = vnDateStr();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(searchParams?.ngay || "") ? (searchParams!.ngay as string) : today;
  const weekAgo = new Date(Date.now() + 7 * 3600e3 - 7 * 86400e3).toISOString().slice(0, 10);

  const [staff, rows, rate] = await Promise.all([
    consultStaff().catch(() => []),
    listByDate(date).catch(() => []),
    showRate(weekAgo, today).catch(() => ({ total: 0, den: 0, vang: 0, huy: 0, cho: 0, ratePct: null })),
  ]);

  const days = Array.from({ length: 7 }, (_, i) => new Date(Date.now() + 7 * 3600e3 + i * 86400e3).toISOString().slice(0, 10));

  return <ConsultClient date={date} today={today} days={days} slots={DEFAULT_SLOTS} staff={staff} rows={rows} rate={rate} />;
}
