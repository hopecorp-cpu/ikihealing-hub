"use client";
import { useLang } from "@/components/lang-provider";

import { useState } from "react";
import { findBanned, sanitizeContent } from "@/lib/banned-words";

type Item = {
  id: string; title: string; channel: string; type: string | null;
  content_brief: string | null; status: string; publish_date: string | null;
  published_url: string | null; notes: string | null; author?: string;
};

const COLS = [
  { key: "idea", label: "Ý tưởng", color: "border-gray-300", head: "text-gray-600 bg-gray-50" },
  { key: "draft", label: "Đang viết", color: "border-yellow-300", head: "text-yellow-700 bg-yellow-50" },
  { key: "review", label: "Check & duyệt", color: "border-blue-300", head: "text-blue-700 bg-blue-50" },
  { key: "scheduled", label: "⏰ Lên lịch", color: "border-purple-300", head: "text-purple-700 bg-purple-50" },
  { key: "published", label: "Đã đăng", color: "border-emerald-300", head: "text-emerald-700 bg-emerald-50" },
];
const ORDER = COLS.map(c => c.key);
const CHANNELS = ["Facebook", "TikTok", "YouTube", "Zalo", "Blog", "Email", "Live"];

type NhanXet = { by: string; byName: string; at: string; text: string };
type Review = { comments: NhanXet[]; approvedBy?: string; approvedByName?: string; approvedAt?: string };

