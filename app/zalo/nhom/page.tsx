import { getT } from "@/lib/i18n-server";
import ChuaGanNick from "../ChuaGanNick";
import { redirect } from "next/navigation";
import { ZaloThanhTren, ZaloMenuNgang } from "../ZaloMobile";
import { getCurrentUser } from "@/lib/supabase-server";
import { layNhom, nickChoPhep } from "@/lib/hop-thu-zalo-server";
import { docCaiDatNhom } from "@/lib/zalo-nhom-cai-dat";
import NhomClient from "./NhomClient";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Nhóm Zalo | ACME Ops Hub") };
}

export default async function NhomZaloPage() {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const duocXem = await nickChoPhep(user);
  if (duocXem !== null && !duocXem.length) return <ChuaGanNick ten={user.full_name || ""} />;
  const ds = await layNhom(duocXem ?? []);
  const caiDat = await docCaiDatNhom();

  const daDo = ds.filter((n) => n.soThanhVien != null);
  const tongTv = daDo.reduce((s, n) => s + (n.soThanhVien || 0), 0);

  return (
    <div className="space-y-4 pb-4 lg:p-5">
      <ZaloThanhTren tieuDe={t("Nhóm")} />
      <ZaloMenuNgang />
      <div className="space-y-4 px-3 lg:px-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-lg font-semibold text-slate-900">{t("Nhóm cộng đồng Zalo")}</h1>
        <span className="text-sm text-slate-500">
          {ds.length} {t("nhóm")}
          {daDo.length ? ` · ${tongTv.toLocaleString("vi-VN")} thành viên (đo được ${daDo.length}/${ds.length} nhóm)` : ""}
        </span>
      </div>

      {daDo.length < ds.length && (
        <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
          {ds.length - daDo.length} {t("nhóm chưa đo được số thành viên — đó là")} <strong>{t("chưa đo được")}</strong>{t(",\n          không phải nhóm rỗng. Số thành viên do máy đếm riêng chạy 22:10 hằng ngày ghi vào.")}
        </p>
      )}

      <NhomClient
        ds={ds.map((n) => ({
          ownId: n.ownId, uid: n.uid, ten: t(n.ten), sale: n.sale,
          soThanhVien: n.soThanhVien, soTin: n.soTin, tinCuoiAt: n.tinCuoiAt,
        }))}
        caiDatDau={caiDat}
        laQuanLy={duocXem === null}
      />

      <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
        <strong>{t("Cho nhắn")}</strong> {t("tắt đi là chỉ trưởng/phó nhóm gửi được tin — đổi thật trên Zalo, nên\n        phải chờ máy ở nhà CEO làm xong (vài giây) rồi nhãn mới đổi. Chỉ quản lý bấm được.")}
        {" "}<strong>{t("Máy trả lời")}</strong> {t("chỉ đáp khi có người nhắc tên nick hoặc trả lời tin của nick,\n        không đáp tin thường; mọi câu vẫn qua cửa từ cấm thực phẩm bổ sung.")}
      </p>
      </div>
    </div>
  );
}
