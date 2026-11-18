"use client";

import { useLang } from "@/components/lang-provider";
import { useState } from "react";
import { Copy, Check, ExternalLink, ShieldAlert } from "lucide-react";
import type { BanSoan } from "@/lib/dang-cheo";

export default function DangCheoClient({ ds }: { ds: BanSoan[] }) {
  const { t: t } = useLang();
  const [daCopy, setDaCopy] = useState("");
  const [daDang, setDaDang] = useState<Record<string, boolean>>({});
  const [dangGhi, setDangGhi] = useState("");

  const copy = async (b: BanSoan, phan: "bai" | "binhLuan" = "bai") => {
    try {
      await navigator.clipboard.writeText(phan === "bai" ? b.noiDung : b.binhLuan || "");
      setDaCopy(b.ma + phan);
      setTimeout(() => setDaCopy(""), 2000);
    } catch {

    }
  };

  const ghiDaDang = async (b: BanSoan) => {
    setDangGhi(b.ma);
    try {
      const res = await fetch("/api/dang-cheo/da-dang", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ma: b.ma, slug: b.slug }),
      });
      if (res.ok) setDaDang((s) => ({ ...s, [b.ma]: true }));
    } finally {
      setDangGhi("");
    }
  };

  return (
    <div className="space-y-3">
      {ds.map((b) => (
        <div
          key={b.ma}
          className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4"
        >
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-[13.5px] font-bold text-gray-900">{t(b.ten)}</span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
              {b.mucTuDong === "may-dang" ? t("kênh mình sở hữu") : t("người đăng")}
            </span>
            {b.daLoc && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 inline-flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" /> {t("đã lọc lại chữ theo rào thực phẩm bổ sung")}
              </span>
            )}
            {daDang[b.ma] && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{t("đã đăng")}</span>
            )}
          </div>

          <div className="text-[13.5px] font-semibold text-gray-800 mb-1.5">{t(b.tieuDe)}</div>

          <div className="text-[13px] text-gray-800 bg-gray-50 border border-gray-100 rounded-xl p-3 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
            {t(b.noiDung)}
          </div>

          {b.anh && (
            <div className="mt-2.5 flex items-start gap-3">
              <img src={b.anh} alt="" className="w-28 h-16 object-cover rounded-lg border border-gray-100" />
              <a
                href={b.anh}
                target="_blank"
                rel="noreferrer"
                className="text-[12px] text-emerald-700 font-semibold underline decoration-dotted mt-1"
              >
                {t("Mở ảnh để tải về đăng kèm")}
              </a>
            </div>
          )}

          {b.binhLuan && (
            <div className="mt-2.5 border border-amber-200 bg-amber-50 rounded-xl p-3">
              <div className="text-[12px] font-bold text-amber-800 mb-1.5">{t("Dán bình luận này ngay sau khi bài lên")}</div>
              <div className="text-[13px] text-gray-800 whitespace-pre-wrap leading-relaxed">{b.binhLuan}</div>
              <button
                onClick={() => copy(b, "binhLuan")}
                className="mt-2 text-[12px] font-semibold px-2.5 py-1 rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-100 inline-flex items-center gap-1.5"
              >
                {daCopy === b.ma + "binhLuan" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {daCopy === b.ma + "binhLuan" ? t("Đã chép") : t("Chép bình luận")}
              </button>
            </div>
          )}

          {b.huongDan && <div className="text-[12px] text-gray-500 mt-2">{t("Lưu ý khi đăng:")} {b.huongDan}</div>}

          <div className="flex flex-wrap gap-2 mt-2.5">
            <button
              onClick={() => copy(b, "bai")}
              className="text-[12.5px] font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-1.5"
            >
              {daCopy === b.ma + "bai" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {daCopy === b.ma + "bai" ? t("Đã chép") : t("Chép bài đăng")}
            </button>
            <a
              href={b.link}
              target="_blank"
              rel="noreferrer"
              className="text-[12.5px] font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:border-emerald-400 inline-flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" /> {t("Mở bài gốc")}
            </a>
            <button
              onClick={() => ghiDaDang(b)}
              disabled={daDang[b.ma] || dangGhi === b.ma}
              className="text-[12.5px] font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:border-emerald-400 disabled:opacity-50"
            >
              {daDang[b.ma] ? t("Đã ghi sổ") : dangGhi === b.ma ? t("Đang ghi...") : t("Đã đăng")}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
