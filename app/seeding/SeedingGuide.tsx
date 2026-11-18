"use client";
import { useState } from "react";
import { useLang } from "@/components/lang-provider";

type Section = { title: string; rows: string[][] };
type Group = { key: string; title: string; intro: string; sections: Section[]; weekly: { thu: string; loai: string; loi: string }[] };
type Care = { day: string; goal: string; message: string };
type Task = { group_key: string; time_slot: string; title?: string; assigned_to?: string; done?: boolean; note?: string };
type Data = {
  groups: Group[];
  careFlows: { bought: Care[]; notBought: Care[] };
  dinhHuong: { intro: string; tuyen: string[]; rows: { label: string; cols: string[] }[] };
  materials: { set: string; items: { name: string; benefit: string }[] }[];
  matTips: string[];
  phoneCapture?: { intro: string; scripts: { goal: string; message: string }[]; tips: string[] };
  painScripts?: { intro: string; items: { pain: string; ask: string; empathy: string; proof: string; combo: string; close: string }[] };
  telesales?: { intro: string; hotCriteria: string[]; steps: { phase: string; script: string }[]; tips: string[] };
  salesProcess?: { intro: string; steps: { n: string; name: string; do: string; tool: string; metric: string }[]; principles: string[] };
  timeline: { phase: string; tasks: { work: string; who: string }[] }[];
  roles: { role: string; job: string }[];
};

const SLOTS = [{ k: "sang", label: "Sáng" }, { k: "trua", label: "Trưa" }, { k: "toi", label: "Tối" }];
const WEEKDAY = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

function CopyBtn({ text }: { text: string }) {
  const [d, setD] = useState(false);
  if (!text) return null;
  return <button onClick={() => navigator.clipboard?.writeText(text).then(() => { setD(true); setTimeout(() => setD(false), 1400); })}
    className={`shrink-0 text-xs px-2 py-1 rounded-md border ${d ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"}`}>{d ? "✓" : ""}</button>;
}

