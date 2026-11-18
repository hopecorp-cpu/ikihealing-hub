"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertSecret, deleteSecret, revealSecret } from "./actions";
import type { SecretMeta } from "@/lib/secret-vault";
import { KeyRound, Eye, EyeOff, Copy, Pencil, Trash2, Plus, X, ShieldCheck, AlertTriangle } from "lucide-react";

const CATEGORIES = ["AI/LLM", "Thanh toán", "Gửi tin", "Hạ tầng", "Khác"];
const empty = { id: "", name: "", label: "", category: "AI/LLM", value: "", note: "", status: "active" };

export function ApiKeysClient({ rows, ready, hasKey }: { rows: SecretMeta[]; ready: boolean; hasKey: boolean }) {
  const { t: t } = useLang();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<any | null>(null);
  const [shown, setShown] = useState<Record<string, string>>({});
  const [toast, setToast] = useState("");
  const router = useRouter();

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 1600); };
  const copy = (txt: string, label: string) => { navigator.clipboard?.writeText(txt || ""); flash(`Đã copy ${label}`); };

  const reveal = (id: string) => {
    if (shown[id]) { setShown(p => { const n = { ...p }; delete n[id]; return n; }); return; }
    start(async () => {
      const res = await revealSecret(id);
      if (res.success && res.value != null) {
        setShown(p => ({ ...p, [id]: res.value! }));
        setTimeout(() => setShown(p => { const n = { ...p }; delete n[id]; return n; }), 30000);
      } else alert(res.error || "Không hiện được key");
    });
  };

  const save = (form: any) => start(async () => {
    const res = await upsertSecret(form);
    if (res.success) { setEditing(null); router.refresh(); flash("Đã lưu"); } else alert(res.error);
  });
  const del = (id: string, name: string) => { if (confirm(`Xoá key "${name}"?`)) start(async () => { await deleteSecret(id); router.refresh(); }); };

  const byCat = CATEGORIES.map(c => ({ cat: c, items: rows.filter(r => r.category === c) }))
    .concat([{ cat: "__other__", items: rows.filter(r => !CATEGORIES.includes(r.category)) }])
    .filter(g => g.items.length > 0);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><KeyRound className="w-6 h-6 text-emerald-600" /> {t("Két API Key")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("Key mã hóa AES-256-GCM trong DB. Chỉ Admin/CEO xem. Mặc định chỉ hiện 4 số cuối — bấm để lộ toàn bộ (có ghi log).")}</p>
        </div>
        <button onClick={() => setEditing(empty)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold inline-flex items-center gap-1">
          <Plus className="w-4 h-4" /> {t("Thêm key")}
        </button>
      </div>

      {!hasKey && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800 flex gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{t("Chưa đặt biến")} <code className="font-mono">SECRET_VAULT_KEY</code> {t("trên server — chưa mã hóa/giải mã được. Thêm biến (chuỗi ngẫu nhiên ≥ 32 ký tự) vào Vercel rồi deploy lại.")}</span>
        </div>
      )}
      {!ready && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
          {t("Chưa chạy migration 038 (bảng secret_vault). Chạy")} <code className="font-mono">node scripts/run-migration-038.mjs</code> {t("rồi tải lại trang.")}
        </div>
      )}

      {byCat.map(g => (
        <div key={g.cat} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 font-semibold text-sm">
            {g.cat === "__other__" ? t("Khác") : g.cat} <span className="text-gray-400 font-normal">· {g.items.length}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {g.items.map(r => (
              <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="sm:w-64 shrink-0">
                  <div className="tabular-nums text-sm font-medium flex items-center gap-1.5">
                    {r.name}
                    {r.status === "disabled" && <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">{t("tắt")}</span>}
                  </div>
                  {t(r.label) && <div className="text-xs text-gray-500">{t(r.label)}</div>}
                </div>
                <div className="flex-1 flex items-center gap-1.5 text-sm min-w-0">
                  <span className="text-xs text-gray-400 w-12 shrink-0">{t("Giá trị")}</span>
                  {!r.has_value ? (
                    <span className="text-gray-300 italic">{t("chưa điền")}</span>
                  ) : shown[r.id] ? (
                    <span className="tabular-nums flex-1 truncate text-emerald-700">{shown[r.id]}</span>
                  ) : (
                    <span className="tabular-nums flex-1 truncate">••••••••{r.last4 || ""}</span>
                  )}
                  {r.has_value && <>
                    <button onClick={() => reveal(r.id)} disabled={pending} className="text-gray-400 hover:text-gray-700" title={shown[r.id] ? t("Ẩn") : t("Hiện")}>
                      {shown[r.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    {shown[r.id] && <button onClick={() => copy(shown[r.id], r.name)} className="text-gray-400 hover:text-emerald-600" title="Copy"><Copy className="w-4 h-4" /></button>}
                  </>}
                </div>
                {t(r.note) && <div className="text-xs text-gray-400 sm:max-w-[180px] truncate">{t(r.note)}</div>}
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setEditing({ ...empty, id: r.id, name: r.name, label: t(r.label) || "", category: r.category, note: t(r.note) || "", status: r.status, value: "" })} className="text-gray-400 hover:text-emerald-600" title={t("Sửa / xoay key")}><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => del(r.id, r.name)} className="text-gray-400 hover:text-red-600" title={t("Xoá")}><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {ready && rows.length === 0 && <div className="text-center text-gray-400 py-10">{t("Chưa có key nào — bấm &quot;Thêm key&quot;.")}</div>}

      {editing && <EditModal init={editing} onClose={() => setEditing(null)} onSave={save} pending={pending} />}
      {toast && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50 inline-flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> {toast}</div>}
    </div>
  );
}

function EditModal({ init, onClose, onSave, pending }: { init: any; onClose: () => void; onSave: (f: any) => void; pending: boolean }) {
  const { t: t } = useLang();
  const [f, setF] = useState({ ...init });
  const set = (k: string) => (e: any) => setF((p: any) => ({ ...p, [k]: e.target.value }));
  const INP = "w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-400";
  const isEdit = !!init.id;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3 flex justify-between items-center">
          <h3 className="font-bold">{isEdit ? t("Sửa / xoay key") : t("Thêm key")}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <label className="block"><span className="text-xs text-gray-500 block mb-0.5">{t("Tên key (code dùng) *")}</span>
            <input className={INP + " font-mono disabled:bg-gray-50"} value={f.name} onChange={set("name")} disabled={isEdit} placeholder="anthropic_api_key" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="text-xs text-gray-500 block mb-0.5">{t("Nhãn")}</span>
              <input className={INP} value={t(f.label)} onChange={set("label")} placeholder="Claude API - ACME" />
            </label>
            <label className="block"><span className="text-xs text-gray-500 block mb-0.5">{t("Nhóm")}</span>
              <select className={INP} value={f.category} onChange={set("category")}>
                {CATEGORIES.map(c => <option key={t(c)} value={t(c)}>{t(c)}</option>)}
              </select>
            </label>
          </div>
          <label className="block"><span className="text-xs text-gray-500 block mb-0.5">{t("Giá trị key")} {isEdit && <span className="text-gray-400">{t("(để trống = giữ key cũ)")}</span>}</span>
            <input className={INP + " font-mono"} value={f.value} onChange={set("value")} placeholder={isEdit ? t("Nhập key mới để xoay…") : "sk-ant-…"} autoComplete="off" />
          </label>
          <label className="block"><span className="text-xs text-gray-500 block mb-0.5">{t("Ghi chú")}</span>
            <input className={INP} value={t(f.note)} onChange={set("note")} placeholder={t("Tài khoản nào, ai giữ, hạn dùng…")} />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={f.status === "active"} onChange={e => setF((p: any) => ({ ...p, status: e.target.checked ? "active" : "disabled" }))} />
            {t("Đang bật (getSecret trả về key này)")}
          </label>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">{t("Huỷ")}</button>
          <button onClick={() => onSave(f)} disabled={pending} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">{pending ? t("Đang lưu…") : t("Lưu")}</button>
        </div>
      </div>
    </div>
  );
}
