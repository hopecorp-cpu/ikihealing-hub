"use client";
import { useState, useEffect, useTransition } from "react";
import { createTask, createDeptTask, updateTaskStatus, acknowledgeTask } from "./actions";
import { LY_DO_HOAN, ghiLyDo, laViecHoan, type MaLyDo } from "@/lib/ly-do-hoan";

function hoiLyDoHoan(): string | null {
  const { t: t } = useLang();
  const ds = LY_DO_HOAN.map((l, i) => `${i + 1}. ${l.ten}`).join("\n");
  const r = prompt(`Đơn này HOÀN vì sao? Gõ số:\n${ds}`) || "";
  const i = Number(r.trim()) - 1;
  if (!Number.isInteger(i) || i < 0 || i >= LY_DO_HOAN.length) return null;
  const ma = LY_DO_HOAN[i].ma as MaLyDo;
  const ghiChu = ma === "khac" ? (prompt(t("Ghi rõ lý do:")) || "").trim() : (prompt(t("Ghi chú thêm (bỏ trống nếu không):")) || "").trim();
  if (ma === "khac" && !ghiChu) return null;
  return ghiLyDo(ma, ghiChu);
}
import { Plus, X, Users, User, Clock, CalendarDays, GripVertical, CheckCircle2, Play, AlertTriangle } from "lucide-react";
import { useLang } from "@/components/lang-provider";

const PRIORITY: Record<string, { label: string; dot: string; chip: string }> = {
  low:    { label: "Thấp",  dot: "#94A3B8", chip: "bg-slate-100 text-slate-600" },
  medium: { label: "Thường", dot: "#3B82F6", chip: "bg-blue-50 text-blue-700" },
  high:   { label: "Cao",   dot: "#F59E0B", chip: "bg-amber-50 text-amber-700" },
  urgent: { label: "Khẩn",  dot: "#EF4444", chip: "bg-red-50 text-red-700" },
};
const PRIORITY_BAR: Record<string, string> = { low: "#CBD5E1", medium: "#3B82F6", high: "#F59E0B", urgent: "#EF4444" };

const STATUS_COLS = [
  { v: "todo",    l: "Cần làm",    color: "#64748B" },
  { v: "doing",   l: "Đang làm",   color: "#3B82F6" },
  { v: "blocked", l: "Đang vướng", color: "#F59E0B" },
  { v: "review",  l: "Chờ duyệt",  color: "#8B5CF6" },
  { v: "done",    l: "Hoàn thành", color: "#10B981" },
];

