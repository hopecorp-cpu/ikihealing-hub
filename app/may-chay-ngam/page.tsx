import { getT } from "@/lib/i18n-server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { buildMachineBoard } from "@/lib/machine-monitor";
import { checkAllSources } from "@/lib/watchdog";
import { tinhTrangHangDoi } from "@/lib/cc-queue";
import { layBanDoMay } from "@/lib/may-chay-ngam";
import BanDoMay from "./BanDoMay";
import { PageHeader, Badge } from "@/components/ui/kit";
import { Activity, CheckCircle2, AlertTriangle, HelpCircle, Server, Laptop, ListChecks } from "lucide-react";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Máy chạy ngầm | ACME Ops Hub") };
}

export default async function Page() {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove(user.role)) redirect("/");

  const [board, sources, hangDoi, banDo] = await Promise.all([
    buildMachineBoard().catch(() => ({ rows: [], okCount: 0, badCount: 0, unknownCount: 0 })),
    checkAllSources().catch(() => []),
    tinhTrangHangDoi().catch(() => null),
    layBanDoMay().catch(() => null),
  ]);
  const badSources = sources.filter((s) => !s.ok);

  const coViec = !!hangDoi && (hangDoi.choDuyet + hangDoi.daDuyetChoLam + hangDoi.dangLam) > 0;
  const tacNghen = !!hangDoi && hangDoi.daDuyetChoLam > 0 && !hangDoi.nhip.song;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <PageHeader
        title={t("Máy chạy ngầm")}
        subtitle={t("Mỗi cỗ máy chạy lúc nào, lần cuối làm ra cái gì, hỏng thì sửa ở đâu")}
        icon={Activity}
        actions={
          <div className="flex gap-2 text-[12px]">
            <Badge tone="green" dot>{board.okCount} {t("chạy tốt")}</Badge>
            {board.badCount > 0 && <Badge tone="red" dot>{board.badCount} {t("hỏng")}</Badge>}
            <Badge tone="gray" dot>{board.unknownCount} {t("chưa rõ")}</Badge>
          </div>
        }
      />

      {banDo && (
        <>
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]">
            <span className="font-bold text-gray-800 text-[13px]">{t("Sơ đồ dây chuyền")}</span>
            <span className="text-emerald-700">{banDo.dem.chay} {t("đang chạy")}</span>
            <span className={banDo.dem.chet ? "text-rose-700 font-semibold" : "text-gray-400"}>{banDo.dem.chet} {t("đứt")}</span>
            {banDo.dem.chuaRo > 0 && <span className="text-gray-400" title={t("Chạy theo lịch mà không để lại nhịp — chưa chứng minh được là đang chạy")}>{banDo.dem.chuaRo} {t("chưa ghi mốc")}</span>}
            {banDo.dem.tat > 0 && <span className="text-gray-400" title={t("CEO chốt chưa bật — im vì được bảo im")}>{banDo.dem.tat} {t("tắt theo lệnh")}</span>}
            {banDo.dem.chetKhongChayLaiDuoc > 0 && (
              <span className="text-amber-800">{banDo.dem.chetKhongChayLaiDuoc} {t("trong số đứt cần chính tay anh (captcha/OTP/quét QR, hoặc chạy lại sẽ gửi trùng)")}</span>
            )}
            <span className={banDo.nhipMac.song ? "text-gray-400 ml-auto" : "text-amber-800 ml-auto font-semibold"}>
              {t("Máy văn phòng:")} {banDo.nhipMac.song ? t("đang chạy (nhịp {h}h trước)").replace("{h}", String(banDo.nhipMac.gio)) : banDo.nhipMac.gio === null ? t("chưa từng báo nhịp") : t("TẮT (nhịp {h}h trước)").replace("{h}", String(banDo.nhipMac.gio))}
            </span>
          </div>
          <BanDoMay chuoi={banDo.chuoi} nhipMac={banDo.nhipMac} />
        </>
      )}

      {coViec && (
        <div className={`rounded-2xl border p-4 ${tacNghen ? "border-amber-200 bg-amber-50/70" : "border-gray-100 bg-white shadow-sm"}`}>
          <div className={`text-[13px] font-bold inline-flex items-center gap-1 mb-1.5 ${tacNghen ? "text-amber-800" : "text-gray-800"}`}>
            <ListChecks className="w-4 h-4" />{t("Hàng đợi việc giao cho máy")}
          </div>
          <div className="text-[12.5px] text-gray-700">
            {hangDoi!.choDuyet} {t("chờ duyệt ·")} <b>{hangDoi!.daDuyetChoLam} {t("đã duyệt đang chờ làm")}</b> · {hangDoi!.dangLam} {t("đang làm")}
            {hangDoi!.lauNhatPhut != null && hangDoi!.daDuyetChoLam > 0 && (
              <> {t("· việc chờ lâu nhất")} {hangDoi!.lauNhatPhut < 60 ? t("{p} phút").replace("{p}", String(hangDoi!.lauNhatPhut)) : t("{g} giờ").replace("{g}", String(Math.round(hangDoi!.lauNhatPhut / 60 * 10) / 10))}</>
            )}
          </div>
          <div className={`text-[12.5px] mt-1 ${hangDoi!.nhip.song ? "text-emerald-700" : "text-amber-800"}`}>
            {t("Máy làm việc (trên máy Mac):")} {hangDoi!.nhip.song
              ? t("đang chạy, nhịp cuối {p} phút trước").replace("{p}", String(hangDoi!.nhip.phut))
              : hangDoi!.nhip.coNhip ? t("ĐANG TẮT — nhịp cuối {p} phút trước").replace("{p}", String(hangDoi!.nhip.phut)) : t("CHƯA từng báo nhịp")}
          </div>
          {tacNghen && (
            <div className="text-[12px] text-amber-800 mt-1">
              {t("Việc đã duyệt sẽ nằm im tới khi bật máy. Trên máy Mac:")} <code>launchctl list | grep cc-worker</code>
              {" "}{t("(chạy tay:")} <code>node scripts/cc-worker.mjs</code>).
            </div>
          )}
        </div>
      )}

      {badSources.length > 0 && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
          <div className="text-[13px] font-bold text-rose-800 inline-flex items-center gap-1 mb-1.5">
            <AlertTriangle className="w-4 h-4" />{badSources.length} {t("nguồn dữ liệu đang có vấn đề")}
          </div>
          <ul className="space-y-1">
            {badSources.map((s) => (
              <li key={s.key} className="text-[12.5px] text-rose-900">
                <b>{t(s.label)}</b> — {t(s.note)}. <span className="text-rose-700">{t("Cách sửa:")} {s.fix}</span>
                {s.chiThamKhao && <span className="text-rose-400"> {t("(chỉ tham khảo — không kêu, không giao việc)")}</span>}
              </li>
            ))}
          </ul>
          <div className="text-[12px] text-rose-700 mt-2">
            {t("Mỗi nguồn ở đây (trừ mục chỉ-tham-khảo) đã được AI Canh Gác mở sẵn một việc trong")}{" "}
            <a href="/tasks" className="underline font-semibold">/tasks</a> {t("— nguồn sống lại thì việc tự đóng.")}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm divide-y divide-gray-50">
        {board.rows.map((m) => {
          const tone = m.ok === true ? "text-emerald-700 bg-emerald-50 border-emerald-200"
            : m.ok === false ? "text-rose-700 bg-rose-50 border-rose-200"
              : "text-gray-500 bg-gray-50 border-gray-200";
          const Icon = m.ok === true ? CheckCircle2 : m.ok === false ? AlertTriangle : HelpCircle;
          return (
            <div key={m.name} className="p-3.5 flex items-start gap-3 flex-wrap">
              <div className="flex-1 min-w-[260px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13.5px] font-bold text-gray-800">{t(m.name)}</span>
                  <span className={`text-[10.5px] px-1.5 py-0.5 rounded border font-semibold inline-flex items-center gap-1 ${tone}`}>
                    <Icon className="w-3 h-3" />
                    {m.ok === true ? t("đang chạy") : m.ok === false ? t("có lỗi") : t("chưa có dấu vết")}
                  </span>
                  <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-500 border border-gray-200 inline-flex items-center gap-1">
                    {m.where === "server" ? <><Server className="w-3 h-3" />{t("máy chủ")}</> : <><Laptop className="w-3 h-3" />{t("máy văn phòng")}</>}
                  </span>
                </div>
                <div className="text-[12px] text-gray-500 mt-0.5">{t(m.what)} {t("· lịch:")} {t(m.schedule)}</div>
                <div className="text-[12.5px] text-gray-700 mt-1">{t(m.output)}</div>
                {m.ok === false && <div className="text-[12px] text-rose-600 mt-1">{t("Sửa:")} {t(m.fix)}</div>}
              </div>
              <div className="text-right text-[11.5px] text-gray-400 min-w-[120px]">
                {m.lastRun ? (
                  <>
                    <div>{t("chạy lần cuối")}</div>
                    <div className="text-gray-600 font-semibold tabular-nums">{m.lastRun}</div>
                    {m.ageHours !== null && <div>{m.ageHours < 1 ? t("vừa xong") : `${Math.round(m.ageHours)} ${t("giờ trước")}`}</div>}
                  </>
                ) : <div>{t("không ghi mốc chạy")}</div>}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-gray-400">
        {t("Máy chạy trên MÁY CHỦ thì tự chạy kể cả khi máy văn phòng tắt. Máy chạy trên MÁY VĂN PHÒNG cần máy Mac bật đúng giờ\n        (video và ngân hàng phải đọc file trên ổ đĩa). Riêng video: đã hẹn giờ lên Facebook rồi thì Facebook tự đăng, máy tắt cũng không sao.\n        Máy nào &quot;chưa có dấu vết&quot; nghĩa là chưa ghi mốc chạy — không phải đã hỏng, nhưng cũng chưa chứng minh được là chạy.")}
      </p>
    </div>
  );
}
