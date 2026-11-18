"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useTransition } from "react";
import { luuNhomTinhCach } from "./actions";

import { GOI_Y_NHOM, type NhomTinhCach } from "@/lib/covan/knowledge_dungnguoi";

const NHOM = (Object.keys(GOI_Y_NHOM) as NhomTinhCach[]).map((k) => ({ k, ten: GOI_Y_NHOM[k].ten }));

type Nhom = NhomTinhCach;
type NhanVien = { id: string; full_name: string; position: string | null };

export function DungNguoiPanel({ nhanVien, danhDau, huongDan }: {
  nhanVien: NhanVien[]; danhDau: Record<string, string>; huongDan: string;
}) {
  const { t: t } = useLang();
  const [map, setMap] = useState(danhDau);
  const [moHuongDan, setMoHuongDan] = useState(false);
  const [dangLuu, batDau] = useTransition();
  const [loi, setLoi] = useState("");

  const doi = (userId: string, nhom: string) => {
    const truoc = map[userId] || "";
    setMap((m) => ({ ...m, [userId]: nhom }));
    setLoi("");
    batDau(async () => {
      try { await luuNhomTinhCach(userId, nhom as Nhom | ""); }
      catch (e: any) { setMap((m) => ({ ...m, [userId]: truoc })); setLoi(e?.message || "Lưu không được"); }
    });
  };

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{t("Dùng người theo nhóm tính cách")}</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {t("Gắn nhóm để biết cách giao việc và cách nói với từng người. Chưa chắc thì")} <b>{t("để trống")}</b> {t("—\n            gán sai rồi quản theo nhóm sai còn tệ hơn không gán. Quan sát qua ba lần giao việc rồi hãy kết luận.")}
          </p>
        </div>
        <button onClick={() => setMoHuongDan((v) => !v)}
          className="shrink-0 text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
          {moHuongDan ? t("Đóng hướng dẫn") : t("Mở hướng dẫn đầy đủ")}
        </button>
      </div>

      <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-900">
        <b>{t("Nhóm tính cách KHÔNG phải thước đo năng lực.")}</b> {t("Không dùng để loại ứng viên, không dùng\n        làm căn cứ tăng hay hạ lương, không dùng khi đánh giá cuối kỳ — những việc đó đo bằng kết quả\n        công việc. Và đừng nói với nhân viên rằng họ &quot;thuộc nhóm X nên mới thế&quot;.")}
      </div>

      {loi && <div className="bg-rose-100 border border-rose-300 rounded-lg p-2 text-sm text-rose-900">{loi}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2 pr-2">{t("Người")}</th>
              <th className="py-2 pr-2">{t("Nhóm")}</th>
              <th className="py-2 pr-2">{t("Giao việc thế nào")}</th>
            </tr>
          </thead>
          <tbody>
            {nhanVien.map((u) => {
  const { t: t } = useLang();
              const n = (map[u.id] || "") as Nhom | "";
              const g = n ? GOI_Y_NHOM[n] : null;
              return (
                <tr key={u.id} className="border-b last:border-0 align-top">
                  <td className="py-2 pr-2">
                    <div className="font-medium">{u.full_name}</div>
                    <div className="text-xs text-gray-500">{u.position || ""}</div>
                  </td>
                  <td className="py-2 pr-2">
                    <select value={n} disabled={dangLuu} onChange={(e) => doi(u.id, e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white disabled:opacity-50">
                      <option value="">{t("— chưa rõ —")}</option>
                      {NHOM.map((x) => <option key={x.k} value={x.k}>{x.k} · {t(x.ten)}</option>)}
                    </select>
                  </td>
                  <td className="py-2 pr-2 text-gray-600">
                    {g ? (
                      <div className="space-y-0.5">
                        <div>{g.giao}</div>
                        <div className="text-xs"><span className="text-gray-400">{t("Góp ý:")} </span>{g.gopY}</div>
                        <div className="text-xs"><span className="text-gray-400">{t("Thưởng:")} </span>{g.thuong}</div>
                        <div className="text-xs text-rose-700">{t("Tắt điện khi:")} {g.tatDien}</div>
                      </div>
                    ) : <span className="text-gray-400">{t("Chọn nhóm để hiện gợi ý")}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {moHuongDan && (
        <div className="border-t pt-3">
          <p className="text-xs text-gray-500 mb-2">
            {t("Nội dung dưới đây lấy từ kho kiến thức dùng chung với cố vấn AI — sửa thì sửa ở")}
            <span className="tabular-nums"> lib/covan/knowledge_dungnguoi.ts</span>{t(", đừng chép ra chỗ khác.")}
          </p>
          <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">{huongDan}</pre>
        </div>
      )}
    </section>
  );
}
