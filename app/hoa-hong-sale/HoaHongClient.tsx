"use client";
import { useState } from "react";
import { useLang } from "@/components/lang-provider";

type Row = {
  name: string; position: string; salary: number; contract: string; kpi: number;
  grossVAT: number; dsNetVAT: number; ship: number;
  orderCount: number; excludedCount: number; reassignedIn: number;
  locked: { amount: number; explanation: string } | null;
};
const f = (n: number) => Math.round(n || 0).toLocaleString("vi-VN");

function commLines(ds: number, t: number): { lines: string[]; total: number } {
  if (ds < t) return { lines: [`Chưa đạt KPI (${f(t)}đ) → hoa hồng 0đ`], total: 0 };
  if (ds < t * 2) {
    const a1 = Math.round(t * 0.10), a2 = Math.round((ds - t) * 0.15);
    return { lines: [`Mốc KPI: ${f(t)} × 10% = ${f(a1)}đ`, `Phần vượt: (${f(ds)} − ${f(t)}) × 15% = ${f(a2)}đ`], total: a1 + a2 };
  }
  const a1 = Math.round(t * 0.10), a2 = Math.round(t * 0.15), a3 = Math.round((ds - t * 2) * 0.20);
  return { lines: [`Mốc KPI: ${f(t)} × 10% = ${f(a1)}đ`, `Mốc→2×mốc: ${f(t)} × 15% = ${f(a2)}đ`, `Vượt 2×mốc: (${f(ds)} − ${f(t * 2)}) × 20% = ${f(a3)}đ`], total: a1 + a2 + a3 };
}

function comm(ds: number, t: number): number {
  if (ds < t) return 0;
  if (ds < t * 2) return Math.round(t * 0.10 + (ds - t) * 0.15);
  return Math.round(t * 0.10 + t * 0.15 + (ds - t * 2) * 0.20);
}
function tierLabel(ds: number, t: number): string {
  if (ds < t) return "0% (chưa đạt KPI)";
  if (ds < t * 2) return "10% + 15%";
  return "10% + 15% + 20%";
}

