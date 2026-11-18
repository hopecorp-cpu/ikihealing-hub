"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useTransition } from "react";
import { saveContractLink, saveCccd } from "./actions";

type R = { id: string; name: string; position: string; type: string; hire: string; cccd: string; address: string; contractUrl: string; terminated: boolean; missing: string[] };

export default function HopDongClient({ rows }: { rows: R[] }) {
  const { t } = useLang();
  const [pending, start] = useTransition();
  const [edit, setEdit] = useState<Record<string, { cccd: string; url: string }>>({});
  const [msg, setMsg] = useState<string>("");

  const get = (r: R) => edit[r.id] || { cccd: r.cccd, url: r.contractUrl };
  const set = (id: string, patch: any) => setEdit(e => ({ ...e, [id]: { ...(e[id] || rows.find(r => r.id === id)!), ...patch } }));
  const save = (r: R) => start(async () => {
    const v = get(r);
    if (v.cccd !== r.cccd) await saveCccd(r.id, v.cccd);
    if (v.url !== r.contractUrl) await saveContractLink(r.id, v.url);
    setMsg(t("Đã lưu ") + r.name); setTimeout(() => setMsg(""), 2500);
  });

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-x-auto">
      {msg && <div className="p-2 text-sm text-emerald-700 bg-emerald-50">{msg}</div>}
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
          <tr><th className="text-left p-2">{t("Nhân viên")}</th><th className="text-left p-2">{t("Loại HĐ")}</th><th className="text-left p-2">{t("CCCD")}</th><th className="text-left p-2">{t("Link hợp đồng (Drive)")}</th><th className="text-left p-2">{t("Thiếu")}</th><th className="p-2"></th></tr>
        </thead>
        <tbody>
          {rows.map(r => { const v = get(r); return (
            <tr key={r.id} className={`border-t border-gray-100 ${r.terminated ? "opacity-50" : ""}`}>
              <td className="p-2"><div className="font-medium">{r.name}{r.terminated && <span className="text-[10px] text-gray-400"> {t("(nghỉ)")}</span>}</div><div className="text-xs text-gray-400">{r.position}</div></td>
              <td className="p-2 text-xs">{r.type || "—"}</td>
              <td className="p-2"><input value={v.cccd} onChange={e => set(r.id, { cccd: e.target.value })} placeholder={t("Nhập CCCD")} className="p-1.5 border border-gray-200 rounded text-sm w-36" /></td>
              <td className="p-2"><div className="flex items-center gap-1"><input value={v.url} onChange={e => set(r.id, { url: e.target.value })} placeholder={t("Dán link Drive")} className="p-1.5 border border-gray-200 rounded text-sm w-56" />{r.contractUrl && <a href={r.contractUrl} target="_blank" rel="noreferrer" className="text-blue-600 text-xs">{t("mở↗")}</a>}</div></td>
              <td className="p-2">{r.missing.length ? <span className="text-xs text-red-600">{r.missing.join(", ")}</span> : <span className="text-xs text-emerald-600">{t("đủ ✓")}</span>}</td>
              <td className="p-2"><button onClick={() => save(r)} disabled={pending} className="text-xs px-2.5 py-1 bg-gray-900 text-white rounded disabled:opacity-50">{t("Lưu")}</button></td>
            </tr>
          ); })}
        </tbody>
      </table>
    </div>
  );
}
