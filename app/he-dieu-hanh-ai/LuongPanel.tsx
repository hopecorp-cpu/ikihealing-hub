"use client";
import { useLang } from "@/components/lang-provider";
import { dichSo } from "@/lib/i18n";

import { useState } from "react";
import { GitBranch, Check, Clock, AlertTriangle, CircleDashed, EyeOff, Hand, ArrowRight } from "lucide-react";
import type { LuongLive, TrangThaiBuoc } from "@/lib/luong";

const B: Record<TrangThaiBuoc, { l: string; bg: string; fg: string; Icon: any }> = {
  xong:            { l: "Xong",            bg: "#DCFCE7", fg: "#15803D", Icon: Check },
  cho_nguoi_duyet: { l: "Chờ người duyệt", bg: "#EDE9FE", fg: "#6D28D9", Icon: Hand },
  hong:            { l: "Hỏng",            bg: "#FEE2E2", fg: "#B91C1C", Icon: AlertTriangle },
  khong_ra_gi:     { l: "Chạy ra 0",       bg: "#FEF3C7", fg: "#B45309", Icon: CircleDashed },
  qua_sla:         { l: "Quá hạn",         bg: "#FFEDD5", fg: "#C2410C", Icon: Clock },
  cho:             { l: "Chưa tới lượt",   bg: "#F1F5F9", fg: "#64748B", Icon: Clock },
  chua_cam_so:     { l: "Chưa cắm sổ",     bg: "#F8FAFC", fg: "#94A3B8", Icon: EyeOff },
};

function gio(s: string | null) {
  if (!s) return "";
  return new Date(s).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
}

export default function LuongPanel({ luong }: { luong: LuongLive[] }) {
  const { t: t } = useLang();

  const mo = luong.find((l) => l.dangTacO != null) || luong.find((l) => l.choNguoi) || luong[0];
  const [chon, setChon] = useState(mo?.ma ?? "");
  const l = luong.find((x) => x.ma === chon) || mo;

  if (!l) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <GitBranch className="w-4 h-4 text-brand-600" />
        <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">{t("Luồng nghiệp vụ")}</span>
        <span className="text-[11px] text-gray-400">{t("— máy bàn giao cho máy, dừng lại ở cổng chờ người gật")}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="border-b lg:border-b-0 lg:border-r border-gray-100 divide-y divide-gray-50">
          {luong.map((x) => {
  const { t: t } = useLang();
            const dang = x.ma === l.ma;
            const pct = Math.round((x.soXong / x.tong) * 100);
            return (
              <button key={x.ma} onClick={() => setChon(x.ma)}
                className={`w-full text-left px-3.5 py-3 transition ${dang ? "bg-brand-50/60" : "hover:bg-gray-50"}`}>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] tabular-nums text-gray-400">{x.ma}</span>
                  {x.dangTacO != null && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold">{t("Tắc ở bước")} {x.dangTacO}</span>
                  )}
                  {x.dangTacO == null && x.choNguoi && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-semibold">{t("Chờ anh gật")}</span>
                  )}
                </div>
                <div className="text-sm font-semibold text-gray-900 mt-0.5 leading-snug">{t(x.ten)}</div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600">{x.tong} {t("bước")}</span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600">
                    {x.buoc.filter((b) => b.congDuyet).length} {t("cổng duyệt")}
                  </span>
                  {x.chuaCamSo > 0 && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500">{x.chuaCamSo} {t("bước chưa đo được")}</span>
                  )}
                </div>
                <div className="mt-2 h-1 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-[11px] text-gray-400 mt-1">{x.soXong}/{x.tong} {t("bước xong trong 48h")}</div>
              </button>
            );
          })}
        </div>

        <div>
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">{t("Luồng đang chạy")}</span>
            <span className="text-[11px] tabular-nums text-gray-400">{l.ma} · {t(l.moTa)}</span>
          </div>
          <ol className="divide-y divide-gray-50">
            {l.buocLive.map((b) => {
  const { t: t } = useLang();
              const s = B[b.trangThai];
              return (
                <li key={b.stt} className="px-4 py-3 flex gap-3">
                  <span className="w-6 h-6 shrink-0 rounded-full border border-gray-200 flex items-center justify-center text-[11px] font-semibold text-gray-500 tabular-nums">
                    {b.stt}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] text-gray-500 flex items-center gap-1 flex-wrap">
                      <span className="font-medium text-gray-600">{t(b.tu)}</span>
                      <ArrowRight className="w-3 h-3 text-gray-300" />
                      <span className="font-medium text-gray-600">{t(b.den)}</span>
                    </div>
                    <div className="text-sm text-gray-900 mt-0.5 leading-snug">{t(b.ten)}</div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold"
                        style={{ backgroundColor: s.bg, color: s.fg }}>
                        <s.Icon className="w-3 h-3" />{t(s.l)}
                      </span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />SLA {b.slaGio}h
                      </span>
                      {b.congDuyet && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-200">{t("Cổng duyệt")}</span>
                      )}
                      {b.nguoiLam && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">{t("Người làm")}</span>
                      )}
                      {b.soLuong > 0 && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-gray-900 text-white font-semibold tabular-nums">
                          {b.soLuong} {t(b.donVi || "")}
                        </span>
                      )}
                      {b.luc && <span className="text-[11px] text-gray-400">{gio(b.luc)}</span>}
                    </div>
                    {b.trangThai === "hong" && b.chiTiet && (
                      <div className="text-[11px] text-red-600 mt-1 break-words">{dichSo(t, b.chiTiet)}</div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="px-4 py-2.5 text-[11px] text-gray-400 border-t border-gray-100">
            {t("Bước ghi &quot;chưa cắm sổ&quot; là chỗ mình đang mù — máy chạy nhưng chưa gọi ghiViecMay(), không phải máy chết.")}
          </p>
        </div>
      </div>
    </div>
  );
}
