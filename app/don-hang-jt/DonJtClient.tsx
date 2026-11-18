"use client";
import { useLang } from "@/components/lang-provider";
import { useMemo, useState } from "react";
import type { DonJt } from "@/lib/don-hang-jt";
import { NHOM_TEN } from "@/lib/don-hang-jt";

const badge: Record<string, string> = {
  delivered: "bg-emerald-100 text-emerald-700", returned: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-600", transit: "bg-amber-100 text-amber-700", other: "bg-purple-100 text-purple-700",
};
const vnd = (n: number) => (n || 0) > 0 ? n.toLocaleString("vi-VN") + "đ" : "—";
const dmy = (s: string | null) => { if (!s) return "—"; const x = String(s); return `${x.slice(8, 10)}/${x.slice(5, 7)}`; };
const gio = (s: string | null) => { if (!s) return ""; const x = String(s); return `${x.slice(8, 10)}/${x.slice(5, 7)} ${x.slice(11, 16)}`; };

export default function DonJtClient({ rows, ngay, quanLy, tuoiKho, tuoiTheoDoi, soiTheoDoi }: {
  rows: DonJt[]; ngay: number; quanLy: boolean; tuoiKho: string | null; tuoiTheoDoi: string | null; soiTheoDoi: number;
}) {
  const { t: t } = useLang();
  const [tab, setTab] = useState<"can" | "" | string>("can");
  const [q, setQ] = useState("");
  const [mo, setMo] = useState<string | null>(null);

  const dem = useMemo(() => {
    const d: Record<string, number> = { can: 0 };
    for (const r of rows) { if (r.canXuLy) d.can++; d[r.nhom] = (d[r.nhom] || 0) + 1; }
    return d;
  }, [rows]);

  const list = useMemo(() => {
    const k = q.trim().toLowerCase();
    return rows.filter(r =>
      (tab === "" || (tab === "can" ? r.canXuLy : r.nhom === tab)) &&
      (!k || [r.khach, r.sdtKhach, r.waybill, r.hang, r.sale, r.sdtShipper].some(v => String(v || "").toLowerCase().includes(k)))
    );
  }, [rows, tab, q]);

  const khoTre = tuoiKho ? Math.floor((Date.now() - new Date(tuoiKho).getTime()) / 36e5) : null;

  const TABS: Array<[string, string]> = [
    ["can", "Cần xử lý"], ["transit", NHOM_TEN.transit], ["returned", NHOM_TEN.returned],
    ["other", NHOM_TEN.other], ["cancelled", NHOM_TEN.cancelled], ["delivered", NHOM_TEN.delivered], ["", "Tất cả"],
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{t("Tình trạng đơn J&amp;T")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {quanLy ? t("Toàn bộ đơn") : t("Đơn của bạn")} trong {ngay} {t("ngày ·")} {rows.length} {t("vận đơn ·")}{" "}
            <span className={dem.can ? "text-red-600 font-semibold" : ""}>{dem.can} {t("cần xử lý")}</span>
          </p>
        </div>
        <form className="flex gap-2 items-center">
          <select name="ngay" defaultValue={String(ngay)} className="p-2 border border-gray-200 rounded-lg text-sm">
            {[7, 15, 30, 45, 60, 90].map(n => <option key={n} value={n}>{n} {t("ngày")}</option>)}
          </select>
          <button className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm">Xem</button>
        </form>
      </div>

      {(khoTre === null || khoTre > 24) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {khoTre === null
            ? t("Chưa có dữ liệu J&T nào trong cửa sổ này.")
            : `Số J&T cập nhật lần cuối cách đây ${khoTre} giờ — máy cào có thể đang mất phiên. Trạng thái dưới đây là số CŨ.`}
        </div>
      )}
      {!soiTheoDoi && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-600">
          {t("Chưa kéo được hành trình/shipper (cột &quot;sự kiện cuối&quot; và SĐT shipper sẽ trống). Chạy lại máy cào J&amp;T trên máy CEO.")}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {TABS.map(([k, l]) => (
          <button key={k || "all"} onClick={() => setTab(k)}
            className={`px-3 py-1.5 rounded-md text-sm border ${tab === k ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-700"}`}>
            {l} {k === "" ? rows.length : (dem[k] || 0)}
          </button>
        ))}
      </div>

      <input value={q} onChange={e => setQ(e.target.value)} placeholder={t("Tìm theo tên khách, SĐT, mã vận đơn, sản phẩm…")}
        className="w-full p-2.5 border border-gray-200 rounded-lg text-sm" />

      <div className="space-y-2">
        {list.length === 0 && <p className="text-sm text-gray-500 py-6 text-center">{t("Không có đơn nào trong mục này.")}</p>}
        {list.map(r => (
          <div key={r.waybill} className={`bg-white border rounded-2xl p-4 ${r.canXuLy ? "border-red-200" : "border-gray-100"}`}>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${badge[t(r.nhom)] || "bg-gray-100 text-gray-600"}`}>{r.trangThai}</span>
              <span className="font-semibold">{r.khach || t("(chưa rõ tên)")}</span>
              {r.sdtKhach && <a href={`tel:${r.sdtKhach}`} className="text-sm text-blue-600">{r.sdtKhach}</a>}
              <span className="text-xs text-gray-400">{t("· tạo")} {dmy(r.ngayTao)} ({r.ngayDi} {t("ngày)")}</span>
              {quanLy && <span className="text-xs text-gray-500">· {r.sale || t("chưa rõ sale")}</span>}
            </div>

            {r.lyDo && <p className="text-sm text-red-600 mb-1">{r.lyDo}</p>}

            <div className="text-sm text-gray-600 space-y-0.5">
              <div>{r.hang || "—"} · COD {vnd(r.cod)} {t("· vận đơn")} <span className="tabular-nums text-xs">{r.waybill}</span></div>
              {r.diaChi && <div className="text-xs text-gray-400">{r.diaChi}</div>}
              <div>
                Shipper: {r.shipper || t("chưa rõ")}
                {r.sdtShipper && <> · <a href={`tel:${r.sdtShipper}`} className="text-blue-600">{r.sdtShipper}</a></>}
              </div>
              {r.suKienCuoi && <div className="text-xs text-gray-500">{t("Mới nhất:")} {r.suKienCuoi} {r.suKienLuc ? `(${gio(r.suKienLuc)})` : ""}</div>}
            </div>

            {r.suKien.length > 0 && (
              <>
                <button onClick={() => setMo(mo === r.waybill ? null : r.waybill)} className="mt-2 text-xs text-gray-500 underline">
                  {mo === r.waybill ? t("Ẩn hành trình") : `Xem hành trình (${r.suKien.length} mốc)`}
                </button>
                {mo === r.waybill && (
                  <ul className="mt-2 space-y-1 border-l border-gray-200 pl-3">
                    {r.suKien.map((e, i) => (
                      <li key={i} className="text-xs text-gray-600">
                        <span className="text-gray-400">{gio(e.at)}</span> · {e.type || ""}{t(e.note) ? ` — ${t(e.note)}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400">
        {t("Nguồn: cổng J&amp;T (vận đơn + hành trình) ghép với sổ đơn nhóm Telegram theo SĐT người nhận. Đơn ghi sổ bằng\n        SĐT khác SĐT nhận hàng sẽ không khớp được sale — đó là lệch ghi sổ, không phải mất đơn.")}
        {tuoiTheoDoi && ` Hành trình cập nhật ${new Date(tuoiTheoDoi).toLocaleString("vi-VN")}.`}
      </p>
    </div>
  );
}
