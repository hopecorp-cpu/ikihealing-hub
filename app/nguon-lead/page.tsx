import { getT } from "@/lib/i18n-server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase-server";
import { isManagerOrAbove, isMktPosition } from "@/lib/auth";
import { docNguonLead, docNguonApp, docBaiFanpage } from "@/lib/nguon-lead-server";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Nguồn lead | ACME Ops Hub") };
}

const gio = (t: number) => new Date(t + 7 * 3600e3).toISOString().replace("T", " ").slice(5, 16);

export default async function NguonLeadPage({ searchParams }: { searchParams: { d?: string } }) {
  const { t: tDich } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const xem = user.role === "admin" || user.role === "ceo" || isManagerOrAbove(user.role) || isMktPosition(user.position);
  if (!xem) redirect("/");

  const ngay = [7, 30, 90].includes(Number(searchParams.d)) ? Number(searchParams.d) : 30;
  const [{ dong, tuNgay, theoKenh, theoCua, daGanNhan, loi }, app, bai] = await Promise.all([docNguonLead(ngay), docNguonApp(), docBaiFanpage(ngay)]);
  const tyLeDo = dong.length ? Math.round((daGanNhan / dong.length) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-xl font-bold text-gray-900">{tDich("Nguồn lead — khách về từ kênh nào")}</h1>
        <div className="flex gap-1.5 text-sm">
          {[7, 30, 90].map((d) => (
            <a key={d} href={`/nguon-lead?d=${d}`}
              className={`px-3 py-1.5 rounded-lg border ${d === ngay ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-600 border-gray-200"}`}>{d} {tDich("ngày")}</a>
          ))}
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        {tDich("Từ")} {tuNgay}. <b>{tDich("CỬA")}</b> {tDich("= chỗ khách để lại thông tin trên hệ thống của mình.")} <b>{tDich("KÊNH")}</b> {tDich("= khách tới từ đâu (đọc utm/referrer trang gắn vào lúc gửi form).")}
      </p>

      {loi && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-[13.5px] text-red-800 mb-4">
          {tDich("Đọc bảng lead lỗi:")} {loi} {tDich("— số dưới đây THIẾU, đừng dùng để kết luận.")}
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-[13.5px] text-amber-900 mb-5">
        <b>{daGanNhan}/{dong.length} lead ({tyLeDo}{tDich("%) đo được nguồn thật.")}</b> {tDich("Phần còn lại là SUY ĐOÁN từ chữ tự do\n        (tên fanpage, nick Zalo, đuôi link tự phát) — cột Kênh có chữ &ldquo;đoán&rdquo;.\n        Nhãn nguồn mới gắn từ 29/09/2026 (script")} <code>gan-nguon.mjs</code> {tDich("trên example.com), nên lead cũ hơn mốc đó\n        không bao giờ có nhãn; tỉ lệ này phải tăng dần theo ngày, đứng yên nghĩa là nhãn chưa lên web.")}
      </div>

      <h2 className="text-sm font-bold text-gray-700 mb-2">{tDich("Chi tiết")} {Math.min(dong.length, 200)} {tDich("lead gần nhất")}</h2>
      <div className="overflow-x-auto bg-white border border-gray-200 rounded-2xl mb-6">
        <table className="w-full text-[13px]">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              {[tDich("Thời gian"), tDich("Liên hệ"), tDich("Cửa"), tDich("Kênh"), tDich("Chi tiết nguồn"), "Trang", tDich("Trạng thái")].map((h) => (
                <th key={h} className="text-left font-semibold px-3 py-2 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dong.slice(0, 200).map((d, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-3 py-1.5 whitespace-nowrap text-gray-500 tabular-nums">{gio(d.t)}</td>
                <td className="px-3 py-1.5 whitespace-nowrap">
                  <span className={`text-[11px] px-1.5 py-0.5 rounded mr-1 ${d.loai === "sdt" ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700"}`}>{d.loai === "sdt" ? tDich("SĐT") : "email"}</span>
                  {d.ai}
                </td>
                <td className="px-3 py-1.5 whitespace-nowrap">{d.cua}</td>
                <td className="px-3 py-1.5 whitespace-nowrap">
                  {d.kenh}
                  {d.doan && <span className="ml-1 text-[11px] text-amber-600">{tDich("đoán")}</span>}
                </td>
                <td className="px-3 py-1.5 text-gray-500 max-w-[260px] truncate" title={d.goc}>{d.chiTiet || "—"}</td>
                <td className="px-3 py-1.5 text-gray-500 max-w-[180px] truncate">{d.trang || "—"}</td>
                <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{d.trangThai || "—"}</td>
              </tr>
            ))}
            {!dong.length && <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">{tDich("Chưa có lead nào trong")} {ngay} {tDich("ngày.")}</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 text-sm font-bold text-gray-700">{tDich("Tổng theo KÊNH (khách tới từ đâu)")}</div>
          <table className="w-full text-[13px]">
            <thead className="bg-gray-50 text-gray-500"><tr>
              <th className="text-left font-semibold px-3 py-2">{tDich("Kênh")}</th>
              <th className="text-right font-semibold px-3 py-2">{tDich("SĐT")}</th>
              <th className="text-right font-semibold px-3 py-2">Email</th>
              <th className="text-right font-semibold px-3 py-2">{tDich("Tổng")}</th>
              <th className="text-right font-semibold px-3 py-2">{tDich("Đoán")}</th>
            </tr></thead>
            <tbody>
              {theoKenh.map((k) => (
                <tr key={tDich(k.ten)} className="border-t border-gray-100">
                  <td className="px-3 py-1.5">{tDich(k.ten)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{k.sdt}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{k.email}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{k.tong}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-amber-600">{k.doan || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 text-sm font-bold text-gray-700">{tDich("Tổng theo CỬA (khách để lại thông tin ở đâu)")}</div>
          <table className="w-full text-[13px]">
            <thead className="bg-gray-50 text-gray-500"><tr>
              <th className="text-left font-semibold px-3 py-2">{tDich("Cửa")}</th>
              <th className="text-right font-semibold px-3 py-2">Lead</th>
            </tr></thead>
            <tbody>
              {theoCua.map((c) => (
                <tr key={tDich(c.ten)} className="border-t border-gray-100">
                  <td className="px-3 py-1.5">{tDich(c.ten)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{c.tong}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {bai && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mt-4">
          <div className="px-4 py-2.5 border-b border-gray-100 text-sm font-bold text-gray-700">
            {tDich("Bài fanpage đẻ ra lead —")} {bai.tongLead} {tDich("lead bình luận từ")} {bai.bai.length} {tDich("bài")}
          </div>
          <div className="px-4 py-3 text-[13px] text-gray-600">
            {tDich("Khách bình luận dưới bài nào thì lead mang luôn mã bài đó (mã bình luận Facebook là")}
            <code className="mx-1">post_id_comment_id</code>{tDich("), nên bảng này đọc ngược được cả phần lịch sử, không phải ghi thêm gì.")}
            {" "}{tDich("Lead vào")} <b>{tDich("hộp thư")}</b> {tDich("thì không nối được: API Hội thoại của Facebook không mang tham chiếu bài nào.")}
            {bai.daLoai > 0 && (
              <div className="mt-1 text-amber-700">
                {tDich("Đã LOẠI")} {bai.daLoai} {tDich("dòng do chính trang tự bình luận dưới bài của mình (câu rải mời vào group) —\n                đếm vào thì bảng này đang đo chính mình nói với mình, không phải khách.")}
              </div>
            )}
            {bai.moiNhat != null && (
              <div className={`mt-1 ${Date.now() - bai.moiNhat > 7 * 864e5 ? "text-amber-700" : "text-gray-500"}`}>
                {tDich("Lead bình luận gần nhất:")} {new Date(bai.moiNhat + 7 * 3600e3).toISOString().slice(0, 10)}
                {Date.now() - bai.moiNhat > 7 * 864e5 && tDich(" — máy bóc bình luận đang đứng, bảng trống KHÔNG có nghĩa là bài không ra lead.")}
              </div>
            )}
          </div>
          {bai.bai.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-gray-50 text-gray-500"><tr>
                  <th className="text-right font-semibold px-3 py-2">Lead</th>
                  <th className="text-left font-semibold px-3 py-2">{tDich("Bài")}</th>
                  <th className="text-left font-semibold px-3 py-2">Fanpage</th>
                  <th className="text-left font-semibold px-3 py-2">{tDich("Gần nhất")}</th>
                </tr></thead>
                <tbody>
                  {bai.bai.slice(0, 40).map((b) => (
                    <tr key={b.pid} className="border-t border-gray-100 align-top">
                      <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{b.so}</td>
                      <td className="px-3 py-1.5 max-w-xl">
                        {b.link
                          ? <a href={b.link} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">{b.chu || b.pid}</a>
                          : <span className="text-gray-500">{b.chu || <span className="text-gray-400">{tDich("chưa đọc được nội dung (")}{b.pid})</span>}</span>}
                      </td>
                      <td className="px-3 py-1.5 text-gray-500">{b.page}</td>
                      <td className="px-3 py-1.5 text-gray-500 tabular-nums">{new Date(b.moiNhat + 7 * 3600e3).toISOString().slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="px-4 py-2.5 border-t border-gray-100 text-[12px] text-gray-500">
            {tDich("Chữ của bài lấy từ sổ")} <code>fb_bai_de_lead</code>
            {bai.tuoiChuGio != null ? ` (cập nhật ${bai.tuoiChuGio}h trước)` : tDich(" (chưa có sổ)")} {tDich("—\n            chạy")} <code>node scripts/fb-bai-de-lead.mjs --ghi</code> {tDich("để làm mới.\n            Bài của fanpage không còn trong tay mình thì chỉ hiện mã, số đếm vẫn đúng.")}
          </div>
        </div>
      )}

      {app && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mt-4">
          <div className="px-4 py-2.5 border-b border-gray-100 text-sm font-bold text-gray-700 flex flex-wrap items-center gap-2">
            {tDich("App NOVA — người dùng về từ kênh nào")}
            <span className={`text-[11px] font-normal px-1.5 py-0.5 rounded ${app.tuoiGio != null && app.tuoiGio <= 30 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
              {app.tuoiGio == null ? tDich("không rõ mốc đo") : `số đo ${app.tuoiGio}h trước`}
            </span>
          </div>
          <div className="px-4 py-3 text-[13px] text-gray-600">
            {app.soLieu.nguoiDung} {tDich("người dùng ·")} {app.soLieu.nguoiDungMoi7Ngay ?? "?"} {tDich("mới trong 7 ngày ·")}
            {" "}{app.nguon?.coSdt ?? "?"} {tDich("người đã cho SĐT, dò ra")} {app.nguon?.khop ?? "?"} {tDich("người trong bảng lead.")}
            <div className="mt-1 text-gray-500">
              {tDich("Chợ ứng dụng cắt đứt utm nên đo bằng hai nửa RỜI NHAU, cố ý không cộng lại: lượt bấm link tải (trước chợ)\n              và người dùng đã cho SĐT dò ngược ra lead (sau chợ, chắc nhưng chỉ phủ phần có SĐT).")}
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-px bg-gray-100">
            <div className="bg-white p-3">
              <div className="text-[12px] font-semibold text-gray-500 mb-1.5">{tDich("Sau chợ — người dùng app dò ra lead")}</div>
              {app.theoKenh.length ? app.theoKenh.map((k) => (
                <div key={tDich(k.ten)} className="flex justify-between text-[13px] py-0.5">
                  <span>{tDich(k.ten)}{k.doan && <span className="ml-1 text-[11px] text-amber-600">{tDich("đoán")}</span>}</span>
                  <span className="tabular-nums font-semibold">{k.so}</span>
                </div>
              )) : <div className="text-[13px] text-gray-400">{tDich("chưa dò ra ai")}</div>}
            </div>
            <div className="bg-white p-3">
              <div className="text-[12px] font-semibold text-gray-500 mb-1.5">{tDich("Trước chợ — lượt bấm link tải có đo")}</div>
              {app.luotBam.length ? app.luotBam.map((l) => (
                <div key={l.nguon} className="flex justify-between text-[13px] py-0.5">
                  <span className="truncate mr-2">{l.nguon}</span>
                  <span className="tabular-nums font-semibold">{l.so}</span>
                </div>
              )) : <div className="text-[13px] text-gray-400">{tDich("chưa có lượt nào")}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
