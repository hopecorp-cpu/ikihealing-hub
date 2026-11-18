import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { getConfigValue } from "@/lib/app-config";
import { docCuaHang } from "@/lib/cua-hang";
import CuaHangClient from "./client";

export const dynamic = "force-dynamic";

export default async function CuaHangPage() {
  const { t: t } = getT();
  const user: any = await getCurrentUser();
  if (!user || !isManagerOrAbove(user.role)) redirect("/");
  const ds = await docCuaHang();
  let lichSu: { luc: string; ai: string; doi: string[] }[] = [];
  try { lichSu = JSON.parse((await getConfigValue("shop_san_pham_lich_su")) || "[]"); } catch {}
  return (
    <div className="p-5 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">{t("Cửa hàng web (example.com/shop)")}</h1>
      <p className="text-sm text-gray-500 mb-2">
        {t("Sửa tên, giá, ảnh, quà tặng, ẩn/hiện và thứ tự sản phẩm. Bấm Lưu thì khoảng một phút sau web đổi theo, không cần\n        dựng lại trang. Mọi chữ khách đọc được soi từ cấm trước khi lưu; quà là TẶNG QUÀ, không ghi giảm %.")}
      </p>
      <p className="text-sm text-gray-500 mb-4">
        {t("Hết hàng: bật trên từng món thì web vẫn hiện trang, giá và quà, gắn nhãn Hết hàng và khoá nút đặt. Kênh Zalo và sale không đổi.")}
      </p>
      <CuaHangClient dsBanDau={ds} lichSu={lichSu.slice(0, 10)} />
    </div>
  );
}
