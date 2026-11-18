import { getT } from "@/lib/i18n-server";

import type { CockpitData, Light } from "@/lib/cockpit";
import { Wallet, Briefcase, Users, Package, type LucideIcon } from "lucide-react";

const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n));
const tr = (n: number) => (Math.round(n / 1e5) / 10).toLocaleString("vi-VN") + "tr";

const DOT: Record<Light, string> = { green: "bg-emerald-500", yellow: "bg-amber-400", red: "bg-red-500" };
const LIGHT_TITLE: Record<Light, string> = { green: "Ổn", yellow: "Chậm nhịp / cần để ý", red: "Cần xử lý ngay" };

function Dot({ l }: { l: Light }) {
  const { t: t } = getT();
  return <span title={t(LIGHT_TITLE[l])} className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${DOT[l]}`} />;
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full ${color}`} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
    </div>
  );
}

function Card({ href, icon: Icon, title, light, children }: { href: string; icon?: LucideIcon; title: string; light: Light; children: React.ReactNode }) {
  return (
    <a href={href} className="block bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-3.5 hover:border-emerald-300 transition">
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon className="w-4 h-4 text-gray-500 shrink-0" />}
        <span className="text-[13px] font-semibold text-gray-600">{title}</span>
        <span className="ml-auto"><Dot l={light} /></span>
      </div>
      {children}
    </a>
  );
}

export default function Cockpit({ c }: { c: CockpitData }) {
  const { t: t } = getT();
  const { fin, biz, hr, ops } = c;
  return (
    <div className="max-w-6xl mx-auto space-y-3">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-bold text-gray-900">{t("Cockpit điều hành —")} {c.today}</h2>
        <span className="text-[11px] text-gray-400">{t("Đèn: ổn · chậm nhịp · cần xử lý — bấm khối để xem chi tiết")}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card href="/tai-chinh" icon={Wallet} title={t("Tài chính")} light={fin.light}>
          <div className="text-xl font-bold text-gray-900">
            <span className="sensitive">{tr(fin.revMonthGross)}</span>
            <span className="text-[12px] font-normal text-gray-400"> / <span className="sensitive">{tr(fin.target)}</span> {t("tháng này")}</span>
          </div>
          <div className="my-2"><Bar pct={fin.pct} color={fin.light === "green" ? "bg-emerald-500" : fin.light === "yellow" ? "bg-amber-400" : "bg-red-500"} /></div>
          <div className="text-[12px] text-gray-600">{t("Đạt")} <b>{fin.pct}%</b> {t("· theo lịch phải")} {fin.expectedPct}%{fin.pct < fin.expectedPct - 5 ? t(" → chậm nhịp") : t(" → đúng nhịp")}</div>
          <div className="text-[11px] text-gray-400 mt-1">{fin.margin != null ? `Lãi gộp tháng ~${fin.margin}%` : t("Lãi gộp: chưa có dữ liệu tháng này")}</div>
        </Card>

        <Card href="/hoa-hong-sale" icon={Briefcase} title="Kinh doanh" light={biz.light}>
          <div className="text-xl font-bold text-gray-900">
            {biz.ordersYest} {t("đơn")}
            <span className="text-[12px] font-normal text-gray-400"> · <span className="sensitive">{fmt(biz.revYestGross)}đ</span> {t("hôm qua (")}{c.yest.slice(8)}/{c.yest.slice(5, 7)})</span>
          </div>
          <div className="mt-2 space-y-1">
            {biz.sales.map(s => (
              <div key={s.name} className="flex items-center gap-2 text-[12px] text-gray-600">
                <span className="w-10 shrink-0 truncate">{t(s.short)}</span>
                <div className="flex-1"><Bar pct={s.pct} color={s.pct >= 50 ? "bg-emerald-500" : s.pct >= 25 ? "bg-amber-400" : "bg-red-400"} /></div>
                <span className="w-16 text-right shrink-0"><span className="sensitive">{s.pct}% KPI</span></span>
              </div>
            ))}
            {!biz.sales.length && <div className="text-[12px] text-gray-400">{t("Chưa có dữ liệu sale")}</div>}
          </div>
          <div className="text-[11px] text-gray-400 mt-1.5">{biz.needCare} {t("khách tới chu kỳ tái mua (45–90 ngày)")}</div>
        </Card>

        <Card href="/admin/cham-cong" icon={Users} title={t("Nhân sự")} light={hr.light}>
          <div className="text-xl font-bold text-gray-900">
            {hr.attToday}/{hr.activeStaff}
            <span className="text-[12px] font-normal text-gray-400"> {t("đã chấm công hôm nay")}</span>
          </div>
          <div className="text-[12px] text-gray-600 mt-2 leading-relaxed">
            {t("Checklist sale hôm qua:")} <b>{hr.checklistOk}/{hr.checklistTotal}</b> {t("đủ tag")}
            <br />{hr.leavesPending > 0 ? <>{hr.leavesPending} {t("đơn xin nghỉ")} <b>{t("chờ duyệt")}</b></> : t("Không có đơn nghỉ chờ duyệt")}
          </div>
        </Card>

        <Card href="/kho" icon={Package} title={t("Vận hành")} light={ops.light}>
          <div className="text-xl font-bold text-gray-900">
            {ops.stockOut} {t("mã")}
            <span className="text-[12px] font-normal text-gray-400"> {t("hết hàng ·")} {ops.stockLow} {t("sắp hết")}</span>
          </div>
          <div className="text-[12px] text-gray-600 mt-2 leading-relaxed">
            MISA: {ops.misaOk ? <>{t("phiên OK")}{ops.misaLatest ? ` · dữ liệu đến ${ops.misaLatest.slice(8)}/${ops.misaLatest.slice(5, 7)}` : ""}</> : <b className="text-red-600">{t("MẤT PHIÊN — cần đăng nhập lại")}</b>}
            <br />{t("J&T hoàn tháng này:")} {ops.jtReturned} {t("đơn")}{ops.ckHold > 0 ? <> · <b>{ops.ckHold} {t("đơn CK giữ hàng")}</b></> : ""}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-3.5">
          <div className="text-[13px] font-semibold text-amber-800 mb-1">{t("Cảnh báo sớm (")}{c.alerts.length})</div>
          {c.alerts.length ? (
            <ul className="text-[12px] text-amber-800 space-y-0.5 list-disc ml-4">
              {c.alerts.slice(0, 6).map((a, i) => <li key={i}>{a}</li>)}
              {c.alerts.length > 6 && <li className="text-amber-600">{t("… và")} {c.alerts.length - 6} {t("cảnh báo khác")}</li>}
            </ul>
          ) : <div className="text-[12px] text-amber-700">{t("Không có cảnh báo — hệ thống sạch")} </div>}
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5">
          <div className="text-[13px] font-semibold text-blue-800 mb-1">{t("1 việc ưu tiên hôm nay")}</div>
          <div className="text-[12px] text-blue-800 leading-relaxed">{c.priority}</div>
        </div>
      </div>
    </div>
  );
}
