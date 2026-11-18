import { getT } from "@/lib/i18n-server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase-server";
import { GIA_V3_HET_HIEU_LUC, GIA_V4_HIEU_LUC_TU, GIA_V4_PHIEN_BAN, NHAN_TRANG_THAI, bangGiaV4, choCeoChot } from "@/lib/gia-v4";
import NutIn from "./NutIn";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Bảng giá v4 cho sale/đại lý | ACME Ops Hub") };
}

const vnd = (n: number | null) => (n == null ? "—" : n.toLocaleString("vi-VN") + "đ");
const ngayVN = (iso: string) => iso.split("-").reverse().join("/");

const MAU: Record<string, string> = {
  hieu_luc: "bg-emerald-100 text-emerald-700",
  de_xuat: "bg-amber-100 text-amber-700",
  chua_chot: "bg-red-100 text-red-700",
  ban_het_ton: "bg-gray-100 text-gray-600",
  thay_the_boi_de_xuat: "bg-gray-100 text-gray-500 line-through",
  noi_bo: "bg-gray-100 text-gray-500",
};

export default async function Page() {
  const { t: t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const bang = bangGiaV4();
  const cho = choCeoChot();
  const nhom = Array.from(new Set(bang.map((d) => d.sanPham)));

  return (
    <div className="max-w-5xl mx-auto space-y-4 print:max-w-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("Bảng giá")} {GIA_V4_PHIEN_BAN} {t("cho sale / đại lý")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("Hiệu lực từ")} {ngayVN(GIA_V4_HIEU_LUC_TU)} {t("· v3 hết hiệu lực từ")} {ngayVN(GIA_V3_HET_HIEU_LUC)} {t("· giá đã gồm VAT 8% · khuyến mãi = TẶNG QUÀ, không chiết khấu %.")}
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Link href="/chinh-sach-kenh/bang-gia/csv" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50">
            <Download className="w-4 h-4" /> {t("Tải CSV")}
          </Link>
          <NutIn />
        </div>
      </div>

      {cho.length > 0 && (
        <div className="text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-800">
          <b>{t("Chưa chốt / chờ duyệt:")}</b>
          <ul className="list-disc pl-5 mt-1 space-y-0.5">{cho.map((c, i) => <li key={i}>{c}</li>)}</ul>
          <div className="mt-1">{t("Dòng gắn nhãn “Chưa chốt” hoặc “Đề xuất” KHÔNG dùng để chào giá cho khách hay đại lý.")}</div>
        </div>
      )}

      {nhom.map((ten) => (
        <section key={ten} className="bg-white border border-gray-200 rounded-xl overflow-hidden break-inside-avoid">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 font-semibold text-sm">{ten}</div>
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500">
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-1.5 font-medium">{t("Kênh")}</th>
                <th className="text-left px-2 py-1.5 font-medium">{t("Bậc / quy cách")}</th>
                <th className="text-right px-2 py-1.5 font-medium">CK %</th>
                <th className="text-right px-2 py-1.5 font-medium">{t("Giá")}</th>
                <th className="text-left px-2 py-1.5 font-medium">{t("Trạng thái")}</th>
                <th className="text-left px-4 py-1.5 font-medium">{t("Ghi chú")}</th>
              </tr>
            </thead>
            <tbody>
              {bang.filter((d) => d.sanPham === ten).map((d, i) => (
                <tr key={i} className="border-b border-gray-50 align-top">
                  <td className="px-4 py-1.5 whitespace-nowrap">{d.kenh}</td>
                  <td className="px-2 py-1.5">{d.bac}{d.quyCach && d.kenh === "Bán lẻ" && d.bac === "Niêm yết" ? <span className="text-gray-400"> · {d.quyCach}</span> : null}{d.kenh === "B2B quà tặng" && i === 0 ? <span className="text-gray-400"> · {d.quyCach}</span> : null}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{d.chietKhauPct == null ? "" : d.chietKhauPct + "%"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-medium">{vnd(d.gia)}</td>
                  <td className="px-2 py-1.5"><span className={`text-[11px] px-1.5 py-0.5 rounded ${MAU[d.trangThai] || ""}`}>{NHAN_TRANG_THAI[d.trangThai]}</span></td>
                  <td className="px-4 py-1.5 text-xs text-gray-500">{d.ghiChu}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <p className="text-xs text-gray-400">{t("Bảng này không chứa giá vốn. Nguồn: lib/gia-v4.ts · in ngày")} {ngayVN(new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10))}.</p>
    </div>
  );
}
