import { getT } from "@/lib/i18n-server";
import Link from "next/link";
import ChuaGanNick from "./ChuaGanNick";
import { redirect } from "next/navigation";
import { ZaloThanhTren, ZaloMenuNgang } from "./ZaloMobile";
import { getCurrentUser } from "@/lib/supabase-server";
import { layTongQuan, layTrangThaiKho, nickChoPhep } from "@/lib/hop-thu-zalo-server";
import { doTre } from "@/lib/hop-thu-zalo";
import { MessageSquare, UsersRound, Clock, WifiOff, AlertTriangle, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Tổng quan Zalo | ACME Ops Hub") };
}

export default async function TongQuanZaloPage() {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const duocXem = await nickChoPhep(user);
  if (duocXem !== null && !duocXem.length) return <ChuaGanNick ten={user.full_name || ""} />;
  const [tq, kho] = await Promise.all([layTongQuan(duocXem ?? []), layTrangThaiKho()]);

  const khoCu = !kho.ok || (kho.gioTre ?? 99) >= 8;
  const nickChet = tq.theoNick.filter((n) => n.song === false);

  return (
    <div className="space-y-4 pb-4 lg:p-5">
      <ZaloThanhTren tieuDe={t("Thông báo")} />
      <ZaloMenuNgang />
      <div className="space-y-4 px-3 lg:px-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-lg font-semibold text-slate-900">{t("Tổng quan Zalo")}</h1>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            khoCu ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          {kho.at ? `Kho cập nhật ${doTre(kho.gioTre)} trước` : t("Kho chưa có lượt đổ nào")}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <O nhan={t("Cần trả lời trong tuần")} so={tq.choTrongTuan} mau="text-rose-600" phu={t("khách chờ ≤ 7 ngày")} />
        <O nhan={t("Đang chờ, tính cả tồn")} so={tq.choTatCa} phu={`${tq.choQua30Ngay} người đã quá 30 ngày`} />
        <O nhan={t("Chưa đọc")} so={tq.soChuaDoc} phu={t("hội thoại có tin chưa mở")} />
        <O nhan={t("Hội thoại 1-1")} so={tq.tongHoiThoai} phu={`${tq.soNhom} nhóm cộng đồng`} />
      </div>

      {nickChet.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <div className="text-sm text-rose-800">
            <p className="font-medium">{nickChet.length} {t("nick Zalo mất kết nối:")} {nickChet.map((n) => n.sale || n.ownId).join(", ")}</p>
            <p className="mt-0.5 text-xs text-rose-700">
              {t("Khách nhắn vào nick đó KHÔNG vào hệ thống, còn hội thoại cũ vẫn nằm trong hàng chờ và mỗi ngày một già thêm.\n              Sale cầm hotline bấm")} <b>{t("Quét QR nối lại")}</b> {t("trên banner đỏ (mọi trang Zalo CRM) — quét bằng điện thoại, không cần đứng máy cào. Máy cầu nối văn phòng vẫn phải chạy.")}
            </p>
            <Link href="/zalo/ket-noi" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-rose-800 underline">
              {t("Mở Kết nối Zalo")} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{t("Theo từng nick")}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                <th className="px-4 py-2 font-medium">Nick</th>
                <th className="px-4 py-2 font-medium">{t("Hội thoại")}</th>
                <th className="px-4 py-2 font-medium">{t("Chờ trong tuần")}</th>
                <th className="px-4 py-2 font-medium">{t("Chờ tất cả")}</th>
                <th className="px-4 py-2 font-medium">{t("Quá 30 ngày")}</th>
                <th className="px-4 py-2 font-medium">{t("Ca lâu nhất")}</th>
              </tr>
            </thead>
            <tbody>
              {tq.theoNick.map((n) => (
                <tr key={n.ownId} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-slate-900">{n.sale || n.ownId}</span>
                    {n.song === false && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">OFF</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{n.hoiThoai}</td>
                  <td className="px-4 py-2.5 font-medium text-rose-600">{n.choTrongTuan}</td>
                  <td className="px-4 py-2.5 text-slate-600">{n.cho}</td>
                  <td className="px-4 py-2.5 text-slate-600">{n.choQua30Ngay}</td>
                  <td className="px-4 py-2.5 text-slate-500">{n.lauNhatNgay != null ? `${n.lauNhatNgay} ngày` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 px-4 py-2.5">
          <Link href="/zalo/tin-nhan" className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline">
            {t("Mở hộp thư")} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <Link href="/zalo/nhom" className="rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <UsersRound className="h-4 w-4" /> {t("Nhóm cộng đồng")}
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{tq.soNhom}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {tq.nhomThanhVien != null
              ? `${tq.nhomThanhVien.toLocaleString("vi-VN")} thành viên (đo được ${tq.nhomDaDo} nhóm)`
              : t("Chưa đo được số thành viên")}
          </p>
        </Link>

        <Link href="/zalo/khach-hang" className="rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <MessageSquare className="h-4 w-4" /> {t("Khách Zalo")}
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{tq.tongHoiThoai}</p>
          <p className="mt-0.5 text-xs text-slate-500">{t("Gắn thẻ theo đơn hàng thật, không theo cờ bấm tay")}</p>
        </Link>
      </section>

      {khoCu && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {t("Kho chat đang cũ. Máy đổ chạy trên máy Mac của CEO (")}{" "}
            <code className="rounded bg-amber-100 px-1">node scripts/zalo-hop-thu.mjs</code>{" "}
            {t("), máy tắt thì mọi số ở đây đứng yên chứ không phải khách ngừng nhắn.")}
          </span>
        </p>
      )}
      </div>
    </div>
  );
}

function O({ nhan, so, phu, mau }: { nhan: string; so: number; phu?: string; mau?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
      <p className="text-xs text-slate-500">{nhan}</p>
      <p className={`mt-1 text-2xl font-semibold ${mau || "text-slate-900"}`}>{so.toLocaleString("vi-VN")}</p>
      {phu && <p className="mt-0.5 text-[11px] text-slate-400">{phu}</p>}
    </div>
  );
}
