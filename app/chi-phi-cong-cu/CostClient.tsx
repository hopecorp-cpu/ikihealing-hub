"use client";
import { useMemo, useState } from "react";
import { useLang } from "@/components/lang-provider";
import { fmtVND } from "@/lib/payroll";
import type { Cost } from "@/lib/platform-costs";
import { saveCostsAction } from "./actions";

type Sum = { total: number; known: number; unknown: number; unknownNames: string[]; byCat: Record<string, number> };

const CATS: Cost["category"][] = ["AI", "Hạ tầng", "Quảng cáo", "Vận hành", "Khác"];
const DOT: Record<string, string> = {
  "AI": "#6366F1", "Hạ tầng": "#0EA5E9", "Quảng cáo": "#F59E0B", "Vận hành": "#10B981", "Khác": "#6B7280",
};

export default function CostClient({ items, sum, canEdit }: { items: Cost[]; sum: Sum; canEdit: boolean }) {
  const { t } = useLang();
  const [edits, setEdits] = useState<Record<string, string>>(
    Object.fromEntries(items.map((c) => [c.id, c.monthlyVnd === null ? "" : String(c.monthlyVnd)]))
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const live = useMemo(() => {
    let total = 0, unknown = 0;
    const byCat: Record<string, number> = {};
    for (const c of items) {
      const raw = (edits[c.id] ?? "").trim();
      if (raw === "") { unknown++; continue; }
      const n = Number(raw.replace(/[^\d.-]/g, "")) || 0;
      total += n;
      byCat[c.category] = (byCat[c.category] || 0) + n;
    }
    return { total, unknown, byCat };
  }, [edits, items]);

  async function save() {
    setBusy(true); setMsg("");
    const r = await saveCostsAction(edits);
    setMsg(r.ok ? t("Đã lưu") : t("Lỗi: ") + (r.error || ""));
    setBusy(false);
    setTimeout(() => setMsg(""), 2500);
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wide font-medium">{t("Tổng mỗi tháng")}</div>
            <div className="text-3xl font-bold mt-1 sensitive">{fmtVND(live.total)}</div>
            <div className="text-xs text-gray-400 mt-1">
              {t("Một năm khoảng")} <span className="sensitive">{fmtVND(live.total * 12)}</span>
            </div>
          </div>
          {live.unknown > 0 && (
            <div className="text-xs px-3 py-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 max-w-sm">
              <b>{live.unknown} {t("mục chưa có số")}</b> — {t("nên số tổng trên đang THẤP HƠN thực tế. Ô trống nghĩa là chưa biết, không phải bằng 0.")}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-gray-100">
          {CATS.filter((c) => live.byCat[c]).map((c) => (
            <div key={c} className="flex items-center gap-1.5 text-xs">
              <span className="w-2 h-2 rounded-full" style={{ background: DOT[c] }} />
              <span className="text-gray-500">{t(c)}</span>
              <b className="sensitive">{fmtVND(live.byCat[c])}</b>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100 text-xs">
                <th className="py-2.5 px-4 font-medium">{t("Công cụ")}</th>
                <th className="py-2.5 px-4 font-medium">{t("Dùng để làm gì")}</th>
                <th className="py-2.5 px-4 font-medium text-right whitespace-nowrap">{t("Mỗi tháng (đ)")}</th>
              </tr>
            </thead>
            <tbody>
              {CATS.map((cat) => {
  const { t: t } = useLang();
                const rows = items.filter((c) => c.category === cat);
                if (!rows.length) return null;
                return (
                  <>
                    <tr key={t(cat)} className="bg-gray-50/60">
                      <td colSpan={3} className="py-1.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle" style={{ background: DOT[cat] }} />
                        {t(cat)}
                      </td>
                    </tr>
                    {rows.map((c) => (
                      <tr key={c.id} className="border-b border-gray-50 last:border-0">
                        <td className="py-2.5 px-4">
                          <div className="font-medium">{c.name}</div>
                          {t(c.note) && <div className="text-xs text-gray-400 mt-0.5">{t(c.note)}</div>}
                        </td>
                        <td className="py-2.5 px-4 text-xs text-gray-500 max-w-[280px]">{c.what}</td>
                        <td className="py-2.5 px-4 text-right">
                          {c.auto ? (
                            <span className="sensitive font-medium">{c.monthlyVnd === null ? "—" : fmtVND(c.monthlyVnd)}</span>
                          ) : (
                            <input
                              inputMode="numeric"
                              disabled={!canEdit}
                              value={edits[c.id] ?? ""}
                              onChange={(e) => setEdits({ ...edits, [c.id]: e.target.value })}
                              placeholder={t("chưa biết")}
                              className="w-32 p-1.5 border border-gray-200 rounded-lg text-sm text-right sensitive focus:border-gray-900 focus:outline-none disabled:bg-gray-50"
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {canEdit && (
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={busy} className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            {busy ? t("Đang lưu…") : t("Lưu")}
          </button>
          {msg && <span className="text-sm text-gray-500">{msg}</span>}
        </div>
      )}

      <p className="text-xs text-gray-400">
        {t("Quảng cáo Facebook là số THẬT hệ thống tự lấy. Các mục còn lại nhà cung cấp không cho đọc hoá đơn qua API nếu không có khoá quản trị riêng — nên cần điền tay. Muốn mục nào tự động, báo em.")}
      </p>
    </div>
  );
}