const AVA = ["#6366F1", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#8B5CF6", "#14B8A6"];
function avatarOf(name?: string) {
  const n = (name || "?").trim();
  const parts = n.split(/\s+/);
  const initials = ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
  let h = 0; for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
  return { initials, color: AVA[h % AVA.length] };
}

export function TasksBoard({ tasks, users, departments, canAssign, currentUserId }: any) {
  const { t } = useLang();
  const [showNew, setShowNew] = useState(false);
  const [items, setItems] = useState<any[]>(tasks);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => { setItems(tasks); }, [tasks]);

  const grouped: Record<string, any[]> = {};
  STATUS_COLS.forEach(c => grouped[c.v] = items.filter((x: any) => x.status === c.v));

  const canMove = (task: any) => task.assignee_id === currentUserId || canAssign;

  const moveTask = (id: string, toStatus: string, reason?: string) => {
    setItems(prev => prev.map(x => x.id === id ? { ...x, status: toStatus, blocker_reason: reason ?? x.blocker_reason } : x));
    startTransition(async () => { await updateTaskStatus(id, toStatus, reason); });
  };

  const onDrop = (colV: string) => {
    setOverCol(null);
    const id = draggingId; setDraggingId(null);
    if (!id) return;
    const task = items.find(x => x.id === id);
    if (!task || task.status === colV || !canMove(task)) return;
    let reason: string | undefined;
    if (colV === "blocked") {
      const r = prompt(t("Vướng gì? Ghi rõ để Manager hỗ trợ:")) || "";
      if (!r.trim()) return;
      reason = r.trim();
    }

    if (colV === "done" && laViecHoan(task)) {
      const ld = hoiLyDoHoan();
      if (!ld) return;
      reason = ld;
    }
    moveTask(id, colV, reason);
  };

  return (
    <div>
      {canAssign && (
        <div className="mb-4 flex justify-end">
          <button onClick={() => setShowNew(true)}
            className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold inline-flex items-center gap-2 shadow-sm hover:shadow transition">
            <Plus className="w-4 h-4" /> {t("Giao việc mới")}
          </button>
        </div>
      )}
      {showNew && <NewTaskModal users={users} departments={departments} onClose={() => setShowNew(false)} />}

      <div className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1 snap-x">
        {STATUS_COLS.map(col => {
          const list = grouped[col.v];
          const isOver = overCol === col.v;
          return (
            <section key={col.v}
              onDragOver={e => { e.preventDefault(); if (overCol !== col.v) setOverCol(col.v); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null); }}
              onDrop={() => onDrop(col.v)}
              className={`snap-start shrink-0 w-[300px] flex flex-col rounded-2xl border transition-colors ${
                isOver ? "border-brand-400 bg-brand-50/40 ring-2 ring-brand-200" : "border-gray-200/80 bg-gray-50/70"
              }`}>
              <div className="flex items-center gap-2 px-3.5 pt-3.5 pb-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                <h3 className="text-[13px] font-bold tracking-wide text-gray-700 uppercase">{t(col.l)}</h3>
                <span className="ml-auto min-w-[22px] text-center text-[11px] font-bold text-gray-500 bg-white border border-gray-200 rounded-full px-1.5 py-0.5">
                  {list.length}
                </span>
              </div>
              <div className="h-px mx-3.5 mb-1" style={{ background: `linear-gradient(90deg, ${col.color}33, transparent)` }} />

              <div className="px-2.5 pb-3 pt-1 space-y-2.5 overflow-y-auto min-h-[120px] max-h-[calc(100vh-320px)]">
                {list.map((task: any) => (
                  <TaskCard key={task.id} task={task} currentUserId={currentUserId}
                    canDrag={canMove(task)} dragging={draggingId === task.id}
                    onDragStart={() => setDraggingId(task.id)} onDragEnd={() => setDraggingId(null)}
                    onMove={moveTask} onAckDone={() => {}} />
                ))}
                {list.length === 0 && (
                  <div className={`rounded-xl border border-dashed py-8 text-center text-xs transition-colors ${
                    isOver ? "border-brand-300 text-brand-500" : "border-gray-200 text-gray-300"
                  }`}>
                    {isOver ? t("Thả vào đây") : t("Trống")}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TaskCard({ task, currentUserId, canDrag, dragging, onDragStart, onDragEnd, onMove }: any) {
  const { t } = useLang();
  const [pending, startTransition] = useTransition();
  const [expand, setExpand] = useState(false);
  const isMyTask = task.assignee_id === currentUserId;
  const overdue = task.due_date && task.due_date < new Date().toISOString().slice(0, 10) && task.status !== "done";
  const pr = PRIORITY[task.priority] || PRIORITY.medium;
  const isDeptSummary = !!task.is_dept_summary;
  const progress = task.progress;
  const progressPct = progress?.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const ava = avatarOf(task.assignee?.full_name);

  const move = (s: string) => {
    if (s === "blocked") {
      const r = prompt(t("Vướng gì? Ghi rõ để Manager hỗ trợ:")) || "";
      if (!r.trim()) return;
      startTransition(async () => { await onMove(task.id, s, r.trim()); });
      return;
    }
    if (s === "done" && laViecHoan(task)) {
      const ld = hoiLyDoHoan();
      if (!ld) return;
      startTransition(async () => { await onMove(task.id, s, ld); });
      return;
    }
    startTransition(() => onMove(task.id, s));
  };
  const ack = () => startTransition(async () => { await acknowledgeTask(task.id); });

  return (
    <article
      draggable={canDrag}
      onDragStart={e => { e.dataTransfer.setData("text/plain", task.id); e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onDragEnd={onDragEnd}
      className={`group relative bg-white rounded-xl border shadow-sm hover:shadow-md transition-all overflow-hidden ${
        dragging ? "opacity-40 rotate-[1deg]" : ""
      } ${isDeptSummary ? "border-violet-200" : overdue ? "border-red-200" : "border-gray-200"} ${canDrag ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: isDeptSummary ? "#8B5CF6" : PRIORITY_BAR[task.priority] }} />

      <div className="pl-3.5 pr-3 py-2.5">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${pr.chip}`}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pr.dot }} /> {t(pr.label)}
          </span>
          {isDeptSummary && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-violet-50 text-violet-700">
              <Users className="w-3 h-3" /> {t("Phòng ban")}
            </span>
          )}
          {canDrag && <GripVertical className="w-3.5 h-3.5 text-gray-300 ml-auto opacity-0 group-hover:opacity-100 transition" />}
        </div>

        <div className="font-semibold text-[13px] text-gray-900 leading-snug">{t(task.title)}</div>

        {isDeptSummary && progress && (
          <div className="mt-2">
            <div className="flex justify-between items-center text-[10px] text-violet-700 mb-1 font-semibold">
              <span>{task.target_department?.name || t("Phòng ban")} · {progress.done}/{progress.total}</span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-1.5 bg-violet-100 rounded-full overflow-hidden">
              <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        {!isDeptSummary && task.tienDo && (
          <div className="mt-2" data-testid="tien-do">
            <div className="flex justify-between items-center text-[10px] mb-1 font-semibold text-emerald-700">
              <span className="truncate pr-2">{t(task.tienDo.nhan)}</span>
              <span>{task.tienDo.pct}%</span>
            </div>
            <div className="h-1.5 bg-emerald-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${task.tienDo.that ? "bg-emerald-500" : "bg-emerald-300"}`} style={{ width: `${task.tienDo.pct}%` }} />
            </div>
          </div>
        )}

        {t(task.description) && expand && <p className="text-[12px] text-gray-500 mt-2 whitespace-pre-wrap leading-relaxed">{t(task.description)}</p>}
        {task.blocker_reason && task.status === "blocked" && (
          <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1 flex items-start gap-1">
            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {task.blocker_reason}
          </p>
        )}

        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-1.5 min-w-0">
            {!isDeptSummary && (
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ backgroundColor: ava.color }} title={task.assignee?.full_name}>
                {ava.initials}
              </span>
            )}
            <span className="text-[11px] text-gray-500 truncate">
              {isDeptSummary ? t("Task phòng ban") : (task.assignee?.full_name || "—")}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {task.estimated_hours ? <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400"><Clock className="w-3 h-3" />{task.estimated_hours}h</span> : null}
            {task.due_date && (
              <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${overdue ? "bg-red-50 text-red-600" : "text-gray-500"}`}>
                <CalendarDays className="w-3 h-3" /> {task.due_date.slice(8, 10)}/{task.due_date.slice(5, 7)}
              </span>
            )}
          </div>
        </div>

        {isMyTask && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {!task.acknowledged && task.status === "todo" && (
              <button onClick={ack} disabled={pending} className="text-[11px] px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg font-semibold hover:bg-blue-100 transition">{t("✓ Đã đọc")}</button>
            )}
            {task.status === "todo" && task.acknowledged && (
              <button onClick={() => move("doing")} disabled={pending} className="text-[11px] px-2.5 py-1 bg-blue-600 text-white rounded-lg font-semibold inline-flex items-center gap-1 hover:bg-blue-700 transition"><Play className="w-3 h-3" />{t("Bắt đầu")}</button>
            )}
            {task.status === "doing" && (
              <>
                <button onClick={() => move("done")} disabled={pending} className="text-[11px] px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-semibold inline-flex items-center gap-1 hover:bg-emerald-700 transition"><CheckCircle2 className="w-3 h-3" />{t("Hoàn thành")}</button>
                <button onClick={() => move("blocked")} disabled={pending} className="text-[11px] px-2.5 py-1 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 transition">{t("Vướng")}</button>
              </>
            )}
            {task.status === "blocked" && (
              <button onClick={() => move("doing")} disabled={pending} className="text-[11px] px-2.5 py-1 bg-blue-600 text-white rounded-lg font-semibold inline-flex items-center gap-1 hover:bg-blue-700 transition"><Play className="w-3 h-3" />{t("Tiếp tục")}</button>
            )}
          </div>
        )}

        {t(task.description) && (
          <button onClick={() => setExpand(!expand)} className="text-[10px] text-gray-400 mt-1.5 hover:text-gray-600 transition">
            {expand ? t("Thu gọn ▲") : t("Chi tiết ▼")}
          </button>
        )}
      </div>
    </article>
  );
}

function NewTaskModal({ users, departments, onClose }: any) {
  const { t } = useLang();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");
  const [mode, setMode] = useState<"individual" | "department">("individual");
  const [form, setForm] = useState({
    title: "", description: "", assignee_id: "", department_id: "",
    selected_members: [] as string[], priority: "medium" as const, due_date: "", estimated_hours: 0
  });

  const onDeptChange = (deptId: string) => {
    const dept = departments?.find((d: any) => d.id === deptId);
    setForm({ ...form, department_id: deptId, selected_members: dept?.members.map((m: any) => m.id) || [] });
  };
  const toggleMember = (uid: string) => {
    const s = new Set(form.selected_members); s.has(uid) ? s.delete(uid) : s.add(uid);
    setForm({ ...form, selected_members: Array.from(s) });
  };
  const currentDept = departments?.find((d: any) => d.id === form.department_id);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) { setMsg(t("Cần tiêu đề")); return; }
    if (mode === "individual") {
      if (!form.assignee_id) { setMsg(t("Cần chọn người nhận")); return; }
      startTransition(async () => {
        const res = await createTask({ title: form.title, description: form.description || undefined, assignee_id: form.assignee_id, priority: form.priority, due_date: form.due_date || undefined, estimated_hours: form.estimated_hours || undefined });
        if (res.success) { setMsg(t("Đã giao việc")); setTimeout(onClose, 1000); } else setMsg("" + res.error);
      });
    } else {
      if (!form.department_id) { setMsg(t("Cần chọn phòng ban")); return; }
      if (form.selected_members.length === 0) { setMsg(t("Cần chọn ≥1 nhân sự")); return; }
      startTransition(async () => {
        const res = await createDeptTask({ title: form.title, description: form.description || undefined, department_id: form.department_id, member_ids: form.selected_members, priority: form.priority, due_date: form.due_date || undefined, estimated_hours: form.estimated_hours || undefined });
        if (res.success) { setMsg(`${t("Đã giao việc cho")} ${(res as any).count} ${t("NV trong")} ${currentDept?.name}`); setTimeout(onClose, 1200); } else setMsg("" + (res as any).error);
      });
    }
  };

  const inputCls = "mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition";

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-[2px] z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl max-h-[92vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="border-b border-gray-100 px-5 py-4 flex justify-between items-center">
          <h2 className="font-bold text-gray-900 flex items-center gap-2"><Plus className="w-4 h-4 text-brand-600" /> {t("Giao việc mới")}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-xl">
            <button type="button" onClick={() => setMode("individual")}
              className={`py-2 px-3 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition ${mode === "individual" ? "bg-white shadow-sm text-brand-700" : "text-gray-500 hover:text-gray-700"}`}>
              <User className="w-4 h-4" /> {t("Cá nhân")}
            </button>
            <button type="button" onClick={() => setMode("department")}
              className={`py-2 px-3 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition ${mode === "department" ? "bg-white shadow-sm text-violet-700" : "text-gray-500 hover:text-gray-700"}`}>
              <Users className="w-4 h-4" /> {t("Cả phòng ban")}
            </button>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">{t("Tiêu đề *")}</label>
            <input value={t(form.title)} onChange={e => setForm({ ...form, title: e.target.value })} required autoFocus
              placeholder={t("VD: Liên hệ 20 KH inbox Pancake hôm qua")} className={inputCls} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">{t("Mô tả")}</label>
            <textarea value={t(form.description)} onChange={e => setForm({ ...form, description: e.target.value })} rows={3}
              placeholder={t("Chi tiết yêu cầu, link tài liệu, KPI...")} className={inputCls} />
          </div>

          {mode === "individual" ? (
            <div>
              <label className="text-sm font-medium text-gray-700">{t("Giao cho *")}</label>
              <select required value={form.assignee_id} onChange={e => setForm({ ...form, assignee_id: e.target.value })} className={inputCls}>
                <option value="">{t("— Chọn NV —")}</option>
                {users.map((u: any) => <option key={u.id} value={u.id}>{u.full_name} ({u.position})</option>)}
              </select>
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <label className="text-sm font-medium text-gray-700">{t("Phòng ban *")}</label>
                <select required value={form.department_id} onChange={e => onDeptChange(e.target.value)} className={inputCls}>
                  <option value="">{t("— Chọn phòng ban —")}</option>
                  {departments?.map((d: any) => <option key={d.id} value={d.id}>{d.name} ({d.members.length} {t("NV")})</option>)}
                </select>
              </div>
              {currentDept && (
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
                  <div className="text-xs font-semibold text-violet-900 mb-2 flex justify-between">
                    <span>{t("Phân rã cho")} {form.selected_members.length}/{currentDept.members.length} {t("NV:")}</span>
                    <button type="button" onClick={() => setForm({ ...form, selected_members: currentDept.members.map((m: any) => m.id) })} className="text-violet-600 hover:underline">{t("Chọn tất cả")}</button>
                  </div>
                  <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto">
                    {currentDept.members.map((m: any) => {
                      const checked = form.selected_members.includes(m.id);
                      return (
                        <label key={m.id} className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer text-xs ${checked ? "bg-white shadow-sm" : "hover:bg-violet-100"}`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleMember(m.id)} className="accent-violet-600" />
                          <span className="flex-1"><div className="font-medium">{m.full_name}</div><div className="text-gray-500 text-[10px]">{m.position}</div></span>
                        </label>
                      );
                    })}
                  </div>
                  {currentDept.members.length === 0 && <div className="text-xs text-amber-700">{t("Phòng này chưa có NV nào")}</div>}
                  <div className="text-[10px] text-violet-600 mt-2">{t("Mỗi NV được chọn sẽ nhận 1 task riêng. Manager xem progress N/M done qua task summary.")}</div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">{t("Ưu tiên")}</label>
              <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as any })} className={inputCls}>
                <option value="low">{t("Thấp")}</option>
                <option value="medium">{t("Trung bình")}</option>
                <option value="high">{t("Cao")}</option>
                <option value="urgent">{t("KHẨN")}</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">{t("Deadline")}</label>
              <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">{t("Est. giờ")}</label>
              <input type="number" step={0.5} value={form.estimated_hours} onChange={e => setForm({ ...form, estimated_hours: +e.target.value })} className={inputCls} />
            </div>
          </div>
          {msg && <div className="text-sm text-gray-700">{msg}</div>}
          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition">{t("Huỷ")}</button>
            <button type="submit" disabled={pending}
              className={`px-4 py-2 text-white rounded-lg text-sm font-semibold shadow-sm transition disabled:opacity-60 ${mode === "department" ? "bg-violet-600 hover:bg-violet-700" : "bg-brand-600 hover:bg-brand-700"}`}>
              {pending ? t("Đang gửi...") : mode === "department" ? `${t("Giao cho")} ${form.selected_members.length} ${t("NV")}` : t("Giao việc")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
