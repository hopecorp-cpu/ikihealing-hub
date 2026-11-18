"use client";
import { useLang } from "@/components/lang-provider";
import { useState } from "react";

type Step = { n?: string; step?: string; say?: string; action?: string; branch?: string; note?: string };
type Pain = {
  pain: string; combo: string; questions: string[]; steps: Step[];
  objections: { q: string; a: string }[]; closes: string[]; notes: string[];
};
type Data = {
  source: string; intro: string;
  promo: { gift: string; deadline: string; note?: string };
  compliance: string[];
  products: { name: string; price: string; note: string; use: string }[];
  hotCriteria: string[]; phoneRules: string[];
  phoneCapture: { situation: string; message: string; note: string }[];
  callback: { intro: string; steps: Step[] };
  painScripts: Pain[];
  objections: { formula: string; items: { objection: string; real: string; answer: string; luat?: string }[] };
  zaloTemplates: { tag: string; message: string }[];
  kpi: { metric: string; target: string; note: string }[];
  report: string[];
  rollout: { when: string; task: string; who: string }[];
  tracking: { note: string; columns: string[] };
  disc?: Disc;
};

type BonNhom = { D: string; I: string; S: string; C: string };
type Disc = {
  intro: string; chuKy: string;
  nhanDien: { nhom: string; viet: string; tinHieu: string }[];
  cauDo: string; docKetQua: string;
  banDo: ({ muc: string } & BonNhom)[];
  luuYDoiMinh: string;
  buoc7: ({ buoc: string } & BonNhom)[];
  kichBan: { nhom: string; nguyenTac: string; loiThoai: string; luuY: string[]; cauChot: string; cam: string }[];
  phanDoi: { ten: string; luat: string; chuan?: string; neuDangDungThuoc?: string; tra: BonNhom; canhBao: string }[];
  raoPhapLy: { hoi: string; khong: string; duoc: string }[];
  raoLuuY: string;
  ghiNhan: string[];
  doLuong: { do: string; homNay: string; dich: string }[];
  doBangMay: string;
};

type Lead = { customer_phone: string; customer_name: string | null; flow_type: string; next_due: string | null; status: string; note: string | null; updated_at: string };

function CopyBtn({ text }: { text: string }) {
  const [d, setD] = useState(false);
  if (!text) return null;
  return <button onClick={() => navigator.clipboard?.writeText(text).then(() => { setD(true); setTimeout(() => setD(false), 1400); })}
    className={`shrink-0 text-xs px-2 py-1 rounded-md border ${d ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"}`}>{d ? "✓" : ""}</button>;
}

