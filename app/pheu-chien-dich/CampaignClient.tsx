"use client";
import { useState, useTransition } from "react";
import { saveCampaign, deleteCampaign } from "./actions";
import { fmtVND } from "@/lib/payroll";
import { useLang } from "@/components/lang-provider";

const CHANNELS = ["Zalo", "Facebook", "Website", "Shopee", "TikTok", "Tất cả"];
const empty = { id: "", name: "", channel: "Facebook", start: "", end: "", budget: "", goalRevenue: "", goalLeads: "", note: "" };

export default function CampaignClient({ campaigns }: { campaigns: any[] }) {
  const { t } = useLang();
  const [form, setForm] = useState<any>(empty);
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () => start(async () => { const r = await saveCampaign({ ...form, budget: Number(form.budget) || 0, goalRevenue: Number(form.goalRevenue) || 0, goalLeads: Number(form.goalLeads) || 0 }); if (r.ok) { setMsg(t("Đã lưu (tải lại trang)")); setForm(empty); setShow(false); } else setMsg("" + r.error); });
  const edit = (c: any) => { setForm({ ...c, budget: String(c.budget || ""), goalRevenue: String(c.goalRevenue || ""), goalLeads: String(c.goalLeads || "") }); setShow(true); };
  const del = (id: string) => start(async () => { await deleteCampaign(id); });

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="font-bold">{t("Chiến dịch MKT — chi vs đơn vs ROAS")}</div>
        <button onClick={() => { setForm(empty); setShow(!show); }} className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-sm">{show ? t("Đóng") : t("+ Thêm chiến dịch")}</button>
      </div>

      {show && (
        <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
          <div className="col-span-2 sm:col-span-1"><label className="text-xs text-gray-600">{t("Tên chiến dịch")}</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full p-2 border border-gray-200 rounded" placeholder={t("VD: FB Ads Detox T6")} /></div>
          <div><label className="text-xs text-gray-600">{t("Kênh")}</label><select value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })} className="w-full p-2 border border-gray-200 rounded">{CHANNELS.map(c => <option key={t(c)} value={t(c)}>{t(c)}</option>)}</select></div>
          <div><label className="text-xs text-gray-600">{t("Ngân sách (đ)")}</label><input type="number" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} className="w-full p-2 border border-gray-200 rounded text-right" /></div>
          <div><label className="text-xs text-gray-600">{t("Từ ngày")}</label><input type="date" value={form.start} onChange={e => setForm({ ...form, start: e.target.value })} className="w-full p-2 border border-gray-200 rounded" /></div>
          <div><label className="text-xs text-gray-600">{t("Đến ngày")}</label><input type="date" value={form.end} onChange={e => setForm({ ...form, end: e.target.value })} className="w-full p-2 border border-gray-200 rounded" /></div>
          <div><label className="text-xs text-gray-600">{t("Mục tiêu DT (đ)")}</label><input type="number" value={form.goalRevenue} onChange={e => setForm({ ...form, goalRevenue: e.target.value })} className="w-full p-2 border border-gray-200 rounded text-right" /></div>
          <div className="col-span-2 sm:col-span-3 flex items-center gap-2"><button onClick={save} disabled={pending} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50">{t("Lưu")}</button>{msg && <span className="text-xs">{msg}</span>}</div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase"><tr><th className="text-left p-2">{t("Chiến dịch")}</th><th className="text-left p-2">{t("Kênh")}</th><th className="text-left p-2">{t("Thời gian")}</th><th className="text-right p-2">{t("Chi")}</th><th className="text-right p-2">{t("DT thực tế (ước tính)")}</th><th className="text-right p-2">ROAS*</th><th className="text-right p-2">{t("% mục tiêu")}</th><th></th></tr></thead>
          <tbody>
            {campaigns.map((c, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="p-2 font-medium">{c.name}</td>
                <td className="p-2 text-xs">{c.channel}</td>
                <td className="p-2 text-xs text-gray-500">{c.start?.slice(5)}→{c.end?.slice(5)}</td>
                <td className="p-2 text-right">{fmtVND(Number(c.budget) || 0)}</td>
                <td className="p-2 text-right font-semibold">{fmtVND(c.actualRev)}</td>
                <td className={`p-2 text-right font-bold ${c.roas == null ? "text-gray-400" : c.roas >= 3 ? "text-emerald-600" : c.roas >= 1 ? "text-amber-600" : "text-red-600"}`}>{c.roas == null ? "—" : c.roas + "x"}</td>
                <td className="p-2 text-right">{c.goalPct == null ? "—" : <span className={c.goalPct >= 100 ? "text-emerald-600 font-semibold" : "text-amber-600"}>{c.goalPct}%</span>}</td>
                <td className="p-2 text-right whitespace-nowrap"><button onClick={() => edit(c)} className="text-xs text-blue-600 hover:underline mr-2">{t("Sửa")}</button><button onClick={() => del(c.id)} className="text-xs text-red-500 hover:underline">{t("Xoá")}</button></td>
              </tr>
            ))}
            {!campaigns.length && <tr><td colSpan={8} className="p-6 text-center text-gray-400">{t("Chưa có chiến dịch. Bấm \"+ Thêm chiến dịch\" để team MKT nhập kế hoạch.")}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">{t("ROAS = DT thực tế / chi. DT thực tế = đơn trong sổ đơn trên cùng kênh trong khoảng ngày chiến dịch (ước tính theo kênh+ngày; chính xác hơn khi gắn mã nguồn/UTM sau). ROAS ≥3x = tốt; <1x = lỗ.")}</p>
    </div>
  );
}
