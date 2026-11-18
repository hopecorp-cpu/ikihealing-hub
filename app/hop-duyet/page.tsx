import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isAdmin, isBodRole, isManagerOrAbove } from "@/lib/auth";
import { PageHeader } from "@/components/ui/kit";
import { docHopDuyet } from "@/lib/hop-duyet";
import { quaHan, tuoiGio } from "@/lib/hop-duyet-core";
import { docDungKhanCap, docNhatKyDung } from "@/lib/dung-khan-cap";
import HopDuyetClient from "./Client";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Hộp duyệt | ACME Ops Hub") };
}

export default async function Page() {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isBodRole(user.role)) redirect("/");

  const quanLy = isManagerOrAbove(user.role);
  const [{ muc, nguonHong }, dung, nhatKy] = await Promise.all([
    docHopDuyet(getServiceClient(), user),
    docDungKhanCap(),
    quanLy ? docNhatKyDung() : Promise.resolve([]),
  ]);
  const now = Date.now();
  const ds = muc.map((m) => ({ ...m, tuoi: tuoiGio(m, now), quaHan: quaHan(m, now) }));
  const soQuaHan = ds.filter((m) => m.quaHan).length;

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl">
      <PageHeader icon={ClipboardCheck} title={t("Hộp duyệt")}
        subtitle={ds.length
          ? `${ds.length} mục đang chờ bạn${soQuaHan ? `, ${soQuaHan} mục đã quá hạn` : ""}. Chỉ hiện mục bạn có quyền duyệt.`
          : t("Chỉ hiện mục bạn có quyền duyệt.")} />
      <HopDuyetClient muc={ds} nguonHong={nguonHong} dung={dung} nhatKy={nhatKy.slice(0, 20)}
        coTheDung={quanLy} coTheMo={isAdmin(user.role)} />
    </div>
  );
}