export default function TelesalesPlaybook({ data, saleName, initialLeads = [] }: { data: Data; saleName: string; initialLeads?: Lead[] }) {
  const { t: tDich } = useLang();

  const F = (s: string) => (s || "").split("[QUÀ]").join(data.promo?.gift || "[QUÀ]").split("[HẠN]").join(data.promo?.deadline || "[HẠN]");

  const tabs = [
    { k: "lead", label: tDich("Ghi khách") },
    { k: "overview", label: tDich("Tổng quan & Quy tắc") },
    { k: "phone", label: tDich("Xin SĐT") },
    { k: "callback", label: tDich("Gọi ngay + Zalo") },
    { k: "pain", label: tDich("Kịch bản theo nỗi đau") },
    ...(data.disc ? [{ k: "disc", label: tDich("Đọc khách qua chữ viết") }] : []),
    { k: "objection", label: tDich("Xử lý phản đối") },
    { k: "zalo", label: tDich("Mẫu tin Zalo") },
    { k: "kpi", label: tDich("KPI & Triển khai") },
  ];
  const [tab, setTab] = useState("lead");
  const [pain, setPain] = useState(0);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">{tDich("Kịch bản Telesales ACME")}</h1>
        <p className="text-sm text-gray-500 mt-1">{tDich(data.intro)}</p>
        <p className="text-xs text-gray-400 mt-1">{tDich("Quà đang chạy:")} <b>{data.promo?.gift}</b> {tDich("· hạn")} {data.promo?.deadline}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {tabs.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${tab === t.k ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>{tDich(t.label)}</button>
        ))}
      </div>

      {tab === "lead" && <LeadForm pains={data.painScripts.map(p => p.pain)} saleName={saleName} initialLeads={initialLeads} />}

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="font-semibold text-red-800 mb-2">{tDich("Quy tắc tuân thủ ACME — đọc TRƯỚC khi gọi")}</div>
            <ul className="space-y-1 text-sm text-red-700">{data.compliance.map((c, i) => <li key={i}>• {c}</li>)}</ul>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
            <div className="p-3 bg-gray-50 border-b border-gray-100 text-sm font-semibold">{tDich("Sản phẩm & giá (báo đúng, gồm 8% VAT)")}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase"><tr><th className="text-left p-2">{tDich("Sản phẩm / Gói")}</th><th className="text-left p-2">{tDich("Giá")}</th><th className="text-left p-2">{tDich("Ghi chú khi báo")}</th><th className="text-left p-2">{tDich("Dùng cho")}</th></tr></thead>
                <tbody>{data.products.map((p, i) => (
                  <tr key={i} className="border-t border-gray-100 align-top">
                    <td className="p-2 font-medium text-gray-800">{p.name}</td>
                    <td className="p-2 text-emerald-700 font-semibold whitespace-nowrap">{F(p.price)}</td>
                    <td className="p-2 text-gray-600">{F(tDich(p.note))}</td>
                    <td className="p-2 text-gray-500">{p.use}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
              <div className="font-semibold text-sm mb-2">{tDich("Khi nào gọi (tệp NÓNG)")}</div>
              <ul className="space-y-1 text-sm text-gray-600">{data.hotCriteria.map((c, i) => <li key={i}>• {c}</li>)}</ul>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
              <div className="font-semibold text-sm mb-2">{tDich("Nguyên tắc xin số")}</div>
              <ul className="space-y-1 text-sm text-gray-600">{data.phoneRules.map((c, i) => <li key={i}>• {c}</li>)}</ul>
            </div>
          </div>
        </div>
      )}

      {tab === "phone" && (
        <div className="space-y-3">
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-900"><b>{tDich("Mục tiêu: chuyển khách đang chat → xin được SĐT để GỌI.")}</b> {tDich("Xin số tự nhiên, gắn lý do có lợi cho khách. Có SĐT = sang tab \"Gọi ngay + Zalo\", và bấm \"Ghi khách\" để lưu.")}</div>
          {data.phoneCapture.map((s, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><span className="text-sm font-semibold text-gray-800">{s.situation}</span><p className="text-sm text-gray-700 mt-1.5 whitespace-pre-wrap leading-relaxed">{F(s.message)}</p></div>
                <CopyBtn text={F(s.message)} />
              </div>
              {tDich(s.note) && <div className="text-xs text-gray-400 mt-1.5 italic">{tDich(s.note)}</div>}
            </div>
          ))}
        </div>
      )}

      {tab === "callback" && (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-900"><b>{tDich("Nguyên tắc vàng: có số → GỌI trong 2 GIỜ.")}</b> {tDich(data.callback.intro)}</div>
          {data.callback.steps.map((s, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><span className="text-sm font-semibold text-blue-800">{s.step}</span><p className="text-sm text-gray-700 mt-1.5 whitespace-pre-wrap leading-relaxed">{F(s.action || "")}</p></div>
                <CopyBtn text={F(s.action || "")} />
              </div>
              {tDich(s.note) && <div className="text-xs text-gray-400 mt-1.5 italic">{tDich(s.note)}</div>}
            </div>
          ))}
        </div>
      )}

      {tab === "pain" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {data.painScripts.map((p, i) => (
              <button key={i} onClick={() => setPain(i)}
                className={`px-3 py-1.5 rounded-lg text-sm border ${pain === i ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>{p.pain}</button>
            ))}
          </div>
          {(() => {
            const p = data.painScripts[pain]; if (!p) return null;
            return (
              <div className="space-y-3">
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-sm text-indigo-900"><b>{tDich("Combo gợi ý:")}</b> {p.combo}</div>

                <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-3">
                  <div className="text-sm font-semibold mb-2">{tDich("Bộ câu hỏi khai thác (tra nhanh khi gọi)")}</div>
                  <ul className="space-y-1 text-sm text-gray-600">{p.questions.map((q, i) => <li key={i}>• {q}</li>)}</ul>
                </div>

                <div className="space-y-2">
                  {p.steps.map((s, i) => (
                    <div key={i} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0"><span className="text-sm font-semibold text-indigo-800">{s.n}</span><p className="text-sm text-gray-700 mt-1.5 whitespace-pre-wrap leading-relaxed">{F(s.say || "")}</p></div>
                        <CopyBtn text={F(s.say || "")} />
                      </div>
                      {s.branch && <div className="text-xs text-amber-700 bg-amber-50 rounded-md px-2 py-1 mt-1.5">↳ {F(s.branch)}</div>}
                    </div>
                  ))}
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
                  <div className="p-3 bg-gray-50 border-b border-gray-100 text-sm font-semibold">{tDich("Xử lý phản đối (ca này)")}</div>
                  <div className="divide-y divide-gray-100">
                    {p.objections.map((o, i) => (
                      <div key={i} className="px-3 py-2 flex items-start justify-between gap-3">
                        <div className="min-w-0"><span className="text-xs font-semibold text-gray-500">"{o.q}"</span><p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap leading-relaxed">{F(o.a)}</p></div>
                        <CopyBtn text={F(o.a)} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
                  <div className="p-3 bg-gray-50 border-b border-gray-100 text-sm font-semibold">{tDich("Thư viện câu chốt")}</div>
                  <div className="divide-y divide-gray-100">
                    {p.closes.map((c, i) => (
                      <div key={i} className="px-3 py-2 flex items-start justify-between gap-3">
                        <p className="text-sm text-gray-700 min-w-0">{F(c)}</p>
                        <CopyBtn text={F(c)} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 space-y-1">
                  <div className="font-semibold mb-1">{tDich("3 lưu ý riêng cho ca này")}</div>
                  {p.notes.map((n, i) => <p key={i}>• {n}</p>)}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {tab === "disc" && data.disc && (() => {
  const { t: tDich } = useLang();
        const d = data.disc!;
        const NHOM = ["D", "I", "S", "C"] as const;
        return (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-900">{tDich(d.intro)}</div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900"><b>{tDich("Ký tên ở ĐẦU tin.")}</b> {d.chuKy}</div>

            <section className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="font-semibold mb-2">{tDich("1. Nhận nhóm trong 30 giây")}</h2>
              <div className="space-y-2">
                {d.nhanDien.map((n, i) => (
                  <div key={i} className="border border-gray-100 rounded-lg p-2.5">
                    <div className="font-medium text-sm">{tDich(n.nhom)}</div>
                    <div className="text-sm text-gray-600 mt-0.5">{n.viet}</div>
                    <div className="text-xs text-emerald-700 mt-1">{tDich("Tín hiệu chắc nhất:")} {n.tinHieu}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-sm">
                <div className="text-gray-500 mb-1">{tDich("Không chắc thì đừng đoán liều — hỏi câu này rồi đọc cách họ trả lời:")}</div>
                <div className="flex gap-2 items-start bg-gray-50 border border-gray-200 rounded-lg p-2">
                  <div className="flex-1 whitespace-pre-wrap">{d.cauDo}</div><CopyBtn text={d.cauDo} />
                </div>
                <div className="text-xs text-gray-500 mt-1.5">{d.docKetQua}</div>
              </div>
            </section>

            <section className="bg-white border border-gray-200 rounded-xl p-4 overflow-x-auto">
              <h2 className="font-semibold mb-2">{tDich("2. Bán gì cho ai")}</h2>
              <table className="w-full text-sm min-w-[640px]">
                <thead><tr className="text-left text-gray-500 border-b"><th className="py-1.5 pr-2"></th>{NHOM.map(k => <th key={k} className="py-1.5 pr-2">{k}</th>)}</tr></thead>
                <tbody>
                  {d.banDo.map((r, i) => (
                    <tr key={i} className="border-b last:border-0 align-top">
                      <td className="py-1.5 pr-2 font-medium whitespace-nowrap">{tDich(r.muc)}</td>
                      {NHOM.map(k => <td key={k} className="py-1.5 pr-2 text-gray-600">{r[k]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-gray-500 mt-2">{d.luuYDoiMinh}</p>
            </section>

            <section className="bg-white border border-gray-200 rounded-xl p-4 overflow-x-auto">
              <h2 className="font-semibold mb-2">{tDich("3. Bảy bước rã theo nhóm")}</h2>
              <p className="text-xs text-gray-500 mb-2">{tDich("Bảy bước giữ nguyên cho cả bốn nhóm. Thứ đổi là độ dài, thứ tự nhấn và lời thoại.")}</p>
              <table className="w-full text-sm min-w-[640px]">
                <thead><tr className="text-left text-gray-500 border-b"><th className="py-1.5 pr-2">{tDich("Bước")}</th>{NHOM.map(k => <th key={k} className="py-1.5 pr-2">{k}</th>)}</tr></thead>
                <tbody>
                  {d.buoc7.map((r, i) => (
                    <tr key={i} className="border-b last:border-0 align-top">
                      <td className="py-1.5 pr-2 font-medium whitespace-nowrap">{r.buoc}</td>
                      {NHOM.map(k => <td key={k} className="py-1.5 pr-2 text-gray-600">{r[k]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="space-y-3">
              <h2 className="font-semibold">{tDich("4. Kịch bản từng nhóm — chép được ngay")}</h2>
              {d.kichBan.map((k, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="font-semibold text-sm">{tDich(k.nhom)}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{k.nguyenTac}</div>
                  <div className="flex gap-2 items-start bg-gray-50 border border-gray-200 rounded-lg p-2 mt-2">
                    <div className="flex-1 text-sm whitespace-pre-wrap">{F(k.loiThoai)}</div><CopyBtn text={F(k.loiThoai)} />
                  </div>
                  <ul className="mt-2 space-y-1 text-sm text-gray-600 list-disc pl-5">{k.luuY.map((x, j) => <li key={j}>{x}</li>)}</ul>
                  <div className="flex gap-2 items-start bg-emerald-50 border border-emerald-200 rounded-lg p-2 mt-2">
                    <div className="flex-1 text-sm"><span className="text-xs text-emerald-700 font-medium">{tDich("CÂU CHỐT ·")} </span>{F(k.cauChot)}</div><CopyBtn text={F(k.cauChot)} />
                  </div>
                  <div className="text-sm text-rose-700 mt-2"><b>{tDich("Cấm:")}</b> {k.cam}</div>
                </div>
              ))}
            </section>

            <section className="space-y-3">
              <h2 className="font-semibold">{tDich("5. Ba phản đối thường gặp")}</h2>
              {d.phanDoi.map((p, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="font-semibold text-sm">{tDich(p.ten)}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{p.luat}</div>
                  {p.chuan && (
                    <div className="flex gap-2 items-start bg-blue-50 border border-blue-200 rounded-lg p-2 mt-2">
                      <div className="flex-1 text-sm"><span className="text-xs text-blue-700 font-medium">{tDich("CÂU CHUẨN — dùng nguyên văn ·")} </span>{p.chuan}</div><CopyBtn text={p.chuan} />
                    </div>
                  )}
                  {p.neuDangDungThuoc && (
                    <div className="flex gap-2 items-start bg-blue-50 border border-blue-200 rounded-lg p-2 mt-2">
                      <div className="flex-1 text-sm"><span className="text-xs text-blue-700 font-medium">{tDich("Nếu khách đang dùng thuốc ·")} </span>{p.neuDangDungThuoc}</div><CopyBtn text={p.neuDangDungThuoc} />
                    </div>
                  )}
                  <div className="mt-2 space-y-1.5">
                    {NHOM.map(k => (
                      <div key={k} className="flex gap-2 items-start bg-gray-50 border border-gray-200 rounded-lg p-2">
                        <span className="shrink-0 w-5 text-xs font-bold text-gray-500 pt-0.5">{k}</span>
                        <div className="flex-1 text-sm">{F(p.tra[k])}</div><CopyBtn text={F(p.tra[k])} />
                      </div>
                    ))}
                  </div>
                  <div className="text-sm text-rose-700 mt-2">{p.canhBao}</div>
                </div>
              ))}
            </section>

            <section className="bg-white border border-gray-200 rounded-xl p-4 overflow-x-auto">
              <h2 className="font-semibold mb-2">{tDich("6. Rào pháp lý — tra nhanh")}</h2>
              <table className="w-full text-sm min-w-[600px]">
                <thead><tr className="text-left text-gray-500 border-b"><th className="py-1.5 pr-2">{tDich("Khách hỏi")}</th><th className="py-1.5 pr-2">{tDich("Không được nói")}</th><th className="py-1.5 pr-2">{tDich("Được nói")}</th></tr></thead>
                <tbody>
                  {d.raoPhapLy.map((r, i) => (
                    <tr key={i} className="border-b last:border-0 align-top">
                      <td className="py-1.5 pr-2 font-medium">{r.hoi}</td>
                      <td className="py-1.5 pr-2 text-rose-700">{r.khong}</td>
                      <td className="py-1.5 pr-2 text-emerald-800">
                        <div className="flex gap-2 items-start"><span className="flex-1">{r.duoc}</span><CopyBtn text={r.duoc} /></div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-sm text-rose-700 mt-2">{d.raoLuuY}</p>
            </section>

            <section className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="font-semibold mb-2">{tDich("7. Ghi nhận và đo")}</h2>
              <ul className="space-y-1 text-sm text-gray-700 list-disc pl-5">{d.ghiNhan.map((x, i) => <li key={i}>{x}</li>)}</ul>
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-sm min-w-[520px]">
                  <thead><tr className="text-left text-gray-500 border-b"><th className="py-1.5 pr-2">{tDich("Đo cái gì")}</th><th className="py-1.5 pr-2">{tDich("Hôm nay")}</th><th className="py-1.5 pr-2">{tDich("Đích")}</th></tr></thead>
                  <tbody>
                    {d.doLuong.map((r, i) => (
                      <tr key={i} className="border-b last:border-0 align-top">
                        <td className="py-1.5 pr-2 font-medium">{r.do}</td>
                        <td className="py-1.5 pr-2 text-gray-600">{r.homNay}</td>
                        <td className="py-1.5 pr-2 text-emerald-800">{r.dich}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500 mt-2">{d.doBangMay}</p>
            </section>
          </div>
        );
      })()}

      {tab === "objection" && (
        <div className="space-y-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-900">{data.objections.formula}</div>
          {data.objections.items.map((o, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">"{o.objection}"</span>
                    <span className="text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{tDich("ý thật:")} {o.real}</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1.5 whitespace-pre-wrap leading-relaxed">{F(o.answer)}</p>
                  {o.luat && (
                    <p className="text-[12px] text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-2 mt-2 leading-relaxed">
                      <span className="font-semibold">{tDich("LUẬT — đọc trước khi gửi:")} </span>{o.luat}
                    </p>
                  )}
                </div>
                <CopyBtn text={F(o.answer)} />
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "zalo" && (
        <div className="space-y-3">
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-sm text-sky-900">{tDich("Tin nhắn Zalo mẫu cho từng tình huống — bấm để copy, thay [tên]/[combo]/[địa chỉ] cho đúng khách.")}</div>
          {data.zaloTemplates.map((z, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-3 flex items-start justify-between gap-3">
              <div className="min-w-0"><span className="text-sm font-semibold text-gray-800">{z.tag}</span><p className="text-sm text-gray-700 mt-1.5 whitespace-pre-wrap leading-relaxed">{F(z.message)}</p></div>
              <CopyBtn text={F(z.message)} />
            </div>
          ))}
        </div>
      )}

      {tab === "kpi" && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
            <div className="p-3 bg-gray-50 border-b border-gray-100 text-sm font-semibold">{tDich("Chỉ tiêu mỗi sale / ngày")}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase"><tr><th className="text-left p-2">{tDich("Chỉ số")}</th><th className="text-left p-2">{tDich("Mục tiêu")}</th><th className="text-left p-2">{tDich("Ghi chú")}</th></tr></thead>
                <tbody>{data.kpi.map((k, i) => (
                  <tr key={i} className="border-t border-gray-100"><td className="p-2 font-medium text-gray-800">{k.metric}</td><td className="p-2 text-blue-700 font-semibold whitespace-nowrap">{k.target}</td><td className="p-2 text-gray-500">{tDich(k.note)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
            <div className="p-3 bg-gray-50 border-b border-gray-100 text-sm font-semibold">{tDich("Kế hoạch triển khai 7–10 ngày")}</div>
            <ul className="divide-y divide-gray-100">
              {data.rollout.map((r, i) => (
                <li key={i} className="p-3 flex items-start gap-2 text-sm">
                  <span className="shrink-0 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{r.when}</span>
                  <span className="flex-1 text-gray-700">{r.task}</span>
                  <span className="shrink-0 text-xs text-gray-400">{r.who}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
            <div className="font-semibold text-sm mb-2">{tDich("Mẫu báo cáo thầy (sau 7–10 ngày)")}</div>
            <ul className="space-y-1 text-sm text-gray-700">{data.report.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
            <div className="font-semibold text-sm mb-1">{tDich("Bảng theo dõi gọi hằng ngày")}</div>
            <p className="text-xs text-gray-500 mb-2">{tDich(data.tracking.note)}</p>
            <div className="flex flex-wrap gap-1.5">{data.tracking.columns.map((c, i) => <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{c}</span>)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

const RESULTS = [
  { k: "new", label: "Mới xin số (chưa gọi)", channel: false, outcome: "", flow: "notBought" },
  { k: "tuvan", label: "Đã gọi — tư vấn", channel: true, outcome: "tuvan", flow: "notBought" },
  { k: "hen", label: "Hẹn gọi lại", channel: true, outcome: "hen", flow: "notBought" },
  { k: "chot", label: "Đã CHỐT đơn ", channel: true, outcome: "chot", flow: "bought" },
  { k: "miss", label: "Gọi nhỡ / không nghe", channel: true, outcome: "miss", flow: "notBought" },
] as const;

function leadStatusBadge(l: Lead) {
  const { t: tDich } = useLang();
  if (l.flow_type === "reorder") return { text: tDich("Đang chăm lại"), cls: "bg-amber-100 text-amber-700" };
  if (l.flow_type === "bought") return { text: tDich("Đã chốt "), cls: "bg-emerald-100 text-emerald-700" };
  if (l.status === "done") return { text: "Xong flow", cls: "bg-gray-100 text-gray-600" };
  return { text: tDich("Đang chăm"), cls: "bg-blue-100 text-blue-700" };
}

function LeadForm({ pains, saleName, initialLeads }: { pains: string[]; saleName: string; initialLeads: Lead[] }) {
  const { t: tDich } = useLang();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [painSel, setPainSel] = useState(pains[0] || "");
  const [result, setResult] = useState<string>("new");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [leads, setLeads] = useState<Lead[]>(initialLeads);

  async function refresh() {
    try {
      const res = await fetch("/api/telesales-leads");
      const j = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(j.leads)) setLeads(j.leads);
    } catch { }
  }

  async function save() {
    const p = phone.replace(/[^\d+]/g, "").trim();
    if (!p) { setMsg({ ok: false, text: tDich("Nhập SĐT khách đã ạ.") }); return; }
    const r = RESULTS.find(x => x.k === result)!;
    setBusy(true); setMsg(null);
    try {
      const body: any = {
        phone: p, name: name.trim() || null, sale_name: saleName || undefined,
        flow_type: r.flow, current_day: 0,
        note: `[${painSel}]${note.trim() ? " " + note.trim() : ""}`,
      };
      if (r.channel) { body.channel = "call"; body.callOutcome = r.outcome; }
      const res = await fetch("/api/care", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg({ ok: true, text: tDich("✓ Đã lưu. Khách hiện ở danh sách dưới + mục Chăm sóc khách.") });
        setName(""); setPhone(""); setNote(""); setResult("new");
        refresh();
      } else setMsg({ ok: false, text: "" + (j.error || "Lỗi lưu") });
    } catch (e: any) { setMsg({ ok: false, text: "" + (e?.message || "Lỗi mạng") }); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-900">
        <b>{tDich("Xin được số → ghi ngay vào đây.")}</b> {tDich("Khách sẽ tự xuất hiện ở")} <a href="/cham-soc-kh" className="underline font-medium">{tDich("Chăm sóc khách")}</a> {tDich("để nhắc follow-up theo flow, và cuộc gọi được tính vào KPI telesales của bạn.")}
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4 space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-600">{tDich("Tên khách")}</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={tDich("VD: Chị Lan")} className="w-full mt-0.5 p-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-600">{tDich("Số điện thoại / Zalo")} <span className="text-red-500">*</span></label>
            <input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" placeholder="09xxxxxxxx" className="w-full mt-0.5 p-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-600">{tDich("Nỗi đau chính")}</label>
            <select value={painSel} onChange={e => setPainSel(e.target.value)} className="w-full mt-0.5 p-2 border border-gray-200 rounded-lg text-sm">
              {pains.map(p => <option key={p} value={p}>{p}</option>)}
              <option value="Khác">{tDich("Khác")}</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600">{tDich("Trạng thái")}</label>
            <select value={result} onChange={e => setResult(e.target.value)} className="w-full mt-0.5 p-2 border border-gray-200 rounded-lg text-sm">
              {RESULTS.map(r => <option key={r.k} value={r.k}>{tDich(r.label)}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-600">{tDich("Ghi chú (giờ hẹn gọi lại, combo quan tâm…)")}</label>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder={tDich("VD: hẹn 15h gọi lại, quan tâm combo 21 ngày")} className="w-full mt-0.5 p-2 border border-gray-200 rounded-lg text-sm" />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={busy} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">{busy ? tDich("Đang lưu…") : tDich("Lưu khách")}</button>
          {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</span>}
        </div>
      </div>
      <p className="text-xs text-gray-400">{tDich("Lưu ý: nếu chọn \"Đã gọi/Hẹn/Chốt/Nhỡ\" thì cuộc gọi được đếm vào KPI telesales (bản tin sáng, đánh giá cá nhân). Trạng thái \"Mới xin số\" chỉ lưu khách để follow-up, chưa tính là cuộc gọi.")}</p>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
        <div className="p-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-semibold">{tDich("Khách telesales hôm nay của tôi (")}{leads.length})</span>
          <div className="flex items-center gap-2">
            <button onClick={refresh} className="text-xs px-2 py-1 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50">{tDich("↻ Làm mới")}</button>
            <a href="/cham-soc-kh" className="text-xs px-2 py-1 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50">{tDich("Quản lý ↗")}</a>
          </div>
        </div>
        {leads.length === 0 ? (
          <div className="p-4 text-sm text-gray-400">{tDich("Chưa có khách nào hôm nay. Xin được số thì ghi ở form trên nha.")}</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {leads.map((l, i) => {
              const b = leadStatusBadge(l);
              return (
                <div key={i} className="px-3 py-2.5 flex items-center gap-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-800">{l.customer_name || l.customer_phone}</span>
                      <a href={`tel:${l.customer_phone}`} className="text-xs text-blue-600">{l.customer_phone}</a>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${b.cls}`}>{b.text}</span>
                    </div>
                    {tDich(l.note) && <div className="text-xs text-gray-500 mt-0.5 truncate">{tDich(l.note)}</div>}
                  </div>
                  {l.next_due && <span className="shrink-0 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">{tDich("nhắc")} {l.next_due.slice(8)}/{l.next_due.slice(5, 7)}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
