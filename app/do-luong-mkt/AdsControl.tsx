"use client";

import { useLang } from "@/components/lang-provider";
import { useEffect, useState, useTransition } from "react";
import { Pause, Play, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { getAdCampaigns, pauseAd, resumeAd, bumpAd, type AdCampaign } from "./actions";

const vnd = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n || 0)) + "đ";

export default function AdsControl() {
  const { t: t } = useLang();
  const [rows, setRows] = useState<AdCampaign[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, startLoad] = useTransition();

  function load() {
    startLoad(async () => {
      setErr(null);
      const r = await getAdCampaigns();
      if (r.ok) setRows(r.campaigns || []);
      else { setErr(r.error || "lỗi"); setRows([]); }
    });
  }
  useEffect(() => { load(); }, []);

  async function act(id: string, name: string, fn: () => Promise<any>, confirmText: string) {
    if (!window.confirm(confirmText)) return;
    setBusy(id); setMsg(null);
    const r = await fn();
    setBusy(null);
    if (r.ok) {
      setMsg({ ok: true, text: r.newBudget ? `"${name}": ngân sách → ${vnd(r.newBudget)}/ngày` : `"${name}": đã đổi trạng thái` });
      load();
    } else setMsg({ ok: false, text: `"${name}": ${r.error || "lỗi"}` });
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)]">
      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
        <h3 className="font-semibold flex items-center gap-2">{t("Điều khiển chiến dịch Meta")}</h3>
        <button onClick={load} disabled={loading} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> {t("Tải lại")}
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-3">{t("AI đề xuất, anh bấm mới đổi tiền. Ngừng/bật hiệu lực ngay; tăng/giảm ±20% ngân sách/ngày.")}</p>

      {msg && <div className={`text-xs mb-2 px-2 py-1.5 rounded ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{msg.text}</div>}
      {err && <div className="text-xs text-red-600 mb-2">{t("Lỗi:")} {err}</div>}
      {loading && !rows && <div className="text-sm text-gray-400">{t("Đang tải chiến dịch…")}</div>}
      {rows && rows.length === 0 && !err && <div className="text-sm text-gray-400">{t("Không có chiến dịch nào.")}</div>}

      <div className="space-y-2">
        {(rows || []).map((c) => {
          const active = /ACTIVE/i.test(c.status);
          const b = busy === c.id;
          return (
            <div key={c.id} className="rounded-lg border border-gray-100 bg-gray-50 p-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="text-[11px] text-gray-500">
                    <span className={active ? "text-emerald-600" : "text-gray-400"}>{active ? t("Đang chạy") : c.status}</span>
                    {" · "}{t("Chi tháng:")} {vnd(c.spend)}
                    {" · "}{c.dailyBudget ? `${vnd(c.dailyBudget)}/ngày` : t("ngân sách ở nhóm QC")}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {active ? (
                    <button disabled={b} onClick={() => act(c.id, c.name, () => pauseAd(c.id), `Ngừng chiến dịch "${c.name}"?`)}
                      className="inline-flex items-center gap-1 text-xs rounded-md bg-amber-100 text-amber-800 hover:bg-amber-200 px-2 py-1 disabled:opacity-50">
                      <Pause className="w-3.5 h-3.5" /> {t("Ngừng")}
                    </button>
                  ) : (
                    <button disabled={b} onClick={() => act(c.id, c.name, () => resumeAd(c.id), `Bật lại chiến dịch "${c.name}"?`)}
                      className="inline-flex items-center gap-1 text-xs rounded-md bg-emerald-100 text-emerald-800 hover:bg-emerald-200 px-2 py-1 disabled:opacity-50">
                      <Play className="w-3.5 h-3.5" /> {t("Bật")}
                    </button>
                  )}
                  <button disabled={b} onClick={() => act(c.id, c.name, () => bumpAd(c.id, 20), `Tăng 20% ngân sách/ngày cho "${c.name}"?`)}
                    className="inline-flex items-center gap-1 text-xs rounded-md bg-blue-100 text-blue-800 hover:bg-blue-200 px-2 py-1 disabled:opacity-50">
                    <ArrowUp className="w-3.5 h-3.5" /> +20%
                  </button>
                  <button disabled={b} onClick={() => act(c.id, c.name, () => bumpAd(c.id, -20), `Giảm 20% ngân sách/ngày cho "${c.name}"?`)}
                    className="inline-flex items-center gap-1 text-xs rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 px-2 py-1 disabled:opacity-50">
                    <ArrowDown className="w-3.5 h-3.5" /> −20%
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
