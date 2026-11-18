"use client";

import { useLang } from "@/components/lang-provider";
import { useState } from "react";
import { Copy, Check, Flame, Stethoscope, ExternalLink, Phone } from "lucide-react";
import type { BanNhap } from "@/lib/ca-truc-ai";

const KENH: Record<string, { ten: string; mau: string }> = {
  zalo: { ten: "Zalo", mau: "#0068FF" },
  facebook: { ten: "Facebook", mau: "#1877F2" },
  lead: { ten: "Lead mới", mau: "#8B5CF6" },
};

function ngay(gio: number): string {
  if (gio < 24) return `${Math.round(gio)} giờ`;
  return `${Math.round(gio / 24)} ngày`;
}

export default function CaTrucClient({ ds, meName }: { ds: BanNhap[]; meName: string }) {
  const { t: t } = useLang();
  const [daCopy, setDaCopy] = useState<string>("");
  const [loc, setLoc] = useState<"tat-ca" | "cua-toi" | "nong">("tat-ca");

  const hien = ds.filter((d) => {
    if (loc === "nong") return d.nong;
    if (loc === "cua-toi") return (d.trang || "").toLowerCase().includes(meName.toLowerCase()) && meName.length > 1;
    return true;
  });

  const copy = async (d: BanNhap, key: string) => {
    try {
      await navigator.clipboard.writeText(d.traLoi);
      setDaCopy(key);
      setTimeout(() => setDaCopy(""), 2000);
    } catch {  }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {([["tat-ca", `Tất cả (${ds.length})`], ["nong", `Muốn mua (${ds.filter((d) => d.nong).length})`], ["cua-toi", "Của tôi"]] as const).map(([k, nhan]) => (
          <button
            key={k}
            onClick={() => setLoc(k as any)}
            className={`text-[13px] font-semibold px-3 py-1.5 rounded-md border transition ${
              loc === k ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-600 border-gray-200 hover:border-emerald-400"
            }`}
          >
            {nhan}
          </button>
        ))}
      </div>

      {hien.length === 0 && (
        <div className="text-[13px] text-gray-500 bg-white border border-gray-100 rounded-2xl p-6 text-center">
          {t("Không có ai trong nhóm này.")}
        </div>
      )}

      {hien.map((d, i) => {
  const { t: t } = useLang();
        const key = `${d.kenh}-${d.phone || t(d.ten)}-${i}`;
        const k = KENH[d.kenh] || KENH.lead;
        return (
          <div key={key} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-[13.5px] font-bold text-gray-900">{t(d.ten)}</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${k.mau}14`, color: k.mau }}>{t(k.ten)}</span>
              {d.trang && <span className="text-[11.5px] text-gray-400">{d.trang}</span>}
              <span className="text-[11.5px] text-gray-500">{t("chờ")} {ngay(d.choGio)}</span>
              {d.nong && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 inline-flex items-center gap-1">
                  <Flame className="w-3 h-3" /> {t("muốn mua")}
                </span>
              )}
              {d.benh && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 inline-flex items-center gap-1">
                  <Stethoscope className="w-3 h-3" /> {t("chạm chuyện bệnh — đọc kỹ")}
                </span>
              )}
              {d.loai === "khoi-lai" && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{t("câu khơi lại")}</span>
              )}
            </div>

            <div className="text-[12.5px] text-gray-500 mb-2">
              <span className="font-semibold text-gray-600">{t("Khách nói:")}</span> {d.cauHoi}
            </div>

            <div className="text-[13.5px] text-gray-800 bg-emerald-50/60 border border-emerald-100 rounded-xl p-3 whitespace-pre-wrap leading-relaxed">
              {d.traLoi}
            </div>

            <div className="flex flex-wrap gap-2 mt-2.5">
              <button
                onClick={() => copy(d, key)}
                className="text-[12.5px] font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-1.5"
              >
                {daCopy === key ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {daCopy === key ? t("Đã chép") : t("Chép câu trả lời")}
              </button>
              {d.link && (
                <a
                  href={d.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[12.5px] font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:border-emerald-400 inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> {t("Mở hội thoại")}
                </a>
              )}
              {d.phone && (
                <a
                  href={`tel:${d.phone}`}
                  className="text-[12.5px] font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:border-emerald-400 inline-flex items-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5" /> {d.phone}
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
