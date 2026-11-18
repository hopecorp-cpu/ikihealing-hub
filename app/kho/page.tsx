import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove } from "@/lib/auth";
import { vnDateStr } from "@/lib/payroll";
import KhoClient from "./KhoClient";
import StockClient from "./StockClient";
import stockData from "@/data/warehouse-stock.json";
import { Stat } from "@/components/stat";
import { getT } from "@/lib/i18n-server";
import { layKhoVanDong } from "@/lib/kho-van-dong";
import { layTonNoiBo } from "@/lib/kho-noi-bo";
import KhoNhapForm from "./KhoNhapForm";
import KhoTonExcel from "./KhoTonExcel";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Quản lý Kho | IKIHEALING Hub") };
}

export default async function KhoPage({ searchParams }: { searchParams: { m?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isManagerOrAbove(user.role) && !/kho|warehouse|hỗ trợ/i.test(user.position || "")) redirect("/?denied=kho");

  const sb = getServiceClient();
  const month = searchParams.m || vnDateStr().slice(0, 7);
  const dim = new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate();
  const from = `${month}-01`, to = `${month}-${String(dim).padStart(2, "0")}`;

  const vd = await layKhoVanDong(sb, from, to);
  const products = vd.products;
  const totShipped = vd.tong.shipped;
  const totDelivered = vd.tong.delivered;
  const totReturned = vd.tong.returned;
  const totTransit = vd.tong.transit;
  const returnCount = vd.soVanDonHoan;
  const problemCount = vd.soVanDonLoi;

  const { data: sumRow } = await sb.from("jt_summary").select("updated_at").eq("id", 1).maybeSingle();
  const lastSync = sumRow?.updated_at ? new Date(sumRow.updated_at).toLocaleString("vi-VN") : "—";

  const tonNb = await layTonNoiBo(sb);
  let stock: { sku: string; name: string; unit: string; opening: number; inQty: number; outQty: number; closing: number }[];
  let stockPeriod: string;
  if (tonNb.moc) {
    stock = tonNb.items.map(r => ({ sku: "", name: r.name, unit: "", opening: r.moc, inQty: r.nhap + r.hoanVe, outQty: r.guiDi, closing: r.ton }));
    stockPeriod = `Sổ nội bộ tự trừ từ ${tonNb.moc.tuNgay} · mốc: ${tonNb.moc.nguon} · ${tonNb.soDotNhap} đợt nhập đã ghi`;
  } else {
    stock = (stockData as any).items || [];
    stockPeriod = "CHƯA CÓ MỐC TỒN — đang hiện file tĩnh cũ; kiểm kho rồi khai mốc ở khung dưới";
  }
  const skuCount = stock.length;
  const inStock = stock.filter(s => s.closing > 0).length;
  const lowCount = stock.filter(s => s.closing > 0 && s.closing <= 10).length;
  const outCount = stock.filter(s => s.closing <= 0).length;
  const totalClosing = stock.reduce((s, x) => s + x.closing, 0);

  const since14 = new Date(Date.now() + 7 * 3600e3 - 14 * 864e5).toISOString().slice(0, 10);
  const { data: drs } = await sb.from("daily_reports").select("report_date, user_id, fields").gte("report_date", since14).order("report_date", { ascending: false });
  const uids = [...new Set((drs || []).map(r => r.user_id))];
  const { data: us2 } = uids.length ? await sb.from("users").select("id, full_name").in("id", uids) : { data: [] as any[] };
  const uname: Record<string, string> = Object.fromEntries((us2 || []).map((u: any) => [u.id, u.full_name]));
  const ckOrders: any[] = [];
  for (const r of drs || []) { const arr = (r.fields as any)?.ck_deposits; if (Array.isArray(arr)) for (const d of arr) if (d && (d.kh || d.tong || d.coc)) ckOrders.push({ ...d, date: r.report_date, sale: uname[r.user_id] || "" }); }
  const holdOrders = ckOrders.filter(d => d.st === "hold");
  const otherCk = ckOrders.filter(d => d.st !== "hold");

  const { t } = getT();

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {(holdOrders.length > 0 || otherCk.length > 0) && (
        <div className="space-y-2">
          {holdOrders.length > 0 && (
            <div className="rounded-xl border-2 border-red-300 bg-red-50 overflow-hidden">
              <div className="px-4 py-2 bg-red-600 text-white font-bold text-sm">{t("GIỮ HÀNG — khách CK đủ nhưng CHƯA giao")} ({holdOrders.length})</div>
              <div className="divide-y divide-red-100">
                {holdOrders.map((d, i) => (
                  <div key={i} className="px-4 py-2 text-sm flex flex-wrap gap-x-3 gap-y-0.5">
                    <span className="font-semibold text-red-800">{d.kh || "?"}</span>
                    <span className="text-gray-600">{t("đã CK")} {(d.coc || 0).toLocaleString("vi")}{t("đ /")} {(d.tong || 0).toLocaleString("vi")}đ</span>
                    <span className="text-gray-400">· {d.sale} · {d.date}</span>
                    {t(d.note) && <span className="w-full text-[12px] text-red-700">{t(d.note)}</span>}
                  </div>
                ))}
              </div>
              <div className="px-4 py-1.5 text-[11px] text-red-600">{t("KHÔNG gửi hàng cho tới khi sale báo giao.")}</div>
            </div>
          )}
          {otherCk.length > 0 && (
            <details className="rounded-xl border border-blue-200 bg-blue-50 overflow-hidden">
              <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-blue-800">{t("Đơn CK khác (cọc / giao luôn)")} ({otherCk.length})</summary>
              <div className="divide-y divide-blue-100">
                {otherCk.map((d, i) => (
                  <div key={i} className="px-4 py-1.5 text-[13px] flex flex-wrap gap-x-3">
                    <span className={d.st === "paid" ? "text-emerald-700 font-medium" : "text-amber-700 font-medium"}>{d.st === "paid" ? t("giao luôn") : t("cọc-COD")}</span>
                    <span className="font-semibold">{d.kh || "?"}</span>
                    <span className="text-gray-600">{(d.coc || 0).toLocaleString("vi")}{t("đ /")} {(d.tong || 0).toLocaleString("vi")}đ</span>
                    <span className="text-gray-400">· {d.sale} · {d.date}</span>
                    {t(d.note) && <span className="w-full text-[12px] text-gray-600">{t(d.note)}</span>}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{t("Quản lý Kho")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("Tồn kho (N-X-T) + hàng gửi đi J&T. J&T tự đồng bộ:")} {lastSync}</p>
        </div>
      </div>

      <div className="space-y-3">
        <KhoTonExcel />
        <div className="text-sm font-semibold text-gray-700">{t("Tồn kho hiện tại")} <span className="font-normal text-gray-400">{t("— báo cáo Nhập-Xuất-Tồn")} ({stockPeriod})</span></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label={t("Mã hàng có tồn")} value={`${inStock}/${skuCount}`} color="#0EA5E9" />
          <Stat label={t("Sắp hết (≤10)")} value={lowCount.toLocaleString("vi")} color="#F59E0B" />
          <Stat label={t("Hết hàng")} value={outCount.toLocaleString("vi")} color="#EF4444" />
          <Stat label={t("Tổng tồn cuối kỳ")} value={totalClosing.toLocaleString("vi")} color="#10B981" />
        </div>
        {lowCount + outCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
            <b>{outCount} {t("mã hết hàng")}</b> + <b>{lowCount} {t("mã sắp hết (≤10)")}</b> {t("— cần nhập bổ sung. Lọc \"Sắp hết / Hết hàng\" trong bảng dưới.")}
          </div>
        )}
        <StockClient items={stock} />
        <KhoNhapForm laQuanLy={isManagerOrAbove(user.role)} />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 pt-2">
        <div className="text-sm font-semibold text-gray-700">{t("Hàng gửi đi qua J&T")} <span className="font-normal text-gray-400">{t("— tháng")} {month}</span></div>
        <form className="flex gap-2 items-center">
          <input type="month" name="m" defaultValue={month} className="p-2 border border-gray-200 rounded-lg text-sm" />
          <button className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm">{t("Xem")}</button>
        </form>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label={t("Tổng SP gửi đi")} value={totShipped.toLocaleString("vi")} color="#0EA5E9" />
        <Stat label={t("Đã giao")} value={totDelivered.toLocaleString("vi")} color="#10B981" />
        <Stat label={t("Hoàn về (nhập lại)")} value={totReturned.toLocaleString("vi")} color="#EF4444" hint={returnCount + t(" vận đơn hoàn")} />
        <Stat label={t("Đang trên đường")} value={totTransit.toLocaleString("vi")} color="#F59E0B" />
        <Stat label={t("Đơn vấn đề")} value={problemCount.toLocaleString("vi")} color="#A855F7" />
      </div>

      {(returnCount > 0 || problemCount > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <b>{t("Cần xử lý:")}</b> {returnCount > 0 && <>{t("có")} <b>{returnCount} {t("đơn hoàn")}</b> ({totReturned} {t("SP) cần nhập lại kho.")} </>}
          {problemCount > 0 && <>{t("có")} <b>{problemCount} {t("đơn vấn đề")}</b> {t("cần kiểm tra với J&T.")} </>}
          {t("Xem chi tiết ở")} <a href={`/doi-soat-jt?m=${month}`} className="underline font-medium">{t("Đối soát J&T")}</a>.
        </div>
      )}

      <KhoClient products={products} />

      <p className="text-xs text-gray-400">
        {t("Tồn kho lấy từ báo cáo Nhập-Xuất-Tồn (cập nhật bằng cách tải file Excel N-X-T mới rồi chạy")} <code>parse-nxt.mjs</code> {t("+ deploy).")}
        {" "}{t("Snapshot Excel anh 10/10 (nguồn excel-anh-1010, as_of 2026-09-26) nằm ở khung trên, chưa đè mốc sổ tự trừ.")}
        {t("Hàng gửi đi lấy từ vận đơn J&T (tự đồng bộ hằng ngày). Đơn hoàn = hàng quay lại cần nhập kho.")}
      </p>
    </div>
  );
}

