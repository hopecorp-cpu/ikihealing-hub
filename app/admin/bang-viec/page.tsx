import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/supabase-server";
import { getConfigValue } from "@/lib/app-config";
import { KHOA_CONFIG, NHAN_TRANG_THAI, TRANG_THAI, docLuu, gioVN, sapXep, type TrangThai } from "@/lib/bang-viec";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bảng việc iMac", robots: { index: false, follow: false } };

const MAU: Record<TrangThai, string> = {
  "cho-anh": "bg-amber-100 text-amber-800 border-amber-200",
  ket: "bg-red-100 text-red-700 border-red-200",
  "dang-chay": "bg-blue-100 text-blue-700 border-blue-200",
  xong: "bg-emerald-100 text-emerald-700 border-emerald-200",
};
const THU_TU_LOC: TrangThai[] = ["cho-anh", "ket", "dang-chay", "xong"];

export default async function BangViecPage({ searchParams }: { searchParams: { loc?: string } }) {
  const user: any = await getCurrentUser();
  if (!user) redirect("/login");
  if (!["admin", "ceo", "bod"].includes(user.role)) redirect("/");

  const luu = docLuu(await getConfigValue(KHOA_CONFIG));
  const tatCa = sapXep(luu?.viec || []);
  const loc = TRANG_THAI.includes(searchParams?.loc as TrangThai) ? (searchParams.loc as TrangThai) : null;
  const ds = loc ? tatCa.filter((v) => v.trang_thai === loc) : tatCa;
  const dem = Object.fromEntries(TRANG_THAI.map((t) => [t, tatCa.filter((v) => v.trang_thai === t).length])) as Record<TrangThai, number>;
  const tuoiPhut = luu?.cap_nhat ? (Date.now() - Date.parse(luu.cap_nhat)) / 60000 : Infinity;

  const nut = (href: string, nhan: string, bat: boolean) => (
    <Link key={href} href={href}
      className={`px-3 py-1.5 rounded-md border text-sm ${bat ? "bg-brand-600 text-white border-brand-600" : "bg-white text-gray-700 border-gray-200"}`}>
      {nhan}
    </Link>
  );

  return (
    <div className="p-4 sm:p-5 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h1 className="text-xl sm:text-2xl font-bold">Bảng việc iMac</h1>
        <Link href={loc ? `/admin/bang-viec?loc=${loc}` : "/admin/bang-viec"} className="px-3 py-1.5 rounded-md border border-gray-200 text-sm bg-white">Tải lại</Link>
      </div>
      <p className="text-sm text-gray-500 mb-3">
        Cập nhật lúc: {luu?.cap_nhat ? gioVN(luu.cap_nhat) : "chưa có dữ liệu"}
      </p>
      {tuoiPhut > 10 && (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 text-amber-800 text-sm px-3 py-2">
          {luu?.cap_nhat
            ? `Đã ${Math.round(tuoiPhut)} phút chưa nhận dữ liệu từ iMac — máy có thể đang tắt, ngủ hoặc mất mạng.`
            : "Chưa nhận dữ liệu nào từ iMac."}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {nut("/admin/bang-viec", `Tất cả (${tatCa.length})`, !loc)}
        {THU_TU_LOC.map((t) => nut(`/admin/bang-viec?loc=${t}`, `${NHAN_TRANG_THAI[t]} (${dem[t]})`, loc === t))}
      </div>

      {ds.length === 0 ? (
        <p className="text-sm text-gray-500">Không có việc nào.</p>
      ) : (
        <>
          <ul className="sm:hidden space-y-2">
            {ds.map((v) => (
              <li key={v.ma} className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm break-all">{v.ma}</span>
                  <span className={`shrink-0 px-2 py-0.5 rounded-md border text-xs font-medium ${MAU[v.trang_thai]}`}>{NHAN_TRANG_THAI[v.trang_thai]}</span>
                </div>
                {v.mo_ta && <p className="text-sm text-gray-700 mt-1 break-words">{v.mo_ta}</p>}
                <div className="text-xs text-gray-500 mt-1">{gioVN(v.luc)}</div>
                {v.link && <div className="text-xs mt-1 break-all"><KetQua link={v.link} laUrl={v.la_url} /></div>}
              </li>
            ))}
          </ul>
          <div className="hidden sm:block overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-left">
                <tr><th className="px-3 py-2">Mã</th><th className="px-3 py-2">Mô tả</th><th className="px-3 py-2 whitespace-nowrap">Giờ</th><th className="px-3 py-2">Trạng thái</th><th className="px-3 py-2">Kết quả</th></tr>
              </thead>
              <tbody>
                {ds.map((v) => (
                  <tr key={v.ma} className="border-t border-gray-100 align-top">
                    <td className="px-3 py-2 font-medium break-all">{v.ma}</td>
                    <td className="px-3 py-2 text-gray-700 break-words">{v.mo_ta}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-500">{gioVN(v.luc)}</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-md border text-xs font-medium whitespace-nowrap ${MAU[v.trang_thai]}`}>{NHAN_TRANG_THAI[v.trang_thai]}</span></td>
                    <td className="px-3 py-2 break-all max-w-xs">{v.link && <KetQua link={v.link} laUrl={v.la_url} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function KetQua({ link, laUrl }: { link: string; laUrl: boolean }) {
  if (laUrl) return <a href={link} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline">{link.replace(/^https:\/\//, "")}</a>;
  return <span className="text-gray-500">{link}</span>;
}
