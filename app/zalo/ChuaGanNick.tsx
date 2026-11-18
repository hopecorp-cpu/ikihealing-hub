import { getT } from "@/lib/i18n-server";
import { UserX } from "lucide-react";

export default function ChuaGanNick({ ten }: { ten: string }) {
  const { t: t } = getT();
  return (
    <div className="mx-auto max-w-lg p-8 text-center">
      <UserX className="mx-auto h-10 w-10 text-slate-300" />
      <h2 className="mt-3 text-base font-semibold text-slate-800">{t("Tài khoản")} {ten || t("này")} {t("chưa cầm nick Zalo nào")}</h2>
      <p className="mt-1 text-sm text-slate-500">
        {t("Khu Zalo chỉ hiện hội thoại của nick anh/chị đang cầm. Chưa được gán nick thì không có gì để xem —\n        nhờ quản lý nối nick ở mục")} <b>{t("Kết nối Zalo")}</b> {t("hoặc kiểm tên trong sổ nhân sự khớp với tên gắn nick.")}
      </p>
    </div>
  );
}
