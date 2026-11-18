"use client";
import { useEffect, useState, useTransition } from "react";
import { submitCheckIn, getMyCheckins } from "./actions";
import { useLang } from "@/components/lang-provider";

function getWeek(d = new Date()) {
  const onejan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
}

export default function CheckInPage() {
  const { t } = useLang();
  const week = getWeek();
  const year = new Date().getFullYear();
  const [q1, setQ1] = useState(""); const [q2, setQ2] = useState(""); const [q3, setQ3] = useState("");
  const [list, setList] = useState<any[]>([]);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [pending, startTransition] = useTransition();

  const load = () => {
    startTransition(async () => {
      const data = await getMyCheckins();
      setList(data);
    });
  };

  useEffect(() => { load(); }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await submitCheckIn({ week, year, q1, q2, q3 });
      if (res.success) {
        setMsg({ text: t("Đã gửi check-in"), type: "ok" });
        setQ1(""); setQ2(""); setQ3("");
        load();
      } else {
        setMsg({ text: "" + res.error, type: "err" });
      }
      setTimeout(() => setMsg(null), 3000);
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{t("Check-in tuần")} {week}/{year}</h1>

      <form onSubmit={onSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <label className="text-sm font-medium">{t("1. Tuần này anh/chị làm gì?")}</label>
          <textarea value={q1} onChange={e => setQ1(e.target.value)} rows={3} required
            className="mt-1 w-full p-3 border border-gray-200 rounded-lg text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium">{t("2. Vướng mắc gì cần hỗ trợ?")}</label>
          <textarea value={q2} onChange={e => setQ2(e.target.value)} rows={2}
            className="mt-1 w-full p-3 border border-gray-200 rounded-lg text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium">{t("3. Tuần tới sẽ làm gì?")}</label>
          <textarea value={q3} onChange={e => setQ3(e.target.value)} rows={3} required
            className="mt-1 w-full p-3 border border-gray-200 rounded-lg text-sm" />
        </div>
        <div className="flex justify-end items-center gap-3">
          {msg && <span className={`text-sm ${msg.type === "ok" ? "text-green-600" : "text-red-600"}`}>{msg.text}</span>}
          <button type="submit" disabled={pending} className="px-5 py-2.5 bg-brand-600 text-white rounded-lg font-medium disabled:opacity-50">
            {pending ? t("Đang gửi...") : t("Gửi check-in")}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-100"><h2 className="font-semibold">{t("Lịch sử check-in")}</h2></div>
        <div className="divide-y divide-gray-100">
          {list.map(c => (
            <div key={c.id} className="p-5">
              <div className="font-semibold text-sm text-gray-700">{t("Tuần")} {c.week_number}/{c.year}</div>
              <div className="text-sm mt-2 space-y-1.5">
                <div><span className="text-gray-500">{t("▸ Đã làm:")}</span> {c.q1_done}</div>
                <div><span className="text-gray-500">{t("▸ Vướng:")}</span> {c.q2_blockers || "—"}</div>
                <div><span className="text-gray-500">{t("▸ Tuần tới:")}</span> {c.q3_next_week}</div>
              </div>
              {c.feedbacks?.length > 0 && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm">
                  <b>{t("Feedback:")}</b> {t(c.feedbacks[0].content)}
                </div>
              )}
            </div>
          ))}
          {list.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">{t("Chưa có check-in nào")}</div>}
        </div>
      </div>
    </div>
  );
}
