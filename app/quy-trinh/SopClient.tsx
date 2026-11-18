"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowUpRight, Pencil, Trash2, Plus, Check, X, ListChecks } from "lucide-react";
import { PageHeader, Badge } from "@/components/ui/kit";
import type { SopItem } from "@/lib/sop";
import { upsertSop, removeSop } from "./actions";

function Editor({ init, onDone }: { init: Partial<SopItem>; onDone: () => void }) {
  const { t: t } = useLang();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(init.title || "");
  const [dept, setDept] = useState(init.dept || "");
  const [icon, setIcon] = useState(init.icon || "");
  const [purpose, setPurpose] = useState(init.purpose || "");
  const [steps, setSteps] = useState((init.steps || []).join("\n"));
  const [link, setLink] = useState(init.link || "");
  const save = () => start(async () => {
    if (!title.trim()) return;
    await upsertSop({ key: init.key || "", title, dept, icon, purpose, steps: steps.split("\n").map((s) => s.trim()).filter(Boolean), link: link.trim() || undefined, published: true } as SopItem);
    onDone();
  });
  return (
    <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-4 space-y-2">
      <div className="flex gap-2">
        <input value={icon} onChange={(e) => setIcon(e.target.value)} className="w-14 px-2 py-1.5 rounded-lg border border-gray-200 text-center" placeholder="" />
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-semibold" placeholder={t("Tên quy trình")} />
        <input value={dept} onChange={(e) => setDept(e.target.value)} className="w-40 px-3 py-1.5 rounded-lg border border-gray-200 text-sm" placeholder={t("Phòng ban")} />
      </div>
      <input value={purpose} onChange={(e) => setPurpose(e.target.value)} className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm" placeholder={t("Mục đích của quy trình")} />
      <textarea value={steps} onChange={(e) => setSteps(e.target.value)} rows={6} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono" placeholder={t("Mỗi dòng = 1 bước")} />
      <input value={link} onChange={(e) => setLink(e.target.value)} className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs" placeholder={t("Link trang liên quan (vd /kho) — không bắt buộc")} />
      <div className="flex gap-2">
        <button onClick={save} disabled={pending} className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-semibold inline-flex items-center gap-1 hover:bg-emerald-700"><Check className="w-3.5 h-3.5" />{t("Lưu quy trình")}</button>
        <button onClick={onDone} className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg inline-flex items-center gap-1"><X className="w-3.5 h-3.5" />{t("Huỷ")}</button>
      </div>
    </div>
  );
}

function Card({ it, canEdit }: { it: SopItem; canEdit: boolean }) {
  const { t: t } = useLang();
  const [edit, setEdit] = useState(false);
  const [pending, start] = useTransition();
  if (edit) return <Editor init={it} onDone={() => setEdit(false)} />;
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl">{it.icon}</span>
          <div className="min-w-0">
            <div className="text-sm font-bold text-gray-800 truncate">{t(it.title)}</div>
            <Badge tone="gray">{it.dept}</Badge>
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-1 shrink-0">
            <button onClick={() => setEdit(true)} className="text-gray-300 hover:text-gray-600 p-1" title={t("Sửa")}><Pencil className="w-3.5 h-3.5" /></button>
            <button onClick={() => start(async () => { if (confirm(t("Xoá quy trình này?"))) await removeSop(it.key); })} disabled={pending} className="text-gray-300 hover:text-rose-500 p-1" title={t("Xoá")}><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        )}
      </div>
      {it.purpose && <p className="text-[12px] text-gray-500 mt-2">{it.purpose}</p>}
      <ol className="mt-3 space-y-1.5 flex-1">
        {it.steps.map((s, i) => (
          <li key={i} className="flex gap-2 text-[13px] text-gray-700">
            <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      {it.link && (
        <Link href={it.link} className="mt-3 text-[12px] text-emerald-600 hover:text-emerald-700 font-semibold inline-flex items-center gap-1">
          {t("Mở trang liên quan")} <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}

export default function SopClient({ items, intro, canEdit, updatedAt }: { items: SopItem[]; intro: string; canEdit: boolean; updatedAt?: string }) {
  const { t: t } = useLang();
  const [adding, setAdding] = useState(false);
  const depts = Array.from(new Set(items.map((i) => i.dept)));
  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <PageHeader
        title={t("Thư viện quy trình")}
        subtitle={t("SOP vận hành chuẩn — Bước ⑥ trong hệ thống quản trị 6 bước")}
        icon={ListChecks}
        actions={canEdit && !adding ? (
          <button onClick={() => setAdding(true)} className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-semibold inline-flex items-center gap-1 hover:bg-emerald-700"><Plus className="w-4 h-4" />{t("Thêm quy trình")}</button>
        ) : undefined}
      />
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-gray-500">
        <span>{items.length} {t("quy trình ·")} {depts.length} {t("phòng ban")}</span>
        {updatedAt && <span className="text-gray-400">{t("· cập nhật")} {updatedAt.slice(0, 10)}</span>}
      </div>
      <p className="text-[13px] text-gray-500">{intro}</p>
      {adding && <Editor init={{}} onDone={() => setAdding(false)} />}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((it) => <Card key={it.key} it={it} canEdit={canEdit} />)}
      </div>
    </div>
  );
}
