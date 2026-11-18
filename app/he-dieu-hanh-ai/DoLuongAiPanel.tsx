import { getT } from "@/lib/i18n-server";
import { Gauge, UserRound } from "lucide-react";
import type { docDoLuongAi } from "@/lib/do-luong-ai";

type Props = Awaited<ReturnType<typeof docDoLuongAi>>;

const so = (n: number) => n.toLocaleString("vi-VN");

export default function DoLuongAiPanel({ evals, nhatKy, baseline }: Props) {
  const { t: t } = getT();
  return (
    <section className="max-w-[1400px] mx-auto mt-6 bg-white border border-gray-200 rounded-xl p-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Gauge className="w-5 h-5 text-brand-600" /> {t("Đo lường AI")}
      </h2>
      <p className="text-xs text-gray-500 mt-1">
        {t("Máy chỉ được giao thêm việc khi bộ đề chấm tự động (eval) đạt chuẩn. Đổi sang model mới cũng chỉ khi điểm eval bằng hoặc hơn model cũ.")}
      </p>

      <h3 className="text-sm font-semibold text-gray-800 mt-4">{t("Điểm eval hằng tuần")}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-2">
        {evals.map((e) => {
          const cuoi = e.lichSu[e.lichSu.length - 1];
          const pct = cuoi ? Math.round((cuoi.diem / cuoi.tong) * 100) : null;
          const mau = pct == null ? "text-gray-400" : pct >= 95 ? "text-emerald-600" : pct >= 80 ? "text-amber-600" : "text-red-600";
          return (
            <div key={e.key} className="rounded-lg border border-gray-200 p-3 bg-gray-50 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-sm text-gray-800">{t(e.ten)}</span>
                <span className={`text-lg font-bold tabular-nums ${mau}`}>{cuoi ? `${cuoi.diem}/${cuoi.tong}` : t("chưa chạy")}</span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{t(e.soCa)}</div>
              {e.lichSu.length > 1 && (
                <div className="text-[11px] text-gray-500 mt-1 tabular-nums">
                  {t("Các tuần trước:")} {e.lichSu.slice(-6, -1).map((x) => `${x.diem}/${x.tong}`).join(" · ")}
                </div>
              )}
              <div className="text-[11px] mt-1 inline-flex items-center gap-1">
                <UserRound className="w-3 h-3" />
                {e.chu ? <span className="text-gray-500">{e.chu}</span> : <span className="text-red-600 font-semibold">{t("chưa có người giữ")}</span>}
              </div>
            </div>
          );
        })}
      </div>

      <h3 className="text-sm font-semibold text-gray-800 mt-5">{t("Lượng gọi AI 7 ngày")}</h3>
      {nhatKy && nhatKy.tong.goi > 0 ? (
        <div className="overflow-x-auto mt-2">
          <table className="text-xs w-full max-w-2xl">
            <thead className="text-gray-400"><tr><th className="text-left p-1">Model</th><th className="text-right p-1">{t("Lượt gọi")}</th><th className="text-right p-1">{t("Lỗi")}</th><th className="text-right p-1">{t("Token vào")}</th><th className="text-right p-1">{t("Token ra")}</th><th className="text-right p-1">{t("Đọc từ cache")}</th><th className="text-right p-1">{t("Tiết kiệm ròng")}</th></tr></thead>
            <tbody className="tabular-nums">
              {nhatKy.theoModel.map((m) => (
                <tr key={m.model} className="border-t border-gray-100"><td className="p-1">{m.model}</td><td className="p-1 text-right">{so(m.dem.goi)}</td><td className={`p-1 text-right ${m.dem.loi ? "text-red-600" : ""}`}>{so(m.dem.loi)}</td><td className="p-1 text-right">{so(m.dem.inTok)}</td><td className="p-1 text-right">{so(m.dem.outTok)}</td><td className="p-1 text-right">{Math.round(m.cache.tiLeDoc * 100)}%</td><td className={`p-1 text-right ${m.cache.laiRongVnd < 0 ? "text-red-600" : ""}`}>{so(m.cache.laiRongVnd)}đ</td></tr>
              ))}
            </tbody>
          </table>
          <div className="text-[11px] text-gray-400 mt-1">{t("Từ")} {nhatKy.tuNgay} {t("tới")} {nhatKy.denNgay}{t(". Chỉ đếm, không lưu nội dung câu hỏi hay câu trả lời. Prompt caching bật từ 11/10/2026: \"Tiết kiệm ròng\" so với lúc chưa bật; số âm (màu đỏ) nghĩa là đang lỗ, tắt bằng config ai_prompt_cache = off.")}</div>
        </div>
      ) : (
        <p className="text-xs text-gray-500 mt-1">{t("Nhật ký bắt đầu ghi từ 10/10/2026, chưa có lượt gọi nào trong 7 ngày.")}</p>
      )}

      <h3 className="text-sm font-semibold text-gray-800 mt-5">{t("Baseline quy trình: trước và sau khi máy làm")}</h3>
      <div className="overflow-x-auto mt-2">
        <table className="text-xs w-full">
          <thead className="text-gray-400"><tr><th className="text-left p-1">{t("Quy trình")}</th><th className="text-left p-1">{t("Người giữ")}</th><th className="text-left p-1">{t("Trước (giờ người/kỳ)")}</th><th className="text-left p-1">{t("Sau")}</th></tr></thead>
          <tbody>
            {baseline.map((q) => (
              <tr key={q.id} className="border-t border-gray-100 align-top">
                <td className="p-1 font-medium text-gray-800">{t(q.ten)}</td>
                <td className="p-1 text-gray-600">{t(q.nguoiGiu)}</td>
                <td className="p-1">
                  {q.truoc.gioMoiKy != null ? <span className="tabular-nums">{q.truoc.gioMoiKy} {t("giờ")}</span> : <span className="text-red-600 font-semibold">{t("cần số")}</span>}
                  {q.truoc.loiGhiNhan && <div className="text-gray-500 mt-0.5">{t(q.truoc.loiGhiNhan)}</div>}
                </td>
                <td className="p-1 text-gray-700 min-w-[16rem]">{t(q.sau.moTa)}{q.sau.kiemThu && <div className="text-gray-400 mt-0.5">{t("Kiểm:")} {t(q.sau.kiemThu)}</div>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
