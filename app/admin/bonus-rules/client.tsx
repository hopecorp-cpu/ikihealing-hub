"use client";
import { useState, useTransition } from "react";
import { upsertBonusRule, deleteBonusRule } from "../../bang-luong/run/actions";
import { fmtVND } from "@/lib/payroll";
import { Settings, Plus, Trash2, Save, Calculator } from "lucide-react";
import { useLang } from "@/components/lang-provider";

export function BonusRulesClient({ rules: initial }: { rules: any[] }) {
  const { t } = useLang();
  const [rules, setRules] = useState(initial);
  const [editing, setEditing] = useState<any | null>(null);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");

  const newRule = () => setEditing({
    name: "", scope: "individual", product_category: "san_pham_a",
    revenue_min: 0, revenue_max: null, bonus_rate: 0.1,
    applies_to_contract: ["Chính thức"],
    contract_modifier: { "Thử việc": 0.85 },
    priority: 10, active: true
  });

  const save = (rule: any) => {
    startTransition(async () => {
      const res = await upsertBonusRule(rule);
      if (res.success) {
        setMsg(t("Đã lưu"));
        setEditing(null);
        location.reload();
      } else setMsg("" + res.error);
    });
  };

  const remove = (id: string) => {
    if (!confirm(t("Vô hiệu hoá bậc này? (data lương cũ vẫn giữ nguyên)"))) return;
    startTransition(async () => {
      await deleteBonusRule(id);
      setRules(rules.filter(r => r.id !== id));
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6 text-brand-600" /> {t("Cấu hình bậc thưởng")}
        </h1>
        <div className="flex gap-2">
          <a href="/bang-luong/run" className="px-3 py-1.5 bg-brand-100 text-brand-700 rounded text-sm font-semibold inline-flex items-center gap-1">
            <Calculator className="w-3 h-3" /> {t("Tính lương tháng")}
          </a>
          <button onClick={newRule} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-semibold inline-flex items-center gap-1">
            <Plus className="w-4 h-4" /> {t("Bậc mới")}
          </button>
        </div>
      </div>

      <SaleTierCards />
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
        {t("Hoa hồng tính LUỸ TIẾN trên doanh số NET (đã trừ VAT 8% + phí ship). NV thử việc vẫn nhận hoa hồng đầy đủ (0.85 chỉ áp lương cứng).")}
        {" "}<b>{t("Chi tiết + tính tiền từng tháng: xem trang 'Hoa hồng Sale (KPI)'.")}</b>
        <span className="block mt-1 text-blue-600">{t("Bảng bên dưới chỉ để hiển thị nhãn bậc tham chiếu — tiền hoa hồng do hệ thống tính theo công thức trên.")}</span>
      </div>

      {msg && <div className="p-3 rounded bg-gray-50 text-sm">{msg}</div>}

      {editing && (
        <div className="bg-white border-2 border-yellow-300 rounded-xl p-5 ring-2 ring-yellow-100">
          <h3 className="font-bold mb-3">{editing.id ? t("Sửa bậc") : t("Tạo bậc mới")}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label={t("Tên bậc *")} value={editing.name} onChange={v => setEditing({...editing, name: v})} />
            <Select label={t("Scope")} value={editing.scope} onChange={v => setEditing({...editing, scope: v})}>
              <option value="individual">{t("Individual (cá nhân Sale)")}</option>
              <option value="team_lead">{t("Team Lead (Leader bonus)")}</option>
              <option value="group">{t("Group (pool toàn team)")}</option>
            </Select>
            <Select label={t("Product category")} value={editing.product_category ?? ""} onChange={v => setEditing({...editing, product_category: v || null})}>
              <option value="">{t("— Tất cả —")}</option>
              <option value="san_pham_a">Đạm Mẫu</option>
              <option value="nova">NOVA</option>
              <option value="course_ndv">{t("Khoá học mẫu")}</option>
            </Select>
            <Field label={t("Priority (cao thắng khi trùng)")} type="number" value={editing.priority} onChange={v => setEditing({...editing, priority: +v})} />

            <Field label={t("DT từ (VND)")} type="number" step={1000000} value={editing.revenue_min} onChange={v => setEditing({...editing, revenue_min: +v})} />
            <Field label={t("DT đến (VND, để trống = vô cực)")} type="number" step={1000000} value={editing.revenue_max ?? ""} onChange={v => setEditing({...editing, revenue_max: v ? +v : null})} />

            <Field label={t("% Thưởng (VD 0.1 = 10%)")} type="number" step={0.001} value={editing.bonus_rate} onChange={v => setEditing({...editing, bonus_rate: +v})} />
            <Field label={t("Thưởng cố định (VND, cộng thêm)")} type="number" step={100000} value={editing.fixed_bonus ?? 0} onChange={v => setEditing({...editing, fixed_bonus: +v})} />

            <div className="md:col-span-2">
              <label className="text-sm font-medium">{t("Áp dụng cho loại HĐ")}</label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {[t("Chính thức"),t("Thử việc"),t("HĐ CTV")].map(c => (
                  <label key={c} className="flex items-center gap-1 text-sm">
                    <input type="checkbox" checked={editing.applies_to_contract?.includes(c) ?? false}
                      onChange={e => {
                        const arr = editing.applies_to_contract || [];
                        setEditing({...editing, applies_to_contract: e.target.checked ? [...arr, c] : arr.filter((x: string) => x !== c)});
                      }} />
                    {t(c)}
                  </label>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium">{t("Contract modifier (JSON: hợp đồng → hệ số)")}</label>
              <input value={JSON.stringify(editing.contract_modifier || {})}
                onChange={e => { try { setEditing({...editing, contract_modifier: JSON.parse(e.target.value)}); } catch {} }}
                placeholder={t("{\"Thử việc\": 0.85}")}
                className="mt-1 w-full p-2 border border-gray-200 rounded text-sm font-mono" />
            </div>

            <Field label={t("Notes")} value={editing.notes ?? ""} onChange={v => setEditing({...editing, notes: v})} />
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
            <button onClick={() => setEditing(null)} className="px-3 py-1.5 border rounded text-sm">{t("Huỷ")}</button>
            <button onClick={() => save(editing)} disabled={pending} className="px-4 py-1.5 bg-emerald-600 text-white rounded text-sm font-semibold inline-flex items-center gap-1">
              <Save className="w-3 h-3" /> {t("Lưu")}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="text-left p-2">{t("Tên bậc")}</th>
              <th className="text-left p-2">{t("Scope")}</th>
              <th className="text-right p-2">{t("DT từ")}</th>
              <th className="text-right p-2">{t("Đến")}</th>
              <th className="text-right p-2">{t("% Thưởng")}</th>
              <th className="text-left p-2">{t("Áp dụng")}</th>
              <th className="text-right p-2">{t("Priority")}</th>
              <th className="text-right p-2 w-32">{t("Hành động")}</th>
            </tr>
          </thead>
          <tbody>
            {rules.filter(r => r.active).map(r => (
              <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="p-2">
                  <div className="font-medium">{r.name}</div>
                  {r.notes && <div className="text-xs text-gray-500">{r.notes}</div>}
                </td>
                <td className="p-2 text-xs">
                  <span className={`px-2 py-0.5 rounded ${r.scope === "individual" ? "bg-blue-100 text-blue-700" : r.scope === "group" ? "bg-emerald-100 text-emerald-700" : "bg-purple-100 text-purple-700"}`}>
                    {r.scope}
                  </span>
                </td>
                <td className="p-2 text-right tabular-nums">{fmtVND(r.revenue_min)}</td>
                <td className="p-2 text-right tabular-nums">{r.revenue_max ? fmtVND(r.revenue_max) : "∞"}</td>
                <td className="p-2 text-right font-bold text-brand-700">{(r.bonus_rate * 100).toFixed(1)}%</td>
                <td className="p-2 text-xs">{(r.applies_to_contract || []).map((c: string) => t(c)).join(", ")}</td>
                <td className="p-2 text-right">{r.priority}</td>
                <td className="p-2 text-right">
                  <button onClick={() => setEditing(r)} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded">{t("Sửa")}</button>
                  <button onClick={() => remove(r.id)} className="text-xs px-2 py-1 bg-red-50 text-red-700 rounded ml-1"><Trash2 className="w-3 h-3 inline" /></button>
                </td>
              </tr>
            ))}
            {rules.filter(r => r.active).length === 0 && (
              <tr><td colSpan={8} className="p-8 text-center text-gray-400">{t("Chưa có bậc nào — bấm \"+ Bậc mới\" để tạo")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", step }: any) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input type={type} value={value ?? ""} onChange={e => onChange(e.target.value)} step={step}
        className="mt-1 w-full p-2 border border-gray-200 rounded text-sm" />
    </div>
  );
}

function Select({ label, value, onChange, children }: any) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="mt-1 w-full p-2 border border-gray-200 rounded text-sm">{children}</select>
    </div>
  );
}

function SaleTierCards() {
  const { t } = useLang();
  const f = (n: number) => n.toLocaleString("vi-VN") + "đ";
  const SALES = [
    { name: "Sale mẫu A", role: "Leader Sale", salary: 10_000_000, stype: "NET", kpi: 200_000_000, leader: true, color: "#1D4ED8" },
    { name: "Sale mẫu B", role: "Sale NV", salary: 8_000_000, stype: "NET", kpi: 100_000_000, leader: false, color: "#059669" },
  ];
  const rows = (T: number) => [
    [`< ${f(T * 0.5)}`, "< 50% KPI", "0%"],
    [`${f(T * 0.5)} – ${f(T * 0.8)}`, "50–80%", "5%"],
    [`${f(T * 0.8)} – ${f(T)}`, "80–100%", "8%"],
    [`${f(T)} – ${f(T * 2)}`, "100–200%", "10% mốc + 15% vượt"],
    [`> ${f(T * 2)}`, "> 200%", "+ 20% phần vượt"],
  ];
  return (
    <div>
      <div className="text-sm font-semibold text-gray-700 mb-2">{t("Bậc thưởng theo từng Sale")} <span className="font-normal text-gray-400">({t("dữ liệu mẫu")})</span></div>
      <div className="grid md:grid-cols-3 gap-3">
        {SALES.map(s => (
          <div key={s.name} className="bg-white border rounded-xl overflow-hidden" style={{ borderColor: s.color + "55" }}>
            <div className="px-3 py-2 text-white font-bold text-sm" style={{ background: s.color }}>{s.name}</div>
            <div className="p-3 space-y-1.5">
              <div className="text-[11px] text-gray-500">{s.role} · {t("lương")} <b>{f(s.salary)}</b> {s.stype}</div>
              <div className="text-[12px]">{t("Mốc KPI 100%")} = <b style={{ color: s.color }}>{f(s.kpi)}</b>/{t("tháng")}</div>
              <table className="w-full text-[11px] mt-1">
                <tbody>{rows(s.kpi).map((r, i) => (
                  <tr key={i} className="border-t border-gray-50">
                    <td className="py-1 pr-1 text-gray-600">{r[0]}<span className="text-gray-300"> ({r[1]})</span></td>
                    <td className="py-1 font-medium text-right whitespace-nowrap" style={{ color: s.color }}>{r[2]}</td>
                  </tr>
                ))}</tbody>
              </table>
              {s.leader && <div className="text-[10px] text-amber-700 bg-amber-50 rounded px-2 py-1 mt-1">+ {t("Thưởng Leader (mẫu): đội vượt mốc → +10% phần vượt")}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
