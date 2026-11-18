"use client";

import { useLang } from "@/components/lang-provider";
import { useState } from "react";
import { WifiOff, Loader2, QrCode, ExternalLink } from "lucide-react";

type NickOff = {
  ownId: string;
  sale: string | null;
  tenZalo: string | null;
  slug: string | null;
};

export default function NickOffBanner({ nick }: { nick: NickOff[] }) {
  const { t: t } = useLang();
  const [dang, setDang] = useState<string | null>(null);
  const [loi, setLoi] = useState("");
  const [link, setLink] = useState<string | null>(null);

  if (!nick.length) return null;

  const noiLai = async (slug: string | null) => {
    if (!slug) {
      setLoi("Chưa biết tên nick kỹ thuật (tien/yen). Báo quản lý gán lại trên Kết nối Zalo.");
      return;
    }
    setLoi(""); setDang(slug); setLink(null);
    try {
      const r = await fetch("/api/hop-thu-zalo/ket-noi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nick: slug, taoLink: true }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.loi || `Lỗi ${r.status}`);
      if (j.link) {
        setLink(j.link);
        window.open(j.link, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = "/zalo/ket-noi";
      }
    } catch (e: any) {
      setLoi(String(e.message || e));
    } finally {
      setDang(null);
    }
  };

  return (
    <div className="border-b border-rose-200 bg-rose-50 px-3 py-2.5 lg:px-4">
      <div className="flex flex-wrap items-start gap-2 text-sm text-rose-900">
        <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {t("Nick Zalo mất kết nối:")} {nick.map((n) => n.tenZalo || n.sale || n.slug || n.ownId).join(", ")}
          </p>
          <p className="mt-0.5 text-xs text-rose-700">
            {t("Khách nhắn vào nick này không vào CRM. Bấm nút → mở trang QR, quét bằng đúng Zalo của nick trên điện thoại (không cần đứng máy cào). Máy cầu nối văn phòng vẫn phải đang chạy.")}
          </p>
          {loi && <p className="mt-1 text-xs text-rose-600">{loi}</p>}
          {link && (
            <a href={link} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#0068FF] underline">
              {t("Mở lại trang quét QR")} <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {nick.map((n) => (
            <button
              key={n.ownId}
              type="button"
              disabled={!!dang || !n.slug}
              onClick={() => noiLai(n.slug)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
            >
              {dang === n.slug ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <QrCode className="h-3.5 w-3.5" />}
              {t("Quét QR nối lại")}{nick.length > 1 ? ` · ${n.slug || "?"}` : ""}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
