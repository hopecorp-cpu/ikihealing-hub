"use client";

import { useLang } from "@/components/lang-provider";
import { useEffect, useState } from "react";
import { FileText, Plus, Trash2, Save, Loader2 } from "lucide-react";

type Mau = { id: string; ten: string; noiDung: string; nhom: string; boi?: string; luc?: string; ngung?: boolean };

export default function MauTinClient({ quanLy }: { quanLy: boolean }) {
  const { t: t } = useLang();
  const [ds, setDs] = useState<Mau[]>([]);
  const [sua, setSua] = useState<Mau | null>(null);
  const [bao, setBao] = useState(""); const [dangLuu, setDangLuu] = useState(false);
  const tai = () => fetch("/api/hop-thu-zalo/mau-tin").then((r) => r.json()).then((j) => setDs(j?.mau || [])).catch(() => {});
  useEffect(() => { tai(); }, []);

  const luu = async () => {
    if (!sua) return; setDangLuu(true); setBao("");
    try {
      const r = await fetch("/api/hop-thu-zalo/mau-tin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sua) });
      const j = await r.json(); if (!r.ok) throw new Error(j?.loi || `Lỗi ${r.status}`);
      setDs(j.mau || []); setSua(null); setBao("Đã lưu.");
    } catch (e: any) { setBao(String(e.message || e)); } finally { setDangLuu(false); }
  };
  const xoa = async (id: string) => {
    if (!confirm(t("Xoá mẫu này?"))) return;
    const r = await fetch(`/api/hop-thu-zalo/mau-tin?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const j = await r.json(); if (r.ok) setDs(j.mau || []); else setBao(j?.loi || "Không xoá được");
  };
  const nhomList = [...new Set(ds.map((m) => m.nhom))];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4 lg:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><FileText className="h-5 w-5 text-[#0068FF]" /> {t("Mẫu tin nhanh")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("Sale bấm nút Mẫu tin trong khung chat để chèn — chèn vào ô soạn, sửa rồi mới gửi.")} <code className="rounded bg-slate-100 px-1">{"{ten}"}</code> {t("= tên gọi khách. Mọi mẫu qua cửa từ cấm khi lưu.")}</p>
        </div>
        {quanLy && <button onClick={() => setSua({ id: "", ten: "", noiDung: "", nhom: "Chung" })} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0068FF] px-3 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> {t("Thêm mẫu")}</button>}
      </div>
      {bao && <p className={`rounded-lg px-3 py-2 text-sm ${/Đã lưu/.test(bao) ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{bao}</p>}

      {sua && (
        <div className="rounded-2xl border border-[#0068FF]/40 bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
            <label className="text-xs text-slate-600">{t("Tên mẫu")}<input value={t(sua.ten)} onChange={(e) => setSua({ ...sua, ten: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder={t("Ví dụ: Chào khách mới hỏi giá")} /></label>
            <label className="text-xs text-slate-600">{t("Nhóm")}<input value={t(sua.nhom)} onChange={(e) => setSua({ ...sua, nhom: e.target.value })} list="nhom-mau" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /><datalist id="nhom-mau">{nhomList.map((n) => <option key={n} value={n} />)}</datalist></label>
          </div>
          <label className="mt-3 block text-xs text-slate-600">{t("Nội dung")}<textarea value={t(sua.noiDung)} onChange={(e) => setSua({ ...sua, noiDung: e.target.value })} rows={5} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder={t("Dạ chào {ten}, em là ... bên NOVA ạ")} /></label>
          <div className="mt-3 flex gap-2">
            <button onClick={luu} disabled={dangLuu || !t(sua.ten).trim() || !t(sua.noiDung).trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0068FF] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">{dangLuu ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t("Lưu")}</button>
            <button onClick={() => setSua(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">{t("Huỷ")}</button>
          </div>
        </div>
      )}

      {nhomList.map((nhom) => (
        <section key={nhom} className="rounded-2xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{nhom}</h2>
          <ul className="divide-y divide-slate-100">
            {ds.filter((m) => t(m.nhom) === nhom).map((m) => (
              <li key={m.id} className={`flex items-start gap-3 px-4 py-3${m.ngung ? " opacity-60" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">{t(m.ten)}{m.ngung && <span className="ml-2 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">{t("NGỪNG — không chèn")}</span>}</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-600">{t(m.noiDung)}</p>
                  {m.boi && <p className="mt-1 text-[10px] text-slate-400">{m.boi}{m.luc ? ` · ${new Date(m.luc).toLocaleDateString("vi-VN")}` : ""}</p>}
                </div>
                {quanLy && (
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => setSua(m)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs">{t("Sửa")}</button>
                    <button onClick={() => xoa(m.id)} className="rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-600" title={t("Xoá")}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {!ds.length && <p className="text-sm text-slate-500">{t("Đang tải mẫu...")}</p>}
    </div>
  );
}
