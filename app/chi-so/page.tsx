import { getT } from "@/lib/i18n-server";

import TrangChiSo from "@/lib/chi-so/trang";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Bảng chỉ số — ACME Hub") };
}

export default TrangChiSo;