function SectionTable({ s }: { s: Section }) {
  const { t: tDich } = useLang();
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
      <div className="p-3 bg-gray-50 border-b border-gray-100 text-sm font-semibold">{tDich(s.title)}</div>
      <div className="divide-y divide-gray-100">
        {s.rows.map((r, i) => {
          const nonEmpty = r.filter(Boolean);
          const isSub = nonEmpty.length === 1 && /^(LÕI|CHỦ ĐỀ|GĐ|BƯỚC|GROUP|TUYẾN)/i.test(r[0] || "");
          if (isSub) return <div key={i} className="px-3 py-2 bg-indigo-50/60 text-xs font-bold text-indigo-800 uppercase">{r[0]}</div>;
          return (
            <div key={i} className="px-3 py-2 grid gap-2 text-sm" style={{ gridTemplateColumns: r.length >= 3 ? "120px 1fr 1fr" : r.length === 2 ? "150px 1fr" : "1fr" }}>
              {r.map((c, j) => <div key={j} className={j === 0 ? "font-medium text-gray-700" : "text-gray-600"}>{c}</div>)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SeedingGuide({ data, date, staff, tasks }: { data: Data; date: string; staff: string[]; tasks: Task[] }) {
  const { t: tDich } = useLang();
  const { t } = useLang();
  const tabs = [
    { k: "process", label: t("Quy trình 7 bước") },
    { k: "strategy", label: t("Định hướng") },
    { k: "materials", label: t("Kho tài liệu mẫu") },
    ...data.groups.map((g, i) => ({ k: g.key, label: `${i + 1}${g.title.replace(/Tuyến \d — /, "")}` })),
    { k: "care", label: t("Chăm sóc khách") },
    { k: "phone", label: t("Lấy SĐT") },
    { k: "pain", label: t("Theo nỗi đau") },
    { k: "tele", label: t("Telesales (tệp nóng)") },
    { k: "assign", label: t("Lịch & phân công") },
  ];
  const [tab, setTab] = useState("strategy");
  const [flow, setFlow] = useState<"bought" | "notBought">("notBought");

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">{t("Cẩm nang Seeding đa kênh")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("Định hướng → tài liệu → nội dung từng kênh → kịch bản chăm sóc → phân công. Đọc tab Định hướng trước nhé.")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {tabs.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${tab === t.k ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>{tDich(t.label)}</button>
        ))}
      </div>

      {tab === "assign" && <AssignBoard data={data} date={date} staff={staff} tasks={tasks} />}

      {tab === "care" && (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-900">{t("Đừng chỉ chốt — chăm theo flow. Mỗi mốc ngày có tin nhắn mẫu, bấm copy để gửi.")}</div>
          <div className="flex gap-2">
            <button onClick={() => setFlow("notBought")} className={`px-3 py-1.5 rounded-lg text-sm border ${flow === "notBought" ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200"}`}>{t("Khách CHƯA mua")}</button>
            <button onClick={() => setFlow("bought")} className={`px-3 py-1.5 rounded-lg text-sm border ${flow === "bought" ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200"}`}>{t("Khách ĐÃ mua + upsell")}</button>
          </div>
          {(data.careFlows[flow] || []).map((c, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">{c.day && <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">{t("Ngày")} {c.day}</span>}<span className="text-sm font-semibold">{tDich(c.goal)}</span></div>
                {c.message && <p className="text-sm text-gray-600 mt-1.5 whitespace-pre-wrap leading-relaxed">{c.message}</p>}
              </div>
              <CopyBtn text={c.message} />
            </div>
          ))}
        </div>
      )}

      {tab === "process" && data.salesProcess && (
        <div className="space-y-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-900">{tDich(data.salesProcess.intro)}</div>
          {data.salesProcess.steps.map((s, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-3 flex gap-3">
              <div className="shrink-0 w-8 h-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center">{s.n}</div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm">{s.name}</div>
                <div className="text-sm text-gray-600 mt-0.5">{s.do}</div>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  <span className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{s.tool}</span>
                  <span className="text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded">{s.metric}</span>
                </div>
              </div>
            </div>
          ))}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
            <div className="font-semibold text-sm mb-2">{t("Nguyên tắc chuẩn hoá (chống thất thoát lead)")}</div>
            <ul className="space-y-1 text-sm text-gray-700">{data.salesProcess.principles.map((p, i) => <li key={i}>• {p}</li>)}</ul>
          </div>
        </div>
      )}

      {tab === "phone" && data.phoneCapture && (
        <div className="space-y-3">
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-900"><b>{t("NÚT THẮT lớn nhất: ~84% inbox chưa lấy được SĐT.")}</b> {tDich(data.phoneCapture.intro)}</div>
          {data.phoneCapture.scripts.map((s, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-3 flex items-start justify-between gap-3">
              <div className="min-w-0"><span className="text-sm font-semibold">{tDich(s.goal)}</span><p className="text-sm text-gray-600 mt-1.5 whitespace-pre-wrap leading-relaxed">{s.message}</p></div>
              <CopyBtn text={s.message} />
            </div>
          ))}
          {data.phoneCapture.tips?.length > 0 && <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 space-y-1"><div className="font-semibold mb-1">{t("Nguyên tắc")}</div>{data.phoneCapture.tips.map((tip, i) => <p key={i}>• {tip}</p>)}</div>}
        </div>
      )}

      {tab === "pain" && data.painScripts && (
        <div className="space-y-3">
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-sm text-indigo-900">{tDich(data.painScripts.intro)}</div>
          {data.painScripts.items.map((p, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
              <div className="p-3 bg-gray-50 border-b border-gray-100 text-sm font-bold text-gray-800">{p.pain}</div>
              <div className="divide-y divide-gray-100">
                {[[t("Hỏi sâu"), p.ask], [t("Đồng cảm"), p.empathy], [t("Bằng chứng"), p.proof], [t("Combo gợi ý"), p.combo], [t("Câu chốt"), p.close]].map(([lbl, txt], j) => (
                  <div key={j} className="px-3 py-2 flex items-start justify-between gap-3">
                    <div className="min-w-0"><span className="text-xs font-semibold text-gray-400 uppercase">{lbl}</span><p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap leading-relaxed">{txt}</p></div>
                    <CopyBtn text={txt} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "tele" && data.telesales && (
        <div className="space-y-3">
          <a href="/sales/telesales" className="block bg-indigo-600 text-white rounded-xl p-3 text-sm hover:bg-indigo-700 transition"><b>{t("Bộ kịch bản Telesales đầy đủ")}</b> {t("(xin SĐT · gọi ngay+Zalo · 5 kịch bản theo nỗi đau · xử lý phản đối · mẫu tin Zalo · KPI) → bấm mở ↗")}</a>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-900"><b>{t("Telesales chuyển đổi cao hơn nhắn tin.")}</b> {tDich(data.telesales.intro)}</div>
          <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-3">
            <div className="text-sm font-semibold mb-1">{t("Khi nào gọi (tệp NÓNG)")}</div>
            <ul className="text-sm text-gray-600 space-y-0.5">{data.telesales.hotCriteria.map((c, i) => <li key={i}>• {c}</li>)}</ul>
          </div>
          {data.telesales.steps.map((s, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-3 flex items-start justify-between gap-3">
              <div className="min-w-0"><span className="text-sm font-semibold">{s.phase}</span><p className="text-sm text-gray-600 mt-1.5 whitespace-pre-wrap leading-relaxed">{s.script}</p></div>
              <CopyBtn text={s.script} />
            </div>
          ))}
          {data.telesales.tips?.length > 0 && <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 space-y-1"><div className="font-semibold mb-1">{t("Mẹo gọi")}</div>{data.telesales.tips.map((tip, i) => <p key={i}>• {tip}</p>)}</div>}
        </div>
      )}

      {data.groups.map(g => tab === g.key && (
        <div key={g.key} className="space-y-4">
          {tDich(g.intro) && <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-3 text-sm text-gray-600">{tDich(g.intro)}</div>}
          {g.sections.map((s, i) => <SectionTable key={i} s={s} />)}
        </div>
      ))}

      {tab === "materials" && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900">{t("Dưới mỗi bài seeding gắn 1 tài liệu đúng nỗi đau để thu lead.")}</div>
          {data.materials.map((m, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
              <div className="p-3 bg-gray-50 border-b border-gray-100 text-sm font-semibold">{m.set}</div>
              <ul className="divide-y divide-gray-100">{m.items.map((it, j) => <li key={j} className="p-3"><div className="text-sm font-medium">{it.name}</div>{it.benefit && <div className="text-xs text-gray-500 mt-0.5">{it.benefit}</div>}</li>)}</ul>
            </div>
          ))}
          {data.matTips?.length > 0 && <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4 text-sm text-gray-600 space-y-1"><div className="font-semibold mb-1">{t("Mẹo")}</div>{data.matTips.map((tip, i) => <p key={i}>{tip}</p>)}</div>}
        </div>
      )}

      {tab === "strategy" && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-xl p-4">
            <div className="font-semibold text-emerald-800 mb-2">{t("Dùng cẩm nang này thế nào? (quy trình 5 bước)")}</div>
            <ol className="text-sm text-gray-700 space-y-1.5 list-decimal pl-5">
              <li><b>{t("Định hướng")}</b> {t("(tab này): hiểu 4 tuyến seeding & 4 pha — đọc trước để biết tổng thể.")}</li>
              <li><b>{t("Kho tài liệu mẫu")}</b>: {t("lấy tài liệu tặng (lead magnet) gắn dưới mỗi bài để thu khách.")}</li>
              <li><b>{t("1→4Nội dung từng kênh")}</b> {t("(Zalo / FB Private / FB Công khai / Group ngoài): lịch đăng + ngân hàng bài viết của từng kênh.")}</li>
              <li><b>{t("Chăm sóc khách")}</b>: {t("kịch bản tin nhắn theo flow (khách chưa mua / đã mua) — bấm Copy gửi ngay.")}</li>
              <li><b>{t("Lịch & phân công")}</b>: {t("chia ai làm kênh nào, khung giờ nào, đã xong chưa.")}</li>
            </ol>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="font-semibold text-amber-900 mb-2">{t("Chưa rành công nghệ? Đăng bài theo 5 bước này")}</div>
            <ol className="text-sm text-gray-700 space-y-1.5 list-decimal pl-5">
              <li><b>{t("Lấy nội dung:")}</b> {t("mở tab kênh của bạn (Zalo / FB / Group) → chọn 1 bài trong \"ngân hàng bài viết\" → bấm")} <b>Copy</b>.</li>
              <li><b>{t("Lấy ảnh:")}</b> {t("dùng ảnh kèm trong \"Kho tài liệu mẫu\" (hoặc ảnh sản phẩm thật, KHÔNG lấy ảnh trên mạng).")}</li>
              <li><b>{t("Đăng đúng chỗ:")}</b> {t("Zalo → đăng Nhật ký/nhắn nhóm khách · FB → đăng trang cá nhân/fanpage · Group → đăng vào nhóm được phân công. Dán nội dung + ảnh → Đăng.")}</li>
              <li><b>{t("Đúng khung giờ:")}</b> {t("xem tab \"Lịch & phân công\" — đăng đúng ca sáng/trưa/tối được giao, rồi tick \"Đã xong\".")}</li>
              <li><b>{t("Tương tác:")}</b> {t("ai bình luận/nhắn tin → trả lời trong 5–10 phút (xem \"Chăm sóc khách\" để copy câu trả lời mẫu).")}</li>
            </ol>
            <div className="text-xs text-red-600 mt-2">{t("TUYỆT ĐỐI không dùng từ: \"chữa/trị/điều trị/thải độc/detox/giảm cân/thanh lọc\" — sản phẩm là")} <b>{t("thực phẩm bổ sung")}</b>. {t("Dùng: \"hỗ trợ, chăm sóc, bổ sung, sống khoẻ\".")}</div>
          </div>
          {tDich(data.dinhHuong.intro) && <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-3 text-sm text-gray-700">{tDich(data.dinhHuong.intro)}</div>}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase"><tr><th className="text-left p-3"></th>{data.dinhHuong.tuyen.map((tuyen, i) => <th key={i} className="text-left p-3 min-w-[150px]">{tuyen}</th>)}</tr></thead>
              <tbody>{data.dinhHuong.rows.map((r, i) => <tr key={i} className="border-t border-gray-100 align-top"><td className="p-3 font-semibold whitespace-nowrap">{tDich(r.label)}</td>{r.cols.map((c, j) => <td key={j} className="p-3 text-gray-600 whitespace-pre-wrap text-xs">{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
          {data.roles?.length > 0 && <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4"><div className="text-sm font-semibold mb-2">{t("Phân vai nhân sự")}</div><ul className="space-y-1.5 text-sm">{data.roles.map((r, i) => <li key={i}><b>{r.role}:</b> <span className="text-gray-600">{r.job}</span></li>)}</ul></div>}
          {data.timeline?.length > 0 && data.timeline.map((ph, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden"><div className="p-3 bg-gray-50 border-b border-gray-100 text-sm font-semibold">{ph.phase}</div><ul className="divide-y divide-gray-100">{ph.tasks.map((tk, j) => <li key={j} className="p-3 flex items-start gap-2 text-sm"><span className="text-gray-300"></span><span className="flex-1">{tk.work}</span>{tk.who && <span className="shrink-0 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{tk.who}</span>}</li>)}</ul></div>
          ))}
        </div>
      )}
    </div>
  );
}

function AssignBoard({ data, date, staff, tasks }: { data: Data; date: string; staff: string[]; tasks: Task[] }) {
  const { t: tDich } = useLang();
  const { t } = useLang();
  const wd = WEEKDAY[new Date(date + "T00:00:00Z").getUTCDay()];
  const taskOf = (gk: string, slot: string) => tasks.find(t => t.group_key === gk && t.time_slot === slot);
  const planOf = (g: Group) => g.weekly.find(w => w.thu.replace(/\s/g, "") === wd.replace(/\s/g, ""))?.loai || "";

  return (
    <div className="space-y-4">
      <form className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-500">{t("Ngày:")}</span>
        <input type="date" name="d" defaultValue={date} className="p-2 border border-gray-200 rounded-lg text-sm" />
        <button className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm">{t("Xem")}</button>
        <span className="text-sm font-medium text-gray-700">{t(wd)}, {date.slice(8)}/{date.slice(5, 7)}</span>
      </form>
      <p className="text-xs text-gray-400">{t("Phân công ai đăng/chăm cho từng tuyến theo khung giờ. Gợi ý nội dung lấy từ lịch tuần của tuyến. Tick \"Đã xong\" để theo dõi.")}</p>
      {data.groups.map(g => (
        <div key={g.key} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
          <div className="p-3 bg-gray-50 border-b border-gray-100 text-sm font-semibold flex justify-between">
            <span>{tDich(g.title).replace(/Tuyến \d — /, "")}</span>
            {planOf(g) && <span className="text-xs font-normal text-gray-500">{t("Hôm nay:")} {planOf(g)}</span>}
          </div>
          <div className="divide-y divide-gray-100">
            {SLOTS.map(slot => <SlotRow key={slot.k} date={date} group={g} slot={slot} staff={staff} existing={taskOf(g.key, slot.k)} suggest={planOf(g)} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function SlotRow({ date, group, slot, staff, existing, suggest }: { date: string; group: Group; slot: { k: string; label: string }; staff: string[]; existing?: Task; suggest: string }) {
  const { t } = useLang();
  const [assigned, setAssigned] = useState(existing?.assigned_to || "");
  const [done, setDone] = useState(!!existing?.done);
  const [note, setNote] = useState(existing?.note || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(next?: Partial<{ done: boolean }>) {
    setSaving(true); setSaved(false);
    const doneVal = next?.done !== undefined ? next.done : done;
    try {
      const r = await fetch("/api/seeding-task", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_date: date, group_key: group.key, time_slot: slot.k, title: suggest, assigned_to: assigned, done: doneVal, note }),
      });
      if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 1400); }
    } finally { setSaving(false); }
  }

  return (
    <div className={`px-3 py-2.5 flex flex-wrap items-center gap-2 text-sm ${done ? "bg-emerald-50/40" : ""}`}>
      <span className="w-16 font-medium">{t(slot.label)}</span>
      <select value={assigned} onChange={e => setAssigned(e.target.value)} className="text-xs border border-gray-200 rounded p-1.5 min-w-[130px]">
        <option value="">{t("— phân công —")}</option>
        {staff.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <input value={note} onChange={e => setNote(e.target.value)} placeholder={t("ghi chú / link bài…")} className="text-xs border border-gray-200 rounded p-1.5 flex-1 min-w-[140px]" />
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={done} onChange={e => { setDone(e.target.checked); save({ done: e.target.checked }); }} /> {t("Đã xong")}</label>
      <button onClick={() => save()} disabled={saving} className="text-xs px-2.5 py-1 rounded-md bg-emerald-600 text-white">{saving ? "..." : saved ? t("✓ Lưu") : t("Lưu")}</button>
    </div>
  );
}
