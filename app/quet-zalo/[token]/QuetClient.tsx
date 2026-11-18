"use client";

import { useLang } from "@/components/lang-provider";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, QrCode } from "lucide-react";

type Tt = {
  nick?: string; buoc?: string; luc?: string; qr?: string | null;
  luot?: number; ten?: string | null; maySong?: boolean; conLai?: number; loi?: string;
};

const BUOC: Record<string, string> = {
  "cho-may": "Đang gọi máy ở văn phòng lấy mã...",
  "dang-lay-qr": "Đang lấy mã QR...",
  "cho-quet": "Mở Zalo trên điện thoại, vào Thêm > Quét mã QR",
  "da-quet": "Đã quét — mở Zalo trên điện thoại và bấm Đồng ý",
  "da-noi": "Xong! Nick đã nối vào hệ thống.",
  "het-han": "Mã đã hết hạn. Tải lại trang này để lấy mã mới.",
};

export default function QuetClient({ token }: { token: string }) {
  const { t: tDich } = useLang();
  const [tt, setTt] = useState<Tt | null>(null);
  const [dangTai, setDangTai] = useState(true);

  useEffect(() => {
    let dung = false;
    const doc = async () => {
      try {
        const r = await fetch(`/api/hop-thu-zalo/quet/${token}`, { cache: "no-store" });
        const j = await r.json();
        if (!dung) setTt(j);
      } catch {

      } finally {
        if (!dung) setDangTai(false);
      }
    };
    doc();
    const t = setInterval(doc, 3000);
    return () => { dung = true; clearInterval(t); };
  }, [token]);

  if (dangTai) {
    return <div className="flex items-center gap-2 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> {tDich("Đang mở...")}</div>;
  }

  if (tt?.loi) {
    return (
      <div className="w-full max-w-sm rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-sm">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
        <p className="mt-3 font-medium text-slate-800">{tt.loi}</p>
      </div>
    );
  }

  const xong = tt?.buoc === "da-noi";
  const dangCho = ["cho-may", "dang-lay-qr", "da-quet"].includes(tt?.buoc || "");

  return (
    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-400">{tDich("Nối Zalo vào hệ thống ACME")}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">Nick: {tt?.nick}</p>

      <div className="mt-5 flex min-h-[240px] items-center justify-center rounded-xl bg-slate-50 p-3">
        {tt?.buoc === "cho-quet" && tt.qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tt.qr.startsWith("data:") ? tt.qr : `data:image/png;base64,${tt.qr}`} alt={tDich("Mã QR đăng nhập Zalo")} className="h-56 w-56" />
        ) : xong ? (
          <CheckCircle2 className="h-14 w-14 text-emerald-500" />
        ) : dangCho ? (
          <Loader2 className="h-10 w-10 animate-spin text-slate-400" />
        ) : (
          <QrCode className="h-10 w-10 text-slate-400" />
        )}
      </div>

      <p className="mt-4 font-medium text-slate-800">{tDich(BUOC[tt?.buoc || ""]) || tt?.buoc}</p>

      {tt?.buoc === "cho-quet" && (
        <p className="mt-1 text-xs text-slate-500">{tDich("Mã đổi mỗi ~90 giây (lượt")} {tt.luot || 1}/10) — cứ quét mã đang hiện.</p>
      )}
      {tt?.buoc === "da-quet" && tDich(tt.ten) && <p className="mt-1 text-xs text-slate-500">{tDich("Điện thoại:")} {tDich(tt.ten)}</p>}
      {xong && (
        <p className="mt-2 text-xs text-slate-500">
          {tDich("Nick này chỉ nên nối MỘT ống: đã nối vào CRM thì đừng mở Zalo trên máy tính ở chỗ khác — Zalo chỉ cho một phiên máy tính, mở cái kia là đá cái này ra.")}
        </p>
      )}
      {tt?.maySong === false && !xong && (
        <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
          {tDich("Máy ở văn phòng đang tắt nên chưa lấy được mã. Báo quản lý bật máy giúp.")}
        </p>
      )}
    </div>
  );
}