export default function PipelineBoard({ items: initial, reviews: rv0 = {}, laQuanLy = false }: { items: Item[]; reviews?: Record<string, Review>; laQuanLy?: boolean }) {
  const { t: tDich } = useLang();
  const [items, setItems] = useState<Item[]>(initial);
  const [reviews, setReviews] = useState<Record<string, Review>>(rv0);
  const [editing, setEditing] = useState<Item | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const api = async (body: any) => {
  const { t: tDich } = useLang();
    setBusy(true);
    try {
      const r = await fetch("/api/content-pipeline", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (j.error === "banned") alert("CHƯA ĐƯỢC ĐĂNG/LÊN LỊCH — còn từ cấm: " + (j.banned || []).join(", ") + "\n\nSửa nội dung (mở card → nút 'Thay bằng từ tuân thủ') rồi chuyển lại.");
        else if (j.error === "need_url") alert(tDich("Cần dán LINK bài đã đăng (proof) trước khi chuyển sang Đã đăng."));
        else if (j.error === "chua_duyet") alert(tDich("BÀI CHƯA ĐƯỢC DUYỆT.\n\nMở bài ra, nhờ quản lý bấm \"Duyệt bài\" rồi mới chuyển sang Lên lịch/Đã đăng được."));
        else if (j.error === "chi_quan_ly_duyet") alert(tDich("Chỉ quản lý trở lên mới duyệt bài được."));
        else alert(j.error || "Lỗi");
        return null;
      }
      if (j.review && body.id) setReviews(prev => ({ ...prev, [body.id]: j.review }));
      return j;
    } finally { setBusy(false); }
  };

  const move = async (it: Item, dir: 1 | -1) => {
  const { t: tDich } = useLang();
    const idx = ORDER.indexOf(it.status);
    const next = ORDER[idx + dir];
    if (!next) return;
    let published_url: string | undefined;
    if (next === "published" && !it.published_url) {
      const u = prompt(tDich("Dán link bài đã đăng (bắt buộc — proof):"));
      if (!u || !u.trim()) return;
      published_url = u.trim();
    }
    const r = await api({ action: "move", id: it.id, status: next, published_url });
    if (r?.ok) setItems(prev => prev.map(x => x.id === it.id ? { ...x, status: next, published_url: published_url || x.published_url } : x));
  };

  const saveEdit = async (patch: Partial<Item>) => {
    if (!editing) return;
    const r = await api({ action: "update", id: editing.id, ...patch });
    if (r?.ok) {
      setItems(prev => prev.map(x => x.id === editing.id ? { ...x, ...patch } as Item : x));

      const doiRuot = ["title", "content_brief", "notes"].some(k => k in patch);
      if (doiRuot) setReviews(prev => {
        const r0 = prev[editing.id]; if (!r0?.approvedBy) return prev;
        const { approvedBy, approvedByName, approvedAt, ...con } = r0;
        return { ...prev, [editing.id]: con as Review };
      });
      setEditing(null);
    }
  };

  const guiNhanXet = async (id: string, text: string) => { await api({ action: "comment", id, text }); };
  const doiDuyet = async (id: string, duyet: boolean) => { await api({ action: duyet ? "approve" : "unapprove", id }); };

  const del = async () => {
  const { t: tDich } = useLang();
    if (!editing) return;
    if (!confirm(tDich("Xoá content này?"))) return;
    const r = await api({ action: "delete", id: editing.id });
    if (r?.ok) { setItems(prev => prev.filter(x => x.id !== editing.id)); setEditing(null); }
  };

  const create = async (f: { title: string; channel: string; type: string; content_brief: string }) => {
    const r = await api({ action: "create", ...f });
    if (r?.ok) {
      setItems(prev => [{ id: r.id, title: f.title, channel: f.channel, type: f.type, content_brief: f.content_brief || null, status: "idea", publish_date: null, published_url: null, notes: null }, ...prev]);
      setCreating(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-[12px] text-gray-500">{tDich("Nội dung")} <b>{tDich("chỉ qua được cột Lên lịch / Đã đăng khi SẠCH từ cấm")}</b> {tDich("(chữa/trị/thải độc/giảm cân/TPCN…) · Đã đăng bắt buộc dán link (proof).")}</div>
        <button onClick={() => setCreating(true)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium shrink-0">{tDich("+ Tạo content")}</button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {COLS.map(col => {
  const { t: tDich } = useLang();
          const list = items.filter(i => i.status === col.key);
          return (
            <div key={col.key} className={`w-[240px] shrink-0 rounded-xl border ${col.color} bg-white flex flex-col max-h-[70vh]`}>
              <div className={`px-3 py-2 rounded-t-xl text-[12px] font-bold ${col.head} flex justify-between`}>
                <span>{tDich(col.label)}</span><span>{list.length}</span>
              </div>
              <div className="p-2 space-y-2 overflow-y-auto">
                {list.map(it => {
                  const hits = findBanned([tDich(it.title), it.content_brief, it.notes].filter(Boolean).join("\n"));
                  const rv = reviews[it.id];
                  const soNhanXet = rv?.comments?.length || 0;
                  return (
                    <div key={it.id} className="border border-gray-150 rounded-lg p-2 bg-gray-50/60 hover:bg-white hover:shadow-sm transition cursor-pointer" onClick={() => setEditing(it)}>
                      <div className="text-[12px] font-medium text-gray-800 line-clamp-2">{tDich(it.title)}</div>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">{it.channel}</span>
                        {it.type && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{it.type}</span>}
                        {hits.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold" title={tDich("Từ cấm: ") + hits.join(", ")}>{hits.length} {tDich("từ cấm")}</span>}
                        {rv?.approvedBy
                          ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold" title={`Duyệt bởi ${rv.approvedByName} lúc ${new Date(rv.approvedAt!).toLocaleString("vi-VN")}`}>{tDich("✓ đã duyệt")}</span>
                          : it.status === "review" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-semibold">{tDich("chờ duyệt")}</span>}
                        {soNhanXet > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700" title={tDich("Nhận xét của người kiểm")}>{soNhanXet} {tDich("nhận xét")}</span>}
                        {it.status === "published" && it.published_url && <a href={it.published_url} target="_blank" onClick={e => e.stopPropagation()} className="text-[10px] text-blue-600 underline">{tDich("bài")}</a>}
                      </div>
                      {it.author && <div className="text-[10px] text-gray-400 mt-1">{it.author}{it.publish_date ? ` · ${new Date(it.publish_date).toLocaleDateString("vi-VN")}` : ""}</div>}
                      <div className="flex justify-between mt-1.5" onClick={e => e.stopPropagation()}>
                        <button disabled={busy || ORDER.indexOf(it.status) === 0} onClick={() => move(it, -1)} className="text-[11px] px-2 py-0.5 rounded border border-gray-200 text-gray-500 disabled:opacity-30">◀</button>
                        <button disabled={busy || ORDER.indexOf(it.status) === ORDER.length - 1} onClick={() => move(it, 1)} className="text-[11px] px-2 py-0.5 rounded border border-emerald-200 text-emerald-700 font-medium disabled:opacity-30">▶</button>
                      </div>
                    </div>
                  );
                })}
                {!list.length && <div className="text-[11px] text-gray-300 text-center py-4">{tDich("Trống")}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {creating && <CreateModal onClose={() => setCreating(false)} onSave={create} busy={busy} />}
      {editing && <EditModal item={editing} onClose={() => setEditing(null)} onSave={saveEdit} onDelete={del} busy={busy}
        review={reviews[editing.id]} laQuanLy={laQuanLy}
        onComment={(t: string) => guiNhanXet(editing.id, t)} onApprove={(v: boolean) => doiDuyet(editing.id, v)} />}
    </div>
  );
}

function CreateModal({ onClose, onSave, busy }: any) {
  const { t: tDich } = useLang();
  const [f, setF] = useState({ title: "", channel: "Facebook", type: "Post", content_brief: "" });
  return (
    <Modal onClose={onClose} title={tDich("Tạo content mới")}>
      <input autoFocus value={tDich(f.title)} onChange={e => setF({ ...f, title: e.target.value })} placeholder={tDich("Tiêu đề / ý tưởng")} className="w-full p-2 border border-gray-200 rounded-lg text-sm" />
      <div className="flex gap-2">
        <select value={f.channel} onChange={e => setF({ ...f, channel: e.target.value })} className="flex-1 p-2 border border-gray-200 rounded-lg text-sm">
          {CHANNELS.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={f.type} onChange={e => setF({ ...f, type: e.target.value })} className="flex-1 p-2 border border-gray-200 rounded-lg text-sm">
          {["Post", "Video", "Story", "Reel", "Article", "Email", "Livestream"].map(t => <option key={t}>{t}</option>)}
        </select>
      </div>
      <textarea value={f.content_brief} onChange={e => setF({ ...f, content_brief: e.target.value })} placeholder={tDich("Nội dung / caption nháp (sẽ được check từ cấm)")} rows={4} className="w-full p-2 border border-gray-200 rounded-lg text-sm" />
      <BannedHint text={tDich(f.title) + "\n" + f.content_brief} />
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-500">{tDich("Huỷ")}</button>
        <button disabled={busy || !tDich(f.title).trim()} onClick={() => onSave(f)} className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-40">{tDich("Tạo")}</button>
      </div>
    </Modal>
  );
}

function KhoiDuyet({ review, laQuanLy, onComment, onApprove, busy }: any) {
  const { t: tDich } = useLang();
  const [text, setText] = useState("");
  const cmts: NhanXet[] = review?.comments || [];
  const daDuyet = !!review?.approvedBy;
  return (
    <div className="border-t border-gray-100 pt-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[12px] font-bold text-gray-700">{tDich("Duyệt bài")}</div>
        {daDuyet
          ? <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">✓ {review.approvedByName} {tDich("đã duyệt")} {new Date(review.approvedAt).toLocaleDateString("vi-VN")}</span>
          : <span className="text-[11px] text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">{tDich("chưa ai duyệt")}</span>}
      </div>

      {cmts.length > 0 && (
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {cmts.map((c, i) => (
            <div key={i} className="bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5">
              <div className="text-[10px] text-gray-400">{c.byName} · {new Date(c.at).toLocaleString("vi-VN")}</div>
              <div className="text-[12px] text-gray-700 whitespace-pre-wrap">{c.text}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1.5">
        <input value={text} onChange={e => setText(e.target.value)} placeholder={tDich("Nhận xét / hướng sửa cho người viết…")} className="flex-1 p-2 border border-gray-200 rounded-lg text-sm" />
        <button disabled={busy || !text.trim()} onClick={() => { onComment(text.trim()); setText(""); }}
          className="px-3 py-1.5 rounded-lg border border-blue-300 text-blue-700 text-sm font-medium disabled:opacity-40">{tDich("Gửi")}</button>
      </div>

      {laQuanLy ? (
        daDuyet
          ? <button disabled={busy} onClick={() => onApprove(false)} className="w-full py-1.5 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium">{tDich("Thu hồi duyệt")}</button>
          : <button disabled={busy} onClick={() => onApprove(true)} className="w-full py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium">{tDich("Duyệt bài (cho phép lên lịch / đăng)")}</button>
      ) : (
        <div className="text-[11px] text-gray-400">{tDich("Chỉ quản lý mới duyệt được. Sửa xong thì nhắn quản lý vào duyệt giúp.")}</div>
      )}
      {daDuyet && <div className="text-[11px] text-gray-400">{tDich("Sửa lại tiêu đề / nội dung / ghi chú sẽ tự huỷ dấu duyệt, phải duyệt lại.")}</div>}
    </div>
  );
}

function EditModal({ item, onClose, onSave, onDelete, busy, review, laQuanLy, onComment, onApprove }: any) {
  const { t: tDich } = useLang();
  const [f, setF] = useState({ title: item.title || "", channel: item.channel || "Facebook", type: item.type || "Post", content_brief: item.content_brief || "", published_url: item.published_url || "", notes: item.notes || "" });
  const text = f.title + "\n" + f.content_brief + "\n" + f.notes;
  const hits = findBanned(text);
  return (
    <Modal onClose={onClose} title={tDich("Sửa content")}>
      <input value={tDich(f.title)} onChange={e => setF({ ...f, title: e.target.value })} className="w-full p-2 border border-gray-200 rounded-lg text-sm" />
      <div className="flex gap-2">
        <select value={f.channel} onChange={e => setF({ ...f, channel: e.target.value })} className="flex-1 p-2 border border-gray-200 rounded-lg text-sm">
          {CHANNELS.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={f.type} onChange={e => setF({ ...f, type: e.target.value })} className="flex-1 p-2 border border-gray-200 rounded-lg text-sm">
          {["Post", "Video", "Story", "Reel", "Article", "Email", "Livestream"].map(t => <option key={t}>{t}</option>)}
        </select>
      </div>
      <textarea value={f.content_brief} onChange={e => setF({ ...f, content_brief: e.target.value })} rows={5} placeholder={tDich("Nội dung / caption")} className="w-full p-2 border border-gray-200 rounded-lg text-sm" />
      <input value={f.published_url} onChange={e => setF({ ...f, published_url: e.target.value })} placeholder={tDich("Link bài đã đăng (proof)")} className="w-full p-2 border border-gray-200 rounded-lg text-sm" />
      <textarea value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} rows={2} placeholder={tDich("Ghi chú")} className="w-full p-2 border border-gray-200 rounded-lg text-sm" />
      <BannedHint text={text} />
      {hits.length > 0 && (
        <button onClick={() => setF({ ...f, title: sanitizeContent(tDich(f.title)), content_brief: sanitizeContent(f.content_brief), notes: sanitizeContent(f.notes) })}
          className="w-full py-1.5 rounded-lg border border-emerald-300 text-emerald-700 text-sm font-medium">{tDich("Thay bằng từ tuân thủ (tự sửa")} {hits.length} {tDich("từ)")}</button>
      )}
      <KhoiDuyet review={review} laQuanLy={laQuanLy} onComment={onComment} onApprove={onApprove} busy={busy} />
      <div className="flex justify-between gap-2">
        <button onClick={onDelete} disabled={busy} className="px-3 py-1.5 text-sm text-red-500">{tDich("Xoá")}</button>
        <div className="flex gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-500">{tDich("Huỷ")}</button>
          <button disabled={busy} onClick={() => onSave(f)} className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-40">{tDich("Lưu")}</button>
        </div>
      </div>
    </Modal>
  );
}

function BannedHint({ text }: { text: string }) {
  const { t: tDich } = useLang();
  const hits = findBanned(text || "");
  if (!hits.length) return <div className="text-[11px] text-emerald-600">{tDich("Sạch từ cấm — đủ điều kiện lên lịch/đăng.")}</div>;
  return <div className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-2 py-1.5">{tDich("Từ cấm:")} <b>{hits.join(", ")}</b> {tDich("— phải sửa mới được lên lịch/đăng (SP là thực phẩm bổ sung).")}</div>;
}

function Modal({ children, onClose, title }: any) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl p-4 w-full max-w-md space-y-2.5 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="font-bold text-gray-800 text-sm">{title}</div>
        {children}
      </div>
    </div>
  );
}
