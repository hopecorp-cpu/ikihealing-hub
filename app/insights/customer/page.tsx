"use client";
import { useEffect, useState, useTransition } from "react";
import { CUSTOMER_GROUPS } from "@/lib/insights";
import { createCustomerInsight, getMyCustomerInsights, updateInsightStatus } from "./actions";
import { Target, Sparkles, Copy, CheckCircle2 } from "lucide-react";
import { useLang } from "@/components/lang-provider";

const STATUS_OPTIONS = [
  { v: "lead", l: "Lead mới", c: "bg-gray-100 text-gray-700" },
  { v: "contacted", l: "Đã liên hệ", c: "bg-blue-100 text-blue-700" },
  { v: "qualified", l: "Tiềm năng", c: "bg-yellow-100 text-yellow-700" },
  { v: "closed_won", l: "Chốt thành công", c: "bg-green-100 text-green-700" },
  { v: "closed_lost", l: "Mất đơn", c: "bg-red-100 text-red-700" }
];

export default function CustomerInsightPage() {
  const { t } = useLang();
  const [list, setList] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showResult, setShowResult] = useState<{ name: string; script: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("Pancake");
  const [product, setProduct] = useState("Đạm Mẫu");
  const [selected, setSelected] = useState<Record<string, string[]>>({
    pain: [], identity: [], perception: [], showoff: [], community: [], speed: []
  });
  const [notes, setNotes] = useState("");
  const [copied, setCopied] = useState(false);

  const load = () => {
    startTransition(async () => {
      const data = await getMyCustomerInsights();
      setList(data);
    });
  };

  useEffect(() => { load(); }, []);

  const toggleKw = (group: string, kw: string) => {
    setSelected(prev => {
      const cur = prev[group] || [];
      return { ...prev, [group]: cur.includes(kw) ? cur.filter(k => k !== kw) : [...cur, kw] };
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createCustomerInsight({
        customer_name: name,
        customer_phone: phone,
        customer_source: source,
        product_interested: product,
        pain_keywords: selected.pain,
        identity_keywords: selected.identity,
        perception_keywords: selected.perception,
        showoff_keywords: selected.showoff,
        community_keywords: selected.community,
        speed_keywords: selected.speed,
        custom_notes: notes
      });
      if (res.success) {
        setShowResult({ name, script: res.script || "" });
        setName(""); setPhone(""); setNotes("");
        setSelected({ pain: [], identity: [], perception: [], showoff: [], community: [], speed: [] });
        setShowForm(false);
        load();
      } else alert(res.error);
    });
  };

  const copyScript = () => {
    if (!showResult) return;
    navigator.clipboard.writeText(showResult.script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">{t("Customer Insight Mapper")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("Map 6 nhóm từ khoá → tự sinh kịch bản chốt đơn cá nhân hoá")}</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-semibold hover:bg-brand-700 flex items-center gap-2">
            <Target className="w-4 h-4" /> {t("Map khách hàng mới")}
          </button>
        )}
      </div>

      {showResult && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowResult(null)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 p-5 flex justify-between items-center">
              <h2 className="font-bold flex items-center gap-2"><Sparkles className="w-5 h-5 text-yellow-500" /> {t("Kịch bản đã tạo cho")} {showResult.name}</h2>
              <div className="flex gap-2">
                <button onClick={copyScript} className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 ${copied ? "bg-green-100 text-green-700" : "bg-gray-900 text-white"}`}>
                  {copied ? <><CheckCircle2 className="w-4 h-4" />Copied</> : <><Copy className="w-4 h-4" />Copy</>}
                </button>
                <button onClick={() => setShowResult(null)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm">{t("Đóng")}</button>
              </div>
            </div>
            <pre className="p-5 whitespace-pre-wrap text-sm leading-relaxed font-mono bg-gray-50 m-5 rounded-lg border border-gray-200">{showResult.script}</pre>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={submit} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-6 space-y-5">
          <h2 className="font-bold text-lg">{t("Bước 1: Thông tin khách")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={name} onChange={e => setName(e.target.value)} required placeholder={t("Tên khách (vd: Chị Lan)")} className="p-2.5 border border-gray-200 rounded-lg text-sm" />
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder={t("SĐT (tuỳ chọn)")} className="p-2.5 border border-gray-200 rounded-lg text-sm" />
            <select value={source} onChange={e => setSource(e.target.value)} className="p-2.5 border border-gray-200 rounded-lg text-sm">
              <option>Pancake</option><option>Shopee</option><option>TikTok Shop</option><option>Zalo</option><option>Facebook</option><option>Referral</option><option>{t("Khác")}</option>
            </select>
            <select value={product} onChange={e => setProduct(e.target.value)} className="p-2.5 border border-gray-200 rounded-lg text-sm">
              <option>Đạm Mẫu</option><option>NOVA Detox</option><option>{t("Học Viện NOVA")}</option><option>{t("Khác")}</option>
            </select>
          </div>

          <h2 className="font-bold text-lg pt-2">{t("Bước 2: Map 6 nhóm từ khoá (chọn 1-3 mỗi nhóm)")}</h2>

          {CUSTOMER_GROUPS.map(g => (
            <div key={g.key} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: g.color }}>{g.no}</span>
                <div>
                  <h3 className="font-semibold text-sm">{g.icon} {t(g.label)}</h3>
                  <p className="text-xs text-gray-500">{g.helper}</p>
                </div>
                <span className="ml-auto text-xs text-gray-500">{selected[g.key]?.length || 0} {t("chọn")}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.keywords.map(kw => {
                  const on = selected[g.key]?.includes(kw);
                  return (
                    <button key={kw} type="button" onClick={() => toggleKw(g.key, kw)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition border ${
                        on ? "border-2" : "border border-gray-200 text-gray-700 hover:border-gray-400"
                      }`}
                      style={on ? { borderColor: g.color, backgroundColor: g.color + "22", color: g.color } : {}}>
                      {kw}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <h2 className="font-bold text-lg pt-2">{t("Bước 3: Ghi chú thêm (tuỳ chọn)")}</h2>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            placeholder={t("VD: Khách đã thử các sản phẩm khác không hiệu quả, ngân sách 2-3tr/tháng...")}
            className="w-full p-2.5 border border-gray-200 rounded-lg text-sm" />

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">{t("Huỷ")}</button>
            <button type="submit" disabled={pending || !name} className="px-5 py-2.5 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> {pending ? t("Đang sinh...") : t("Tạo kịch bản")}
            </button>
          </div>
        </form>
      )}

      {!showForm && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
          <div className="p-5 border-b border-gray-100"><h2 className="font-semibold">{t("Khách hàng đã map")} ({list.length})</h2></div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="text-left p-3">{t("Tên khách")}</th>
                <th className="text-left p-3">{t("Sản phẩm")}</th>
                <th className="text-left p-3">{t("Nguồn")}</th>
                <th className="text-left p-3">{t("Pain chính")}</th>
                <th className="text-left p-3">{t("Mong muốn")}</th>
                <th className="text-left p-3">{t("Trạng thái")}</th>
                <th className="text-left p-3">{t("Ngày")}</th>
              </tr>
            </thead>
            <tbody>
              {list.map(c => (
                <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setShowResult({ name: c.customer_name, script: c.generated_script || "" })}>
                  <td className="p-3">
                    <div className="font-medium">{c.customer_name}</div>
                    <div className="text-xs text-gray-500">{c.customer_phone}</div>
                  </td>
                  <td className="p-3 text-xs">{c.product_interested}</td>
                  <td className="p-3 text-xs">{c.customer_source}</td>
                  <td className="p-3 text-xs">{(c.pain_keywords ?? []).slice(0, 2).join(", ")}</td>
                  <td className="p-3 text-xs">{(c.identity_keywords ?? []).slice(0, 2).join(", ")}</td>
                  <td className="p-3" onClick={e => e.stopPropagation()}>
                    <select value={c.status} onChange={e => { updateInsightStatus(c.id, e.target.value).then(load); }}
                      className={`text-xs px-2 py-1 rounded border-none ${STATUS_OPTIONS.find(s => s.v === c.status)?.c || ""}`}>
                      {STATUS_OPTIONS.map(s => <option key={s.v} value={s.v}>{t(s.l)}</option>)}
                    </select>
                  </td>
                  <td className="p-3 text-xs">{c.created_at?.slice(0, 10)}</td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={7} className="p-12 text-center text-gray-400">
                  {t("Chưa map khách nào — bấm \"Map khách hàng mới\" để bắt đầu")}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
