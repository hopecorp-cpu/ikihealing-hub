"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Settings, Plus, Trash2, RotateCcw, Save, X, MessageSquare, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/kit";
import type { AiApp } from "@/lib/ai-apps";
import { saveAppAction, deleteAppAction, resetAppsAction, saveCeilingAction } from "./actions";
import { chatAction } from "../kho-app-ai/actions";

const NHOM: AiApp["nhom"][] = ["Nội dung", "Bán hàng", "Chăm sóc", "Quản trị"];
const EMPTY: AiApp = { code: "", ten: "", mo_ta: "", nhom: "Nội dung", system: "", goi_y: [], status: "draft" };

export default function AdminAppsClient({ apps, ceiling }: { apps: AiApp[]; ceiling: number }) {
  const { t: t } = useLang();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [edit, setEdit] = useState<AiApp | null>(null);
  const [goiY, setGoiY] = useState("");
  const [msg, setMsg] = useState("");
  const [cap, setCap] = useState(ceiling ? String(ceiling) : "");
  const [test, setTest] = useState<{ q: string; a: string } | null>(null);

  const openEdit = (a: AiApp) => { setEdit({ ...a }); setGoiY((a.goi_y || []).join("\n")); setMsg(""); setTest(null); };

  const save = () => {
    if (!edit) return;
    start(async () => {
      const r = await saveAppAction({ ...edit, goi_y: goiY.split("\n").map((s) => s.trim()).filter(Boolean) });
      setMsg(r.ok ? "Đã lưu" : r.error || "Lỗi");
      if (r.ok) { setEdit(null); router.refresh(); }
    });
  };

  const tryIt = () => {
    if (!edit?.code) { setMsg("Lưu app trước rồi mới chat thử được"); return; }
    const q = "Chạy thử giúp em một ví dụ ngắn cho đúng việc của app này.";
    setTest({ q, a: "Đang chạy thử..." });
    start(async () => {
      const r = await chatAction(edit.code, [{ role: "user", content: q }]);
      setTest({ q, a: r.ok ? (r.reply || "") : `Lỗi: ${r.error}` });
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <PageHeader
        title={t("Quản trị app AI")}
        subtitle={t("Thêm, sửa, duyệt app cho cả công ty dùng — và đặt trần chi phí AI mỗi tháng")}
        icon={Settings}
        actions={
          <Link href="/kho-app-ai" className="text-[12px] px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-emerald-300">
            Xem kho app
          </Link>
        }
      />

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4 flex flex-wrap items-center gap-2">
        <Wallet className="w-4 h-4 text-emerald-600" />
        <span className="text-[13px] text-gray-700 font-semibold">{t("Trần chi phí AI mỗi tháng")}</span>
        <input value={cap} onChange={(e) => setCap(e.target.value)} inputMode="numeric" placeholder="vd 3000000"
          className="w-40 px-3 py-1.5 rounded-lg border border-gray-200 text-sm" />
        <button onClick={() => start(async () => { const r = await saveCeilingAction(Number(cap) || 0); setMsg(r.ok ? t("Đã lưu trần chi phí") : r.error || t("Lỗi")); router.refresh(); })}
          disabled={pending} className="text-[12px] px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold">{t("Lưu")}</button>
        <span className="text-[11.5px] text-gray-400">{t("Vượt trần thì máy báo trong bản tin sáng. Để trống hoặc 0 là không đặt trần.")}</span>
      </div>

      {msg && <div className="text-[13px] text-emerald-700">{msg}</div>}

      <div className="flex items-center justify-between">
        <div className="text-[13px] text-gray-500">{apps.length} app trong kho</div>
        <div className="flex gap-2">
          <button onClick={() => openEdit(EMPTY)} className="text-[12px] px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold inline-flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" />{t("Thêm app")}
          </button>
          <button onClick={() => { if (confirm(t("Khôi phục bộ app gốc do Trợ lý AI soạn? Các app tự thêm sẽ mất."))) start(async () => { await resetAppsAction(); router.refresh(); }); }}
            className="text-[12px] px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 inline-flex items-center gap-1">
            <RotateCcw className="w-3.5 h-3.5" />{t("Bộ gốc")}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm divide-y divide-gray-50">
        {apps.map((a) => (
          <div key={a.code} className="p-3 flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[220px]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13.5px] font-bold text-gray-800">{t(a.ten)}</span>
                <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-500 border border-gray-200">{t(a.nhom)}</span>
                <span className={`text-[10.5px] px-1.5 py-0.5 rounded font-semibold ${a.status === "chot" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  {a.status === "chot" ? t("Đang dùng") : t("Nháp — chưa hiện cho nhân viên")}
                </span>
              </div>
              <div className="text-[12px] text-gray-500">{t(a.mo_ta)}</div>
            </div>
            <button onClick={() => openEdit(a)} className="text-[12px] px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600">{t("Sửa")}</button>
            <button onClick={() => start(async () => { await saveAppAction({ ...a, status: a.status === "chot" ? "draft" : "chot" }); router.refresh(); })}
              disabled={pending} className="text-[12px] px-2.5 py-1 rounded-lg border border-emerald-200 text-emerald-700">
              {a.status === "chot" ? t("Tạm ẩn") : t("Duyệt dùng")}
            </button>
            <button onClick={() => { if (confirm(`Xoá app "${t(a.ten)}"?`)) start(async () => { await deleteAppAction(a.code); router.refresh(); }); }}
              className="text-gray-300 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>

      {edit && (
        <div className="fixed inset-0 bg-black/30 flex items-start justify-center p-4 z-50 overflow-y-auto" onClick={() => setEdit(null)}>
          <div className="bg-white rounded-2xl p-4 w-full max-w-2xl space-y-2.5 my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-gray-800">{edit.code ? t("Sửa app") : t("Thêm app mới")}</div>
              <button onClick={() => setEdit(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-[11.5px] text-gray-500">{t("Mã app (không dấu)")}
                <input value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} placeholder="VD: CAPTION-TET"
                  className="w-full mt-0.5 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              </label>
              <label className="text-[11.5px] text-gray-500">{t("Nhóm")}
                <select value={t(edit.nhom)} onChange={(e) => setEdit({ ...edit, nhom: e.target.value as AiApp["nhom"] })}
                  className="w-full mt-0.5 px-3 py-2 rounded-lg border border-gray-200 text-sm">
                  {NHOM.map((n) => <option key={t(n)} value={t(n)}>{t(n)}</option>)}
                </select>
              </label>
            </div>
            <label className="block text-[11.5px] text-gray-500">{t("Tên hiển thị")}
              <input value={t(edit.ten)} onChange={(e) => setEdit({ ...edit, ten: e.target.value })}
                className="w-full mt-0.5 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            </label>
            <label className="block text-[11.5px] text-gray-500">{t("Mô tả ngắn (nhân viên đọc để chọn app)")}
              <input value={t(edit.mo_ta)} onChange={(e) => setEdit({ ...edit, mo_ta: e.target.value })}
                className="w-full mt-0.5 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            </label>
            <label className="block text-[11.5px] text-gray-500">{t("Bộ hướng dẫn cho AI (càng rõ càng chuẩn — nói rõ đầu ra gồm gì)")}
              <textarea value={edit.system} onChange={(e) => setEdit({ ...edit, system: e.target.value })} rows={7}
                className="w-full mt-0.5 px-3 py-2 rounded-lg border border-gray-200 text-[13px] font-mono" />
            </label>
            <label className="block text-[11.5px] text-gray-500">{t("Câu gợi ý (mỗi dòng một câu, tối đa 5)")}
              <textarea value={goiY} onChange={(e) => setGoiY(e.target.value)} rows={3}
                className="w-full mt-0.5 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            </label>
            <label className="flex items-center gap-2 text-[12.5px] text-gray-600">
              <input type="checkbox" checked={edit.status === "chot"} onChange={(e) => setEdit({ ...edit, status: e.target.checked ? "chot" : "draft" })} />
              {t("Cho nhân viên dùng ngay (bỏ chọn = giữ nháp)")}
            </label>
            <div className="text-[11.5px] text-gray-400">{t("Luật ACME (không claim công dụng, quà thay giảm giá, không emoji) máy tự ghép vào mọi app — không cần viết lại ở đây.")}</div>

            {test && (
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-[12.5px] text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto">{test.a}</div>
            )}
            <div className="flex gap-2">
              <button onClick={save} disabled={pending} className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold inline-flex items-center justify-center gap-1">
                <Save className="w-4 h-4" />{pending ? t("Đang lưu...") : t("Lưu app")}
              </button>
              <button onClick={tryIt} disabled={pending} className="px-3 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm inline-flex items-center gap-1">
                <MessageSquare className="w-4 h-4" />{t("Chat thử")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