export default function HoaHongClient({ rows: initRows, month }: { rows: Row[]; month: string }) {
  const { t: tDich } = useLang();
  const { t } = useLang();
  const [rows, setRows] = useState<Row[]>(initRows);
  const [saving, setSaving] = useState("");

  async function saveShip(name: string, ship: number) {
    setSaving(name);
    try { await fetch("/api/hoa-hong-sale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month, saleName: name, ship }) }); } catch { }
    setSaving("");
  }
  const setShip = (name: string, v: number) => setRows(rs => rs.map(r => r.name === name ? { ...r, ship: v } : r));

  const totalHH = rows.reduce((s, r) => s + comm(Math.max(0, r.dsNetVAT - r.ship), r.kpi), 0);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 font-bold text-sm">{t("Bậc thang hoa hồng (trên doanh số net/tháng)")}</div>
        <table className="w-full text-[13px]">
          <thead><tr className="text-left text-gray-400 text-[10px] uppercase"><th className="px-4 py-1.5">{t("Mức đạt KPI")}</th><th className="px-4 py-1.5">{t("Hoa hồng")}</th></tr></thead>
          <tbody>
            {[["< 100%", t("0 — chưa có hoa hồng")], ["100 – 200%", "10% × " + t("mốc KPI") + " + 15% × " + t("phần vượt")], ["> 200%", tDich("10%×mốc + 15%×mốc + 20% × ") + t("phần vượt 2×mốc")]].map((r, i) => (
              <tr key={i} className="border-t border-gray-50"><td className="px-4 py-1.5 font-medium text-gray-700">{r[0]}</td><td className="px-4 py-1.5 text-violet-700">{r[1]}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2 text-[11px] text-gray-400 border-t border-gray-50">{t("Leader thêm (mẫu): đội Sale vượt mốc → +10% phần vượt (chia trưởng nhóm).")}</div>
      </div>

      <div className="space-y-3">
        {rows.map(r => {
          const base = Math.max(0, r.dsNetVAT - r.ship);
          const kpiPct = Math.round(base / r.kpi * 100);
          const hh = comm(base, r.kpi);
          return (
            <div key={r.name} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <span className="font-bold">{r.name}</span>
                  <span className="text-[11px] text-gray-400 ml-2">{r.position}</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-emerald-700">{f(hh)}đ</div>
                  <div className="text-[11px] text-gray-400">{t("hoa hồng tháng")}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-[13px]">
                <div><div className="text-[10px] text-gray-400">{t("Lương cứng")}</div><div className="font-medium">{f(r.salary)}đ</div></div>
                <div><div className="text-[10px] text-gray-400">{t("Mốc KPI 100%")}</div><div className="font-medium">{f(r.kpi)}đ</div></div>
                <div><div className="text-[10px] text-gray-400">{t("DS net (đã tách VAT)")}</div><div className="font-medium">{f(r.dsNetVAT)}đ</div></div>
                <div>
                  <div className="text-[10px] text-gray-400">{t("Phí ship (kế toán nhập)")}</div>
                  <div className="flex items-center gap-1">
                    <input inputMode="numeric" value={r.ship ? r.ship.toLocaleString("vi-VN") : ""} onFocus={e => e.target.select()}
                      onChange={e => setShip(r.name, +e.target.value.replace(/[^\d]/g, ""))}
                      onBlur={e => saveShip(r.name, +e.target.value.replace(/[^\d]/g, ""))}
                      placeholder="0" className="w-24 p-1 border border-gray-200 rounded text-sm text-right" />
                    {saving === r.name && <span className="text-[10px] text-gray-400">…</span>}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 flex-wrap text-[12px]">
                <span className="text-gray-500">{t("Doanh số tính HH")} = {f(r.dsNetVAT)} − {f(r.ship)} = <b className="text-gray-800">{f(base)}đ</b></span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">{kpiPct}% KPI · {t("bậc")} {tierLabel(base, r.kpi)}</span>
              </div>

              <div className="mt-3 bg-gray-50 border border-gray-100 rounded-lg p-3 text-[12px] text-gray-700 space-y-1">
                <div className="font-semibold text-gray-800 text-[12px]">{t("Diễn giải cách tính")}</div>
                <div><b>B1.</b> {t("Giá khách trả (gồm VAT)")}: <b>{f(r.grossVAT)}đ</b> — {r.orderCount} {t("đơn tính")}
                  {r.excludedCount > 0 && <span className="text-red-500"> · {t("đã loại")} {r.excludedCount} {t("đơn 'không phải của tôi'")}</span>}
                  {r.reassignedIn > 0 && <span className="text-blue-600"> · +{r.reassignedIn} {t("đơn được gán thêm")} (/gan-don)</span>}
                </div>
                <div><b>B2.</b> {t("Tiền thu thực về (MISA đã trừ VAT + giảm giá sẵn)")}: <b>{f(r.dsNetVAT)}đ</b></div>
                <div><b>B3.</b> {t("Trừ phí ship")}: {f(r.dsNetVAT)} − {f(r.ship)} = <b>{f(base)}đ</b> ({t("doanh số tính hoa hồng")})</div>
                <div><b>B4.</b> {t("So KPI")}: {f(base)} ÷ {f(r.kpi)} = <b>{kpiPct}%</b> → {t("bậc")} <b>{tierLabel(base, r.kpi)}</b></div>
                <div><b>B5.</b> {t("Tính tiền")}:
                  <ul className="ml-5 list-disc">
                    {commLines(base, r.kpi).lines.map((l, i) => <li key={i}>{l}</li>)}
                  </ul>
                </div>
                <div className="pt-1 border-t border-gray-200 font-semibold text-emerald-700">→ {t("Hoa hồng")} = {f(hh)}đ</div>
              </div>

              {r.locked && (
                <div className={`mt-2 rounded-lg p-2.5 text-[12px] border ${Math.abs(r.locked.amount - hh) > 1000 ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-emerald-50 border-emerald-200 text-emerald-800"}`}>
                  <b>{t("Đã chốt trong bảng lương")}: {f(r.locked.amount)}đ</b>
                  {r.locked.explanation && <div className="mt-0.5">{r.locked.explanation}</div>}
                  {Math.abs(r.locked.amount - hh) > 1000 && <div className="mt-0.5 text-[11px]">{t("Lệch so với máy tính lại hiện tại")} ({f(hh)}{tDich("đ) —")} {t("thường do tháng cũ chốt theo doanh thu nhập tay (revenue_attribution), còn màn hình này tính theo MISA + gán đơn. Lấy số ĐÃ CHỐT làm chuẩn cho tháng đã trả lương.")}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm font-medium text-emerald-800">
        {t("Tổng hoa hồng tháng")} {month}: <b>{f(totalHH)}đ</b> <span className="text-[11px] font-normal text-emerald-600">({t("chưa gồm thưởng nhóm Leader nếu đội vượt mốc")})</span>
      </div>
      <p className="text-[11px] text-gray-400">{t("Phí ship lấy từ báo cáo MISA 'Doanh thu theo nhân viên' (cột Phí GH trả đối tác). Nhập xong tự lưu. Doanh số đã loại đơn được đánh dấu 'không phải của tôi'.")}</p>
    </div>
  );
}
