"use client";
import { useLang } from "@/components/lang-provider";

import { useState, useTransition } from "react";
import { Bot, Check, X, AlertTriangle, CircleDashed, ExternalLink } from "lucide-react";
import { duyetViecMayAction } from "./actions";

type Viec = {
  id: number; agent: string; agent_ten: string | null; viec: string;
  trang_thai: "xong" | "khong_co_gi" | "hong";
  so_luong: number; don_vi: string | null; chi_tiet: string | null; link: string | null;
  giay: number | null; can_duyet: boolean; duyet_luc: string | null; duyet_ok: boolean | null;
  created_at: string;
};
type TomTat = {
  theoAgent: { agent: string; agentTen: string; luot: number; sanPham: number; donVi: string | null; hong: number; khongCoGi: number; lanCuoi: string }[];
};

const CHIP: Record<Viec["trang_thai"], { l: string; bg: string; fg: string; Icon: any }> = {
  xong:        { l: "Xong",        bg: "#DCFCE7", fg: "#15803D", Icon: Check },
  khong_co_gi: { l: "Không ra gì", bg: "#FEF3C7", fg: "#B45309", Icon: CircleDashed },
  hong:        { l: "Hỏng",        bg: "#FEE2E2", fg: "#B91C1C", Icon: AlertTriangle },
};

function gio(s: string) {
  const d = new Date(s);
  return d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
}

export default function MayBoard({ runs, tomTat, canDuyet }: { runs: Viec[]; tomTat: TomTat; canDuyet: boolean }) {
  const { t: t } = useLang();
  const [items, setItems] = useState(runs);
  const [pending, start] = useTransition();
  const [loi, setLoi] = useState<string | null>(null);

  function duyet(id: number, ok: boolean) {
    start(async () => {
      const r = await duyetViecMayAction(id, ok);
      if (!r.success) { setLoi(r.error || "Không duyệt được"); return; }
      setLoi(null);
      setItems(prev => prev.map(x => x.id === id ? { ...x, duyet_luc: new Date().toISOString(), duyet_ok: ok } : x));
    });
  }

  if (items.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
        <Bot className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <div className="text-sm font-semibold text-gray-700">{t("Sổ việc của máy đang trống")}</div>
        <p className="text-sm text-gray-500 mt-1.5 max-w-lg mx-auto">
          {t("Bảng")} <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">agent_runs</code> {t("đã có nhưng chưa cron nào ghi vào.\n          Cắm")} <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">ghiViecMay()</code> {t("vào cuối mỗi cron thì việc của máy hiện ở đây.")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {loi && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">{loi}</div>}

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
          {t("Từng máy — 24 giờ qua")}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="text-left font-semibold px-4 py-2.5">{t("Máy")}</th>
                <th className="text-right font-semibold px-4 py-2.5">{t("Lượt chạy")}</th>
                <th className="text-right font-semibold px-4 py-2.5">{t("Sản phẩm")}</th>
                <th className="text-right font-semibold px-4 py-2.5">{t("Không ra gì")}</th>
                <th className="text-right font-semibold px-4 py-2.5">{t("Hỏng")}</th>
                <th className="text-right font-semibold px-4 py-2.5">{t("Lần cuối")}</th>
              </tr>
            </thead>
            <tbody>
              {tomTat.theoAgent.map(a => (
                <tr key={a.agent} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-gray-900">{a.agentTen}</div>
                    <div className="text-xs text-gray-400">{a.agent}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{a.luot}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-900">
                    {a.sanPham}{a.donVi ? <span className="text-gray-400 font-normal text-xs"> {a.donVi}</span> : null}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: a.khongCoGi ? "#B45309" : "#9CA3AF" }}>{a.khongCoGi}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold" style={{ color: a.hong ? "#B91C1C" : "#9CA3AF" }}>{a.hong}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-gray-500 whitespace-nowrap">{gio(a.lanCuoi)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
          {t("Từng lượt chạy")}
        </div>
        <ul className="divide-y divide-gray-50">
          {items.map(r => {
            const c = CHIP[r.trang_thai];
            const cho = r.can_duyet && !r.duyet_luc;
            return (
              <li key={r.id} className="px-4 py-3 flex items-start gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold shrink-0 mt-0.5"
                  style={{ backgroundColor: c.bg, color: c.fg }}>
                  <c.Icon className="w-3 h-3" />{c.l}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="text-sm text-gray-900">
                    <span className="font-semibold">{r.agent_ten || r.agent}</span>
                    <span className="text-gray-400"> · </span>
                    <span>{r.viec}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>{gio(r.created_at)}</span>
                    {r.so_luong > 0 && <span className="text-gray-700 font-medium">{r.so_luong} {r.don_vi || ""}</span>}
                    {r.giay != null && <span>{r.giay}s</span>}
                    {r.link && (
                      <a href={r.link} className="text-brand-600 hover:underline inline-flex items-center gap-0.5">
                        Xem <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {r.duyet_luc && (
                      <span className="font-medium" style={{ color: r.duyet_ok ? "#15803D" : "#B91C1C" }}>
                        {r.duyet_ok ? t("Đã duyệt") : t("Đã bỏ")}
                      </span>
                    )}
                  </div>
                  {r.chi_tiet && <div className="text-xs text-gray-500 mt-1 break-words">{r.chi_tiet}</div>}
                </div>

                {cho && canDuyet && (
                  <div className="flex gap-1.5 shrink-0">
                    <button disabled={pending} onClick={() => duyet(r.id, true)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 inline-flex items-center gap-1">
                      <Check className="w-3 h-3" />{t("Duyệt")}
                    </button>
                    <button disabled={pending} onClick={() => duyet(r.id, false)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 disabled:opacity-50 inline-flex items-center gap-1">
                      <X className="w-3 h-3" />{t("Bỏ")}
                    </button>
                  </div>
                )}
                {cho && !canDuyet && <span className="text-xs text-violet-600 font-semibold shrink-0 mt-0.5">{t("Chờ duyệt")}</span>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
