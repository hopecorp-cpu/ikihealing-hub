"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertPlatformAccount, deletePlatformAccount, revealPlatformSecret } from "./actions";
import { KeyRound, Eye, EyeOff, Copy, Pencil, Trash2, Plus, ExternalLink, X, AlertTriangle } from "lucide-react";
import { useLang } from "@/components/lang-provider";

const CATEGORIES = ["Mạng xã hội", "Sàn TMĐT", "Web / Hosting", "Công cụ", "Hotline / SIM", "Khác"];
const empty = { id: "", category: "Mạng xã hội", platform: "", label: "", url: "", username: "", password: "", two_fa: "", notes: "" };

export function AccountsClient({ rows, ready, hasKey }: { rows: any[]; ready: boolean; hasKey: boolean }) {
  const { t } = useLang();
  const [pending, start] = useTransition();
  const [shown, setShown] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<any | null>(null);
  const [toast, setToast] = useState("");
  const router = useRouter();

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 1500); };
  const copy = (txt: string, label: string) => {
    navigator.clipboard?.writeText(txt || "");
    flash(`${t("Đã copy")} ${label}`);
  };

  const reveal = (id: string, field: "password" | "two_fa") => {
    const k = `${id}:${field}`;
    if (shown[k]) { setShown(p => { const n = { ...p }; delete n[k]; return n; }); return; }
    start(async () => {
      const res = await revealPlatformSecret(id, field);
      if (res.success && res.value != null) {
        setShown(p => ({ ...p, [k]: res.value! }));
        setTimeout(() => setShown(p => { const n = { ...p }; delete n[k]; return n; }), 30000);
      } else alert(res.error || t("Không hiện được"));
    });
  };

  const save = (form: any) => start(async () => {
    const res = await upsertPlatformAccount(form);
    if (res.success) { setEditing(null); router.refresh(); } else alert(res.error);
  });
  const del = (id: string, name: string) => { if (confirm(`${t("Xoá tài khoản")} "${name}"?`)) start(async () => { await deletePlatformAccount(id); router.refresh(); }); };

  const byCat = CATEGORIES.map(c => ({ cat: c, items: rows.filter(r => r.category === c) }))
    .concat([{ cat: "__other__", items: rows.filter(r => !CATEGORIES.includes(r.category)) }])
    .filter(g => g.items.length > 0);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><KeyRound className="w-6 h-6 text-amber-600" /> {t("Kho tài khoản nền tảng")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("Mật khẩu & 2FA mã hóa AES-256-GCM trong DB. Chỉ hiện 4 ký tự cuối — bấm để lộ toàn bộ (có ghi log).")}</p>
        </div>
        <button onClick={() => setEditing(empty)} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold inline-flex items-center gap-1">
          <Plus className="w-4 h-4" /> {t("Thêm tài khoản")}
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
          {t("Chưa chạy migration 039 (cột mã hóa platform_accounts). Chạy node scripts/run-migration-039.mjs rồi tải lại trang.")}
        </div>
      )}

      {byCat.map(g => (
        <div key={g.cat} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 font-semibold text-sm">
            {g.cat === "__other__" ? t("Khác") : t(g.cat)} <span className="text-gray-400 font-normal">· {g.items.length}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {g.items.map(r => (
              <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="sm:w-56 shrink-0">
                  <div className="font-medium flex items-center gap-1">
                    {r.platform}
                    {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="text-gray-300 hover:text-brand-600"><ExternalLink className="w-3.5 h-3.5" /></a>}
                  </div>
                  {t(r.label) && <div className="text-xs text-gray-500">{t(r.label)}</div>}
                </div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <CredCell label={t("Tài khoản")} value={r.username} onCopy={() => copy(r.username, t("tài khoản"))} />
                  <SecretCell
                    label={t("Mật khẩu")}
                    has={r.has_password} last4={r.password_last4}
                    shown={shown[`${r.id}:password`]}
                    onToggle={() => reveal(r.id, "password")}
                    onCopy={() => copy(shown[`${r.id}:password`], t("mật khẩu"))}
                    pending={pending}
                  />
                  {r.has_two_fa && (
                    <div className="sm:col-span-2">
                      <SecretCell
                        label={t("2FA")}
                        has={r.has_two_fa} last4={r.two_fa_last4}
                        shown={shown[`${r.id}:two_fa`]}
                        onToggle={() => reveal(r.id, "two_fa")}
                        onCopy={() => copy(shown[`${r.id}:two_fa`], t("2FA"))}
                        pending={pending}
                      />
                    </div>
                  )}
                  {r.notes && <div className="text-xs text-gray-400 sm:col-span-2">{r.notes}</div>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setEditing(r)} className="text-gray-400 hover:text-brand-600" title={t("Sửa")}><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => del(r.id, r.platform)} className="text-gray-400 hover:text-red-600" title={t("Xoá")}><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {ready && rows.length === 0 && <div className="text-center text-gray-400 py-10">{t("Chưa có tài khoản nào — bấm \"Thêm tài khoản\".")}</div>}

      {editing && <EditModal init={editing} onClose={() => setEditing(null)} onSave={save} pending={pending} />}
      {toast && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">{toast}</div>}
    </div>
  );
}

function CredCell({ label, value, onCopy }: { label: string; value: string | null; onCopy: () => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-400 w-14 shrink-0">{label}</span>
      <span className="flex-1 truncate">{value || <span className="text-gray-300">—</span>}</span>
      {value && <button onClick={onCopy} className="text-gray-400 hover:text-brand-600"><Copy className="w-4 h-4" /></button>}
    </div>
  );
}

function SecretCell({ label, has, last4, shown, onToggle, onCopy, pending }: {
  label: string; has: boolean; last4: string | null; shown?: string;
  onToggle: () => void; onCopy: () => void; pending: boolean;
}) {
  const { t } = useLang();
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-400 w-14 shrink-0">{label}</span>
      <span className="tabular-nums flex-1 truncate">
        {!has ? <span className="text-gray-300">—</span>
          : shown != null ? <span className="text-amber-700">{shown}</span>
          : <>••••••••{last4 || ""}</>}
      </span>
      {has && <>
        <button onClick={onToggle} disabled={pending} className="text-gray-400 hover:text-gray-700 disabled:opacity-40" title={shown != null ? t("Ẩn") : t("Hiện")}>
          {shown != null ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
        {shown != null && <button onClick={onCopy} className="text-gray-400 hover:text-brand-600" title={t("Copy")}><Copy className="w-4 h-4" /></button>}
      </>}
    </div>
  );
}

function EditModal({ init, onClose, onSave, pending }: { init: any; onClose: () => void; onSave: (f: any) => void; pending: boolean }) {
  const { t } = useLang();

  const [f, setF] = useState({ ...init, password: "", two_fa: "" });
  const set = (k: string) => (e: any) => setF((p: any) => ({ ...p, [k]: e.target.value }));
  const INP = "w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-400";
  const isEdit = !!init.id;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3 flex justify-between items-center">
          <h3 className="font-bold">{isEdit ? t("Sửa") : t("Thêm")} {t("tài khoản")}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label><span className="text-xs text-gray-500 block mb-0.5">{t("Nhóm")}</span>
              <select value={f.category} onChange={set("category")} className={INP}>{CATEGORIES.map(c => <option key={t(c)} value={t(c)}>{t(c)}</option>)}</select>
            </label>
            <label><span className="text-xs text-gray-500 block mb-0.5">{t("Nền tảng *")}</span><input value={f.platform} onChange={set("platform")} placeholder={t("VD: Shopee")} className={INP} /></label>
          </div>
          <label><span className="text-xs text-gray-500 block mb-0.5">{t("Tên cụ thể")}</span><input value={t(f.label) ?? ""} onChange={set("label")} placeholder={t("VD: Fanpage NOVA Detox")} className={INP} /></label>
          <label><span className="text-xs text-gray-500 block mb-0.5">{t("Link đăng nhập")}</span><input value={f.url ?? ""} onChange={set("url")} placeholder="https://..." className={INP} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label><span className="text-xs text-gray-500 block mb-0.5">{t("Tài khoản (email/sđt)")}</span><input value={f.username ?? ""} onChange={set("username")} className={INP} /></label>
            <label><span className="text-xs text-gray-500 block mb-0.5">{t("Mật khẩu")} {isEdit && init.has_password && <span className="text-gray-400">{t("(để trống = giữ cũ)")}</span>}</span><input type="password" value={f.password ?? ""} onChange={set("password")} autoComplete="new-password" placeholder={isEdit && init.has_password ? "••••" + (init.password_last4 || "") : ""} className={INP + " font-mono"} /></label>
          </div>
          <label><span className="text-xs text-gray-500 block mb-0.5">{t("2FA / Email khôi phục")} {isEdit && init.has_two_fa && <span className="text-gray-400">{t("(để trống = giữ cũ)")}</span>}</span><input value={f.two_fa ?? ""} onChange={set("two_fa")} autoComplete="off" placeholder={isEdit && init.has_two_fa ? "••••" + (init.two_fa_last4 || "") : ""} className={INP} /></label>
          <label><span className="text-xs text-gray-500 block mb-0.5">{t("Ghi chú")}</span><input value={f.notes ?? ""} onChange={set("notes")} className={INP} /></label>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg">{t("Huỷ")}</button>
          <button onClick={() => onSave(f)} disabled={pending} className="px-5 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">{pending ? t("Đang lưu...") : t("Lưu")}</button>
        </div>
      </div>
    </div>
  );
}
