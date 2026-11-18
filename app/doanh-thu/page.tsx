import { getT } from "@/lib/i18n-server";
import RevenueManager from "./RevenueManager";

export function generateMetadata() {
  const { t } = getT();
  return { title: t("Doanh thu — Kế toán nhập | ACME Ops Hub") };
}

export default function DoanhThuPage() {
  return <RevenueManager />;
}
