import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { listQuizOrders } from "@/lib/payos";
import { donWebDaCoTrongSo } from "@/lib/don-web";
import DonWebClient from "./client";

export const dynamic = "force-dynamic";

export default async function DonWebPage() {
  const { t: t } = getT();
  const user: any = await getCurrentUser();
  if (!user || !isManagerOrAbove(user.role)) redirect("/");
  const ds = await listQuizOrders();

  let daVaoSo: Record<string, string> = {};
  let loiSo = "";
  try { daVaoSo = await donWebDaCoTrongSo(getServiceClient(), ds); } catch (e: any) { loiSo = String(e?.message || e); }
  return (
    <div className="p-5 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">{t("Đơn web (example.com)")}</h1>
      <p className="text-sm text-gray-500 mb-4">
        {t("Đơn khách đặt ở /shop và /quiz. Đổi trạng thái xử lý, ghi mã vận đơn, ghi chú nội bộ. Đơn chuyển khoản\n        tự vào sổ doanh thu khi tiền về; đơn COD bấm")} <b>{t("Chốt vào sổ")}</b> {t("sau khi gọi xác nhận. Sale đã gõ đơn vào nhóm\n        Đơn Hàng thì máy tự nhận ra trùng (cùng SĐT, cùng tiền) và không ghi lần hai.")}
      </p>
      {loiSo && <p className="text-red-600 text-sm mb-3">{t("Chưa đọc được sổ doanh thu:")} {loiSo} {t("— cột \"Sổ\" dưới đây chưa đúng.")}</p>}
      <DonWebClient ds={ds} daVaoSo={daVaoSo} />
    </div>
  );
}
