"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Target, ChevronDown, ChevronUp, Pencil, Check, X } from "lucide-react";
import { updateAnnualTarget } from "./actions";
import { useLang } from "@/components/lang-provider";

type MonthRow = {
  month: string;
  label: string;
  target: number;
  actual: number;
  kind: "actual" | "current" | "plan";
  note: string;
};

const fmtTr = (n: number) => (n / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 0 }) + " tr";
const fmtTy = (n: number) => (n / 1_000_000_000).toFixed(2) + " tỷ";

export function YearlyTarget({
  rows, annualTarget, ytdActual, canEdit = false,
}: {
  rows: MonthRow[];
  annualTarget: number;
  ytdActual: number;
  canEdit?: boolean;
}) {
  const { t } = useLang();
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [ty, setTy] = useState((annualTarget / 1_000_000_000).toString());
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const annualPct = annualTarget > 0 ? (ytdActual / annualTarget) * 100 : 0;
  const remaining = Math.max(0, annualTarget - ytdActual);

  const save = () => {
    const val = Math.round(parseFloat(ty.replace(",", ".")) * 1_000_000_000);
    if (!Number.isFinite(val) || val <= 0) { setErr(t("Nhập số tỷ hợp lệ")); return; }
    setErr("");
    start(async () => {
      const res = await updateAnnualTarget(val);
      if (res.success) { setEditing(false); router.refresh(); }
      else setErr(res.error || t("Lỗi"));
    });
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setOpen(o => !o)}>
          <Target className="w-5 h-5 text-emerald-600" />
          <h2 className="font-bold">{t("Mục tiêu doanh thu 2026")} — {fmtTy(annualTarget)}</h2>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
        {canEdit && !editing && (
          <button onClick={() => { setTy((annualTarget / 1e9).toString()); setEditing(true); }}
            className="text-xs inline-flex items-center gap-1 px-2 py-1 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
            <Pencil className="w-3 h-3" /> {t("Sửa target")}
          </button>
        )}
        {canEdit && editing && (
          <div className="flex items-center gap-1.5">
            <input autoFocus type="number" step="0.5" value={ty} onChange={e => setTy(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
              className="w-24 px-2 py-1 border border-gray-300 rounded-lg text-sm text-right" />
            <span className="text-sm text-gray-500">{t("tỷ")}</span>
            <button onClick={save} disabled={pending} className="p-1.5 bg-emerald-600 text-white rounded-lg disabled:opacity-50" title={t("Lưu")}><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => { setEditing(false); setErr(""); }} className="p-1.5 border border-gray-200 rounded-lg text-gray-500" title={t("Huỷ")}><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
      </div>
      {err && <div className="text-xs text-red-600 mt-1 text-right">{err}</div>}
      {canEdit && editing && (
        <div className="text-[11px] text-gray-400 mt-1 text-right">{t("Đổi target → T6–T12 tự phân bổ lại theo ramp · T1–T5 giữ nguyên thực tế")}</div>
      )}

      <div className="mt-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-500">{t("Luỹ kế năm")}: <b className="text-gray-900">{fmtTy(ytdActual)}</b> / {fmtTy(annualTarget)}</span>
          <span className="font-semibold" style={{ color: annualPct >= 90 ? "#16A34A" : annualPct >= 60 ? "#F59E0B" : "#6B7280" }}>
            {annualPct.toFixed(1)}% · {t("còn")} {fmtTy(remaining)}
          </span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500" style={{ width: `${Math.min(100, annualPct)}%` }} />
        </div>
      </div>

      {open && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">{t("Tháng")}</th>
                <th className="text-right px-3 py-2">{t("Mục tiêu")}</th>
                <th className="text-right px-3 py-2">{t("Thực tế")}</th>
                <th className="text-right px-3 py-2">%</th>
                <th className="text-center px-3 py-2">{t("Trạng thái")}</th>
                <th className="text-left px-3 py-2">{t("Ghi chú")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(r => {
  const { t: t } = useLang();
                const pct = r.target > 0 ? (r.actual / r.target) * 100 : 0;
                let dot = "", color = "#6B7280", statusText = t("Kế hoạch");
                if (r.kind === "actual") {
                  if (pct >= 100) { dot = ""; color = "#16A34A"; statusText = t("Đạt"); }
                  else if (pct >= 90) { dot = ""; color = "#F59E0B"; statusText = t("Gần đạt"); }
                  else { dot = ""; color = "#DC2626"; statusText = t("Hụt"); }
                } else if (r.kind === "current") {
                  dot = ""; color = "#2563EB"; statusText = t("Đang chạy");
                }
                return (
                  <tr key={r.month} className={r.kind === "current" ? "bg-blue-50/40" : ""}>
                    <td className="px-3 py-2 font-medium">{t(r.label)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{fmtTr(r.target)}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {r.kind === "plan" ? <span className="text-gray-300">—</span> : fmtTr(r.actual)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold" style={{ color: r.kind === "plan" ? "#D1D5DB" : color }}>
                      {r.kind === "plan" ? "—" : pct.toFixed(0) + "%"}
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <span className="text-xs" style={{ color }}>{dot} {statusText}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{t(r.note)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-900 text-white font-bold">
              <tr>
                <td className="px-3 py-2">{t("CẢ NĂM")}</td>
                <td className="px-3 py-2 text-right">{fmtTy(annualTarget)}</td>
                <td className="px-3 py-2 text-right">{fmtTy(ytdActual)}</td>
                <td className="px-3 py-2 text-right">{annualPct.toFixed(0)}%</td>
                <td className="px-3 py-2 text-center" colSpan={2}>{t("Còn")} {fmtTy(remaining)} {t("để đạt mục tiêu")}</td>
              </tr>
            </tfoot>
          </table>
          <p className="text-[11px] text-gray-400 mt-2">
            {t("T1–T5: số thực tế đã chốt · T6–T12: kế hoạch (ramp lên cao điểm Tết). Mục tiêu 9 tỷ = kịch bản đẩy mạnh (~1.9× nhịp hiện tại ở nửa cuối năm).")}
          </p>
        </div>
      )}
    </div>
  );
}
