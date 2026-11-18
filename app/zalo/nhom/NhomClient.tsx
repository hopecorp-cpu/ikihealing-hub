"use client";

import { useLang } from "@/components/lang-provider";
import { useState } from "react";
import Link from "next/link";
import { Bot, Lock, LockOpen, MessageSquare, UsersRound } from "lucide-react";
import { doTre, gioTu } from "@/lib/hop-thu-zalo";
import type { CaiDatNhom } from "@/lib/zalo-nhom-cai-dat";

type Nhom = {
  ownId: string; uid: string; ten: string; sale?: string | null;
  soThanhVien?: number | null; soTin: number; tinCuoiAt?: string | null;
};

function CongTac({ bat, dangChay, tat, nhan, onBam }: {
  bat: boolean; dangChay: boolean; tat: boolean; nhan: string; onBam: () => void;
}) {
  const { t: t } = useLang();
  return (
    <button
      type="button"
      onClick={onBam}
      disabled={dangChay || tat}
      aria-label={nhan}
      title={tat ? t("Chỉ quản lý đổi được") : nhan}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
        bat ? "bg-emerald-500" : "bg-slate-300"
      } ${dangChay || tat ? "cursor-not-allowed opacity-50" : "hover:opacity-90"}`}
    >
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition ${bat ? "translate-x-5" : "translate-x-1"}`} />
    </button>
  );
}

export default function NhomClient({ ds, caiDatDau, laQuanLy }: {
  ds: Nhom[]; caiDatDau: Record<string, CaiDatNhom>; laQuanLy: boolean;
}) {
  const { t: t } = useLang();
  const [caiDat, setCaiDat] = useState(caiDatDau);
  const [dangChay, setDangChay] = useState<string | null>(null);
  const [loi, setLoi] = useState<string | null>(null);

  async function doi(ma: string, than: Record<string, unknown>, ten: string) {
    setDangChay(ma + JSON.stringify(Object.keys(than)));
    setLoi(null);
    try {
      const r = await fetch("/api/zalo/nhom-cai-dat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ma, ten, ...than }),
      });
      const kq = await r.json();
      if (!r.ok) throw new Error(kq?.loi || `HTTP ${r.status}`);
      setCaiDat((cu) => ({ ...cu, [ma]: kq.caiDat }));
    } catch (e: any) {
      setLoi(e?.message || "Đổi không được");
    } finally {
      setDangChay(null);
    }
  }

  return (
    <>
      {loi && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {t("Không đổi được:")} {loi}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
              <th className="px-4 py-2.5 font-medium">{t("Nhóm")}</th>
              <th className="px-4 py-2.5 font-medium">{t("Thành viên")}</th>
              <th className="px-4 py-2.5 font-medium">{t("Nick trong nhóm")}</th>
              <th className="px-4 py-2.5 font-medium">{t("Tin đã lưu")}</th>
              <th className="px-4 py-2.5 font-medium">{t("Hoạt động cuối")}</th>
              <th className="px-4 py-2.5 font-medium">{t("Cho nhắn")}</th>
              <th className="px-4 py-2.5 font-medium">{t("Máy trả lời")}</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {ds.map((n) => {
  const { t: t } = useLang();
              const ma = `${n.ownId}|${n.uid}`;
              const cd = caiDat[ma] || { chatbot: false, khoaGui: false, khoaGuiCho: null };
              const im = gioTu(n.tinCuoiAt);
              const choMay = cd.khoaGuiCho != null && cd.khoaGuiCho !== cd.khoaGui;
              return (
                <tr key={ma} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                        <UsersRound className="h-3.5 w-3.5" />
                      </span>
                      <span className="max-w-[20rem] truncate font-medium text-slate-900">{t(n.ten)}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">
                    {n.soThanhVien != null ? n.soThanhVien.toLocaleString("vi-VN") : <span className="text-slate-300">{t("chưa đo")}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{n.sale || "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{n.soTin}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">
                    {im == null ? "—" : im > 30 * 24
                      ? <span className="text-amber-700">im {doTre(im)}</span>
                      : `${doTre(im)} trước`}
                  </td>

                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2">
                      <CongTac
                        bat={!cd.khoaGui}
                        tat={!laQuanLy}
                        dangChay={dangChay === ma + JSON.stringify(["khoaGui"])}
                        nhan={cd.khoaGui ? t("Mở cho thành viên nhắn lại") : t("Khoá, chỉ trưởng nhóm được nhắn")}
                        onBam={() => doi(ma, { khoaGui: !cd.khoaGui }, t(n.ten))}
                      />
                      {choMay ? (
                        <span className="text-[11px] text-amber-700">{t("đang chờ máy…")}</span>
                      ) : cd.khoaGuiLoi ? (
                        <span className="text-[11px] text-rose-600" title={cd.khoaGuiLoi}>{t("hỏng")}</span>
                      ) : cd.khoaGui ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500"><Lock className="h-3 w-3" /> {t("đã khoá")}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><LockOpen className="h-3 w-3" /> {t("mở")}</span>
                      )}
                    </span>
                  </td>

                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2">
                      <CongTac
                        bat={!!cd.chatbot}
                        tat={false}
                        dangChay={dangChay === ma + JSON.stringify(["chatbot"])}
                        nhan={cd.chatbot ? t("Tắt máy trả lời trong nhóm này") : t("Bật máy trả lời khi có người nhắc tên")}
                        onBam={() => doi(ma, { chatbot: !cd.chatbot }, t(n.ten))}
                      />
                      {cd.chatbot && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700"><Bot className="h-3 w-3" /> {t("khi bị nhắc tên")}</span>
                      )}
                    </span>
                  </td>

                  <td className="px-4 py-2.5 text-right">
                    <Link
                      href={`/zalo/tin-nhan?hoi-thoai=${encodeURIComponent(ma)}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <MessageSquare className="h-3 w-3" /> {t("Mở nhóm")}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
