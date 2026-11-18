import { getT } from "@/lib/i18n-server";
import { Building2, Bot } from "lucide-react";
import type { PhongAiLive } from "@/lib/ai-map";

const TEN_LOAI: Record<string, string> = { phong: "Phòng", tro_ly: "Trợ lý", router: "Điều phối", bot: "Bot", may: "Máy" };
const DEN: Record<string, string> = {
  song: "bg-emerald-500", yeu: "bg-amber-400", hong: "bg-red-500", tam_dung: "bg-gray-400", chet: "bg-gray-300",
};

export default function PhongAiPanel({ daNapDb, phong }: { daNapDb: boolean; phong: PhongAiLive[] }) {
  const { t: t } = getT();
  return (
    <section className="max-w-[1400px] mx-auto mt-6 bg-white border border-gray-200 rounded-xl p-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Building2 className="w-5 h-5 text-brand-600" /> {t("Phòng AI")}
      </h2>
      <p className="text-xs text-gray-500 mt-1">
        {daNapDb
          ? t("Đọc từ bảng agents: phòng/tầng AI, nút phòng ban trên cây Acme Ops và các bot/máy thuộc phòng.")
          : t("Chưa nạp DB: danh sách tĩnh 10 phòng/tầng, chưa gắn phòng ban và máy. Hiện đủ sau khi chạy migration 067 và seed 070.")}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 mt-3">
        {phong.map((p) => (
          <div key={p.id} className="rounded-lg border border-gray-200 p-3 bg-gray-50">
            <div className="flex items-center gap-2">
              {p.trangThai && <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${DEN[p.trangThai] || "bg-gray-300"}`} />}
              <span className="font-semibold text-sm text-gray-800">{t(p.ten)}</span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {t(TEN_LOAI[p.loai]) || p.loai}
              {p.phongBan ? ` · thuộc ${p.phongBan}` : daNapDb ? t(" · chưa gắn phòng ban") : ""}
            </div>
            {p.thanhVien.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {p.thanhVien.map((m) => (
                  <li key={m.id} className="text-xs text-gray-700 flex items-center gap-1">
                    <Bot className="w-3 h-3 text-gray-400 shrink-0" /> {t(m.ten)}
                    <span className="text-gray-400">({t(TEN_LOAI[m.loai]) || m.loai})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
