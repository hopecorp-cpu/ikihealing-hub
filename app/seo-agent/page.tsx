import { getT } from "@/lib/i18n-server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove, isMktPosition } from "@/lib/auth";
import { getConfigValue } from "@/lib/app-config";
import { docCaiDat, KEY_NHAT_KY, KEY_BAI_HOC, type NhatKy, KEY_THU_HANG, KEY_TU_KHOA, KEY_DOI_THU, KEY_DE_XUAT, KEY_HANG_VIET, KEY_MAY_LAST, KEY_BAO_LAST, type ThuHang, type DeXuat, type DongHang } from "@/lib/seo-agent";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Agent SEO | IKIHEALING Hub") };
}

const NHOM: [string, string][] = [["sieuRong", "Siêu rộng"], ["dai", "Dài"], ["nganh", "Ngành"], ["sanPham", "Sản phẩm"], ["ngan", "Ngắn"], ["diaLy", "Địa lý"], ["trend", "Xu hướng 24-72h"]];
const LOAI: Record<string, [string, string]> = { viet: ["Viết mới", "bg-emerald-50 text-emerald-700"], sua: ["Sửa bài cũ", "bg-amber-50 text-amber-800"], keo: ["Kéo traffic", "bg-sky-50 text-sky-700"] };

async function doc<T>(key: string): Promise<T | null> {
  try { const v = await getConfigValue(key); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
}
const tuoi = (at?: string) => (at ? `${Math.round((Date.now() - Date.parse(at)) / 3600_000)} giờ trước` : "chưa chạy");

function BangHang({ ten, dong, coTruoc }: { ten: string; dong: DongHang[]; coTruoc?: boolean }) {
  if (!dong?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
      <div className="px-3 py-2 text-[13px] font-semibold text-gray-700 border-b border-gray-100">{ten}</div>
      <table className="w-full text-[13px]">
        <tbody>
          {dong.map((d) => (
            <tr key={d.ten} className="border-t border-gray-100">
              <td className="px-3 py-1.5">{d.ten}</td>
              <td className="px-3 py-1.5 text-right whitespace-nowrap tabular-nums text-gray-700">{coTruoc && d.truoc != null ? `${d.truoc} → ` : ""}{d.viTri}</td>
              <td className="px-3 py-1.5 text-right whitespace-nowrap tabular-nums text-gray-500">{d.impressions} hiển thị · {d.clicks} bấm</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function SeoAgentPage() {
  const { t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(user.role === "admin" || user.role === "ceo" || isManagerOrAbove(user.role) || isMktPosition(user.position))) redirect("/");

  const [caiDat, th, tk, dt, dx, hang, may, bao] = await Promise.all([
    docCaiDat(), doc<ThuHang>(KEY_THU_HANG), doc<any>(KEY_TU_KHOA), doc<any>(KEY_DOI_THU),
    doc<{ ngay: string; muc: DeXuat[] }>(KEY_DE_XUAT), doc<any[]>(KEY_HANG_VIET), doc<any>(KEY_MAY_LAST), doc<any>(KEY_BAO_LAST),
  ]);
  const [nk, hoc] = await Promise.all([doc<NhatKy[]>(KEY_NHAT_KY), doc<any>(KEY_BAI_HOC)]);
  const nkMoi = [...(nk || [])].reverse().slice(0, 40);
  const KQ: Record<string, [string, string]> = { dang: ["Đã đăng", "text-emerald-700 font-semibold"], cho: ["Sửa tiếp", "text-amber-700"], giu: ["Giữ lại", "text-gray-500"], chan: ["Cổng chặn", "text-red-700"], loi: ["Lỗi chấm", "text-red-700"] };
  const h2 = "text-sm font-bold text-gray-800 mt-7 mb-2";

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900">{t("Agent SEO — example.com")}</h1>
      <p className="text-sm text-gray-500 mt-1 mb-4">
        {t("Máy tự nghiên cứu từ khoá, soi đối thủ, theo dõi thứ hạng và đề xuất việc mỗi ngày. Duyệt và đổi giờ báo cáo bằng lệnh")} <b>/seo</b> {t("trong Telegram.")}
      </p>

      <div className="grid sm:grid-cols-3 gap-3 text-[13px]">
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="text-gray-500">{t("Báo cáo Telegram")}</div>
          <div className="font-semibold text-gray-900 mt-0.5">{caiDat.gioBaoCao.map((g) => `${g}h`).join(", ")} {t("mỗi ngày")}</div>
          <div className={`mt-1 ${bao?.ok === false ? "text-red-700" : "text-gray-500"}`}>{t("Máy chủ")}: {tuoi(bao?.at)}{bao?.loi ? ` — ${bao.loi}` : ""}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="text-gray-500">{t("Máy nghiên cứu (Mac)")}</div>
          <div className={`font-semibold mt-0.5 ${may?.ok === false ? "text-red-700" : "text-gray-900"}`}>{tuoi(may?.at)}</div>
          <div className="mt-1 text-gray-500">{may?.ghiChu || t("chưa có nhịp")}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="text-gray-500">{t("Hàng chờ viết")}</div>
          <div className="font-semibold text-gray-900 mt-0.5">{(hang || []).filter((x) => !x.dung).length} {t("bài đã duyệt")}</div>
          <div className="mt-1 text-gray-500">{t("Máy viết")} {caiDat.soBaiVietNgay} {t("bài mỗi ngày, bài qua cổng duyệt blog rồi mới lên web.")}</div>
        </div>
      </div>

      <h2 className={h2}>{t("Máy viết — chấm điểm và đăng bài")}</h2>
      <p className="text-[13px] text-gray-600 mb-2">
        {caiDat.tuDong ? t("Đang chạy tự động") : t("Đang dừng tự động, bài nằm chờ duyệt")} · {caiDat.soBaiVietNgay} {t("bài mỗi ngày")} · {t("chỉ đăng bài từ")} {caiDat.nguongDiem}/100 · {t("dừng: /dung, bật: /chay")}
      </p>
      {!nkMoi.length ? <p className="text-sm text-gray-500">{t("Chưa có bài nào được chấm.")}</p> : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-gray-50 text-gray-500">
              <tr>{[t("Ngày"), t("Bài"), t("Điểm"), t("Vòng sửa"), t("Kết quả"), t("Ghi chú")].map((x) => <th key={x} className="text-left font-semibold px-3 py-2 whitespace-nowrap">{x}</th>)}</tr>
            </thead>
            <tbody>
              {nkMoi.map((x, i) => (
                <tr key={i} className="border-t border-gray-100 align-top">
                  <td className="px-3 py-1.5 whitespace-nowrap tabular-nums text-gray-500">{x.ngay}</td>
                  <td className="px-3 py-1.5">{x.url ? <a href={x.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{x.slug}</a> : x.slug}</td>
                  <td className="px-3 py-1.5 tabular-nums">{x.diem ?? ""}</td>
                  <td className="px-3 py-1.5 tabular-nums">{x.vong ?? ""}</td>
                  <td className={`px-3 py-1.5 whitespace-nowrap ${KQ[x.kq]?.[1] || ""}`}>{t(KQ[x.kq]?.[0] || x.kq)}</td>
                  <td className="px-3 py-1.5 text-gray-600 min-w-[240px]">{x.lyDo || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {hoc?.baiHoc?.length ? (
        <div className="bg-white border border-gray-200 rounded-lg p-3 mt-3 text-[13px]">
          <div className="font-semibold text-gray-700 mb-1">{t("Bài học máy tự rút")} <span className="font-normal text-gray-500">({hoc.soBai} {t("bài đã đăng")})</span></div>
          {hoc.nhanXet ? <p className="text-gray-600 mb-1.5">{hoc.nhanXet}</p> : null}
          <ul className="list-disc pl-5 space-y-0.5 text-gray-700">{hoc.baiHoc.map((b: string) => <li key={b}>{b}</li>)}</ul>
        </div>
      ) : null}

      <h2 className={h2}>{t("Đề xuất việc")} {dx?.ngay ? `— ${dx.ngay}` : ""}</h2>
      {!dx?.muc?.length ? <p className="text-sm text-gray-500">{t("Chưa có đề xuất.")}</p> : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-gray-50 text-gray-500">
              <tr>{[t("Mã"), t("Loại"), t("Việc"), t("Từ khoá"), t("Vì sao"), t("Trạng thái")].map((x) => <th key={x} className="text-left font-semibold px-3 py-2 whitespace-nowrap">{x}</th>)}</tr>
            </thead>
            <tbody>
              {dx.muc.map((m) => (
                <tr key={m.id} className="border-t border-gray-100 align-top">
                  <td className="px-3 py-2 tabular-nums text-gray-500">{m.id}</td>
                  <td className="px-3 py-2 whitespace-nowrap"><span className={`text-[11px] px-1.5 py-0.5 rounded ${LOAI[m.loai]?.[1] || ""}`}>{LOAI[m.loai]?.[0] || m.loai}</span></td>
                  <td className="px-3 py-2 font-medium text-gray-900 min-w-[220px]">{m.tieuDe}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-700">{m.tuKhoa}</td>
                  <td className="px-3 py-2 text-gray-600 min-w-[280px]">{m.lyDo}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{m.trangThai === "duyet" ? <span className="text-emerald-700 font-semibold">{t("Đã duyệt")}</span> : m.trangThai === "bo" ? <span className="text-gray-400">{t("Đã bỏ")}</span> : <span className="text-amber-700">{t("Chờ duyệt")}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className={h2}>{t("Thứ hạng từ khoá")} {th ? `— 7 ngày tới ${th.ky.den}` : ""}</h2>
      {!th ? <p className="text-sm text-gray-500">{t("Chưa có số Search Console (máy chủ chụp mỗi ngày một lần).")}</p> : (
        <>
          <p className="text-[13px] text-gray-600 mb-2 tabular-nums">
            {th.tong.clicks} {t("lượt bấm")} ({t("kỳ trước")} {th.tong.clicksTruoc}) · {th.tong.impressions} {t("lượt hiển thị")} ({t("kỳ trước")} {th.tong.impressionsTruoc}) · {th.tong.soTuKhoa} {t("từ khoá có hiển thị")}
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            <BangHang ten={t("Lên hạng")} dong={th.len} coTruoc />
            <BangHang ten={t("Tụt hạng")} dong={th.xuong} coTruoc />
            <BangHang ten={t("Sát trang một (vị trí 5-20)")} dong={th.ganTrangMot} />
            <BangHang ten={t("Hiện nhiều mà không ai bấm")} dong={th.itBam} />
            <BangHang ten={t("Từ khoá mới xuất hiện")} dong={th.moi} />
            <BangHang ten={t("Từ khoá mang lượt bấm")} dong={th.top.slice(0, 15)} />
          </div>
        </>
      )}

      <h2 className={h2}>{t("Kho từ khoá")} {tk ? `— ${tk.tong} từ, ${tuoi(tk.at)}` : ""}</h2>
      {!tk?.nhom ? <p className="text-sm text-gray-500">{t("Máy nghiên cứu chưa chạy.")}</p> : (
        <>
          <p className="text-[13px] text-gray-600 mb-2">{tk.moi?.length || 0} {t("từ mới so với lượt trước")} · {tk.biLoai} {t("từ bị loại vì rào pháp lý thực phẩm bổ sung")}{tk.loiTrend ? ` · ${t("xu hướng lỗi")}: ${tk.loiTrend}` : ""}</p>
          <div className="grid md:grid-cols-2 gap-3">
            {NHOM.map(([k, nhan]) => (
              <div key={k} className="bg-white border border-gray-200 rounded-lg p-3">
                <div className="text-[13px] font-semibold text-gray-700 mb-1.5">{t(nhan)} <span className="text-gray-400 font-normal tabular-nums">{tk.nhom[k]?.length || 0}</span></div>
                {k === "trend" && tk.trend?.length
                  ? <ul className="text-[13px] text-gray-700 space-y-1">{tk.trend.map((x: any) => <li key={x.ten}><b>{x.ten}</b>{x.goc ? ` — ${x.goc}` : ""}</li>)}</ul>
                  : <p className="text-[13px] text-gray-600 leading-relaxed">{(tk.nhom[k] || []).slice(0, 30).join(" · ") || t("không có từ nào lượt này")}</p>}
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className={h2}>{t("Đối thủ đang làm gì")} {dt ? `— ${tuoi(dt.at)}` : ""}</h2>
      {!dt?.mien?.length ? <p className="text-sm text-gray-500">{t("Chưa soi được tên miền nào.")}</p> : (
        <div className="grid md:grid-cols-2 gap-3">
          {dt.mien.map((m: any) => (
            <div key={m.mien} className="bg-white border border-gray-200 rounded-lg p-3 text-[13px]">
              <div className="font-semibold text-gray-800">{m.mien} <span className="font-normal text-gray-500 tabular-nums">{m.loi ? "" : `${m.tong} ${t("trang")}, ${m.moi.length} ${t("mới")}`}</span></div>
              {m.loi ? <p className="text-red-700 mt-1">{t("Không đọc được")}: {m.loi}</p> : (
                <ul className="mt-1.5 space-y-1 text-gray-700">
                  {m.moi.slice(0, 8).map((b: any) => <li key={b.url}><a href={b.url} target="_blank" rel="noopener noreferrer nofollow" className="hover:underline">{b.tieuDe || b.url}</a> <span className="text-gray-400 tabular-nums">{b.ngay}</span></li>)}
                  {!m.moi.length && <li className="text-gray-500">{t("Không có trang mới kể từ lượt trước.")}</li>}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
