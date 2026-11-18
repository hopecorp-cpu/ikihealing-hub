import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { fmtVND } from "@/lib/payroll";
import { computeAssets } from "@/lib/asset-scoreboard";
import { Stat } from "@/components/stat";
import { getT } from "@/lib/i18n-server";
import { Wallet, Boxes, Landmark, Users, Repeat, UserPlus, Activity, Database, UserMinus, Store, TrendingUp, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Bảng Tài Sản | ACME Ops Hub") };
}

export default async function TaiSanPage({ searchParams }: { searchParams: { m?: string } }) {
  const { t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(user.role === "admin" || user.role === "ceo" || isManagerOrAbove(user.role))) redirect("/");

  const month = searchParams.m || new Date().toISOString().slice(0, 7);
  const a = await computeAssets(month);
  const tg = a.tangible, c = a.customers;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Landmark className="w-6 h-6 text-brand-600" /> {t("Bảng Tài Sản")} — {month}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("Doanh thu là dòng tiền đi qua. TÀI SẢN mới là thứ còn lại khi thị trường đổi. Hỏi mỗi tháng: mình SỞ HỮU thêm gì?")}</p>
        </div>
        <form className="flex gap-2 items-center">
          <input type="month" name="m" defaultValue={month} className="p-2 border border-gray-200 rounded-lg text-sm" />
          <button className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm">{t("Xem")}</button>
        </form>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-600" /> {t("Tài sản hữu hình — tiền thật của doanh nghiệp")}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label={t("TIỀN MẶT (ngân hàng)")} value={fmtVND(tg.cash)} color="#10B981" icon={Wallet} sensitive
            hint={tg.cashSource === "bank"
              ? `${t("sổ phụ thật")} · MB ${fmtVND(tg.bank.mb || 0)} + TCB ${fmtVND(tg.bank.tcb || 0)}${tg.bank.at ? ` · ${t("tới")} ${tg.bank.at.slice(8, 10)}/${tg.bank.at.slice(5, 7)}` : ""}`
              : tg.cash === 0 ? t("chưa có sổ phụ — vào Sức khoẻ Startup nhập tay") : t("số dư nhập tay")} />
          <Stat label={t("TIỀN HÀNG TỒN (giá vốn)")} value={fmtVND(tg.inventoryValue)} color="#F59E0B" icon={Boxes} sensitive
            hint={`${tg.unitsInStock.toLocaleString("vi-VN")} ${t("đơn vị")} · ${tg.inventorySource === "misa" ? t("giá trị THẬT từ MISA") : t("ước theo giá vốn")}${tg.skuNoCost ? ` · ${tg.skuNoCost} SKU thiếu vốn` : ""}`} />
          <Stat label={t("VỐN LƯU ĐỘNG")} value={fmtVND(tg.workingCapital)} color="#1a73e8" icon={Landmark} sensitive
            hint={t("tiền mặt + tiền hàng")} />
          <Stat label={t("TỒN CHIẾM / VỐN")} value={`${tg.inventorySharePct}%`} color={tg.inventorySharePct >= 60 ? "#EF4444" : "#8B5CF6"} icon={TrendingUp}
            hint={tg.inventorySharePct >= 60 ? t("vốn kẹt nhiều ở hàng") : t("tỉ trọng hàng tồn")} />
        </div>
        {tg.inventoryValue > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{t("Đây là VỐN THẬT đọng trong kho — trước đây không tính vào 'tiền doanh nghiệp'. Hàng tồn nhiều = tiền chết, cần đẩy bán/nhập vừa đủ.")}</span>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2"><Database className="w-4 h-4 text-blue-600" /> {t("Tài sản dữ liệu khách — thứ còn lại khi nền tảng đổi")}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Stat label={t("KHÁCH TRUNG THÀNH")} value={String(c.loyal)} color="#10B981" icon={Users} hint={`${c.repeatRate}% ${t("mua lại")} / ${c.totalCustomers}`} />
          <Stat label={t("TỈ LỆ MUA LẠI")} value={`${c.repeatRate}%`} color={c.repeatRate >= 30 ? "#10B981" : "#F59E0B"} icon={Repeat} hint={t("mua ≥2 đơn")} />
          <Stat label={t("KHÁCH MỚI THÁNG")} value={String(c.newThisMonth)} color="#1a73e8" icon={UserPlus} delta={c.newDelta} hint={t("so tháng trước")} />
          <Stat label={t("KHÁCH MUA THÁNG")} value={String(c.activeThisMonth)} color="#06B6D4" icon={Activity} delta={c.activeDelta} hint={t("so tháng trước")} />
          <Stat label={t("ĐỘ ĐẦY DỮ LIỆU")} value={`${c.dataCompleteness}%`} color={c.dataCompleteness >= 80 ? "#10B981" : "#EF4444"} icon={Database} delta={c.dataCompletenessDelta} deltaGoodWhenUp hint={t("đơn có SĐT")} />
          <Stat label={t("KÊNH PHÂN PHỐI")} value={c.kenhDoDuoc ? String(c.channels) : "—"} color="#8B5CF6" icon={Store}
            hint={c.kenhDoDuoc ? t("kênh có đơn/tháng") : t("sổ đơn Telegram không ghi kênh bán")} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label={t("KHÁCH SẮP RỜI BỎ")} value={String(c.churnRisk)} color="#EF4444" icon={UserMinus} hint={`${t("im lặng")} >${a.churnDays} ${t("ngày")}`} />
          <Stat label={t("VIP CŨ ĐÃ BỎ ĐI")} value={String(c.churnValuable)} color="#EF4444" icon={UserMinus} hint={t("mua ≥2 lần mà im — đau nhất")} />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
          <div className="p-3 border-b border-gray-100 font-semibold text-sm flex items-center gap-2 text-red-700"><UserMinus className="w-4 h-4" /> {t("Khách VIP cũ cần CỨU ngay (mua nhiều lần rồi im)")}</div>
          <Table rows={a.churnTop} lastLabel={t("đơn cuối")} />
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
          <div className="p-3 border-b border-gray-100 font-semibold text-sm flex items-center gap-2 text-emerald-700"><Users className="w-4 h-4" /> {t("Khách VIP trung thành (chăm kỹ, xin giới thiệu)")}</div>
          <Table rows={a.loyalTop} />
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 space-y-1">
        <div className="font-semibold">{t("Còn thiếu để đo tài sản ĐẦY ĐỦ (đang bổ sung):")}</div>
        <div>• {t("Nhập TIỀN MẶT ở trang Sức khoẻ Startup để thấy đủ vốn (giờ đang thiếu → vốn hiện 100% là hàng tồn).")}</div>
        <div>• {t("Chưa gộp được khách Zalo/Facebook vào cùng 1 hồ sơ (cần capture lead thật — ZaloCRM/Pancake).")}</div>
        <div>• {t("Chưa nhận diện được 'người giới thiệu' (cần gắn mã giới thiệu/affiliate cho khách).")}</div>
      </div>
    </div>
  );
}

function Table({ rows, lastLabel }: { rows: { name: string; phone: string; orders: number; rev: number; last?: string }[]; lastLabel?: string }) {
  const { t: t } = getT();
  if (!rows.length) return <div className="p-6 text-center text-gray-400 text-sm">—</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
          <tr>
            <th className="text-left p-2.5">{t("Khách")}</th>
            <th className="text-right p-2.5">{t("Đơn")}</th>
            <th className="text-right p-2.5">Doanh thu</th>
            {lastLabel && <th className="text-right p-2.5">{lastLabel}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.phone} className="border-t border-gray-100 hover:bg-gray-50">
              <td className="p-2.5"><div className="font-medium text-gray-800 truncate max-w-[180px]">{r.name}</div><div className="text-[11px] text-gray-400">{r.phone}</div></td>
              <td className="p-2.5 text-right">{r.orders}</td>
              <td className="p-2.5 text-right font-semibold sensitive">{fmtVND(r.rev)}</td>
              {lastLabel && <td className="p-2.5 text-right text-[11px] text-gray-500">{r.last ? `${r.last.slice(8, 10)}/${r.last.slice(5, 7)}` : "—"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
