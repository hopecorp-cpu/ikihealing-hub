import { getT } from "@/lib/i18n-server";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { docDungKhanCap } from "@/lib/dung-khan-cap";
import { NHOM_DUNG } from "@/lib/dung-khan-cap-core";

export default async function DungKhanCapBar() {
  const { t: t } = getT();
  let ten: string[] = [];
  try {
    const tt = await docDungKhanCap();
    ten = NHOM_DUNG.filter((n) => tt[n.ma]).map((n) => n.ten);
  } catch { return null; }
  if (!ten.length) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm text-white">
      <ShieldAlert className="w-4 h-4 shrink-0" />
      <span><b>{t("Đang dừng khẩn cấp:")}</b> {ten.join(", ")}.</span>
      <Link href="/hop-duyet" className="underline font-semibold">{t("Xem ở Hộp duyệt")}</Link>
    </div>
  );
}
