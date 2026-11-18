"use client";
import { useState, useTransition } from "react";
import { createRecurringTemplate, toggleTemplateActive, deleteTemplate, manualGenerate } from "./actions";
import { Plus, X, Power, Trash2, Play, Repeat, Calendar, User, Users } from "lucide-react";
import { useLang } from "@/components/lang-provider";

const DOW_LABELS = ["", "CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const RECURRENCE_LABEL = (tpl: any, t: (vi: string) => string) => {
  switch (tpl.recurrence_type) {
    case "daily":    return t("Hằng ngày");
    case "weekdays": return t("T2–T6");
    case "weekly":   return `${t("Hằng tuần ·")} ${DOW_LABELS[tpl.recurrence_day_of_week] || "?"}`;
    case "monthly":  return `${t("Hằng tháng · ngày")} ${tpl.recurrence_day_of_month}`;
    default:         return tpl.recurrence_type;
  }
};

const PRIORITY_BADGE: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

export function RecurringClient({ templates, users, departments }: { templates: any[]; users: any[]; departments?: any[] }) {
  const { t: tDich } = useLang();
  const { t } = useLang();
  const [showNew, setShowNew] = useState(false);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  const onGenerate = () => {
    startTransition(async () => {
      const res = await manualGenerate();
      if (res.success) {
        setMsg({ text: `${t("Sinh")} ${res.generated} ${t("task · skip")} ${res.skipped}`, type: "ok" });
        setTimeout(() => location.reload(), 1500);
      } else {
        setMsg({ text: "" + (res.error || t("Lỗi")), type: "err" });
      }
    });
  };

  const onToggle = (id: string) => {
    startTransition(async () => {
      const res = await toggleTemplateActive(id);
      if (res.success) setMsg({ text: `${t("Đã")} ${res.active ? t("BẬT") : t("TẮT")} template`, type: "ok" });
      else setMsg({ text: "" + (res as any).error, type: "err" });
      setTimeout(() => location.reload(), 600);
    });
  };

  const onDelete = (id: string, title: string) => {
    if (!confirm(`${t("Xoá template")} "${title}"? ${t("Các task đã sinh ra vẫn còn.")}`)) return;
    startTransition(async () => {
      const res = await deleteTemplate(id);
      if (res.success) { setMsg({ text: t("Đã xoá"), type: "ok" }); setTimeout(() => location.reload(), 600); }
      else setMsg({ text: "" + (res as any).error, type: "err" });
    });
  };

  return (
    <div className="space-y-4">
      {msg && (
        <div className={`p-3 rounded text-sm ${msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {msg.text}
        </div>
      )}

      <div className="flex justify-between gap-3 flex-wrap">
        <button onClick={onGenerate} disabled={pending}
          className="px-4 py-2 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50">
          <Play className="w-4 h-4" /> {t("Generate ngay")}
        </button>
        <button onClick={() => setShowNew(true)}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-semibold inline-flex items-center gap-1">
          <Plus className="w-4 h-4" /> {t("Template mới")}
        </button>
      </div>

      {showNew && <NewModal users={users} departments={departments || []} onClose={() => setShowNew(false)} />}

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="text-left p-3">{t("Title")}</th>
              <th className="text-left p-3">{t("Giao cho")}</th>
              <th className="text-left p-3">{t("Lịch lặp")}</th>
              <th className="text-left p-3">{t("Ưu tiên")}</th>
              <th className="text-left p-3">{t("Lần cuối sinh")}</th>
              <th className="text-left p-3">{t("Trạng thái")}</th>
              <th className="text-right p-3 w-32">{t("Thao tác")}</th>
            </tr>
          </thead>
          <tbody>
            {templates.map(tpl => (
              <tr key={tpl.id} className={`border-t border-gray-100 ${!tpl.active ? "opacity-50" : ""}`}>
                <td className="p-3">
                  <div className="font-medium">{tDich(tpl.title)}</div>
                  {tDich(tpl.description) && <div className="text-xs text-gray-500 max-w-[300px] truncate">{tDich(tpl.description)}</div>}
                </td>
                <td className="p-3 text-xs">
                  {tpl.target_type === "department" ? (
                    <div className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
                      <Users className="w-3 h-3" /> {tpl.target_department?.name || "—"}
                    </div>
                  ) : (
                    <>
                      <div className="font-medium">{tpl.assignee?.full_name || "—"}</div>
                      <div className="text-gray-500">{tpl.assignee?.position}</div>
                    </>
                  )}
                </td>
                <td className="p-3 text-xs">
                  <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
                    <Repeat className="w-3 h-3" /> {RECURRENCE_LABEL(tpl, t)}
                  </span>
                  <div className="text-gray-500 mt-0.5">{t("Hết hạn sau")} {tpl.due_hours_after_create}h</div>
                </td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${PRIORITY_BADGE[tpl.priority]}`}>{tpl.priority}</span>
                </td>
                <td className="p-3 text-xs text-gray-600">{tpl.last_generated_date || "—"}</td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${tpl.active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                    {tpl.active ? t("BẬT") : t("TẮT")}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => onToggle(tpl.id)} disabled={pending}
                      title={tpl.active ? t("Tắt") : t("Bật")}
                      className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded">
                      <Power className="w-3 h-3" />
                    </button>
                    <button onClick={() => onDelete(tpl.id, tDich(tpl.title))} disabled={pending}
                      title={t("Xoá")}
                      className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {templates.length === 0 && (
              <tr><td colSpan={7} className="p-12 text-center text-gray-400">
                {t("Chưa có template nào — bấm \"Template mới\" để tạo")}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewModal({ users, departments, onClose }: any) {
  const { t: tDich } = useLang();
  const { t } = useLang();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");
  const [targetType, setTargetType] = useState<"individual" | "department">("individual");
  const [form, setForm] = useState({
    title: "",
    description: "",
    assignee_id: "",
    target_department_id: "",
    priority: "medium" as const,
    estimated_hours: 0,
    recurrence_type: "daily" as "daily" | "weekdays" | "weekly" | "monthly",
    recurrence_day_of_week: 2,
    recurrence_day_of_month: 1,
    due_hours_after_create: 24,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) { setMsg(t("Cần tiêu đề")); return; }
    if (targetType === "individual" && !form.assignee_id) { setMsg(t("Cần chọn NV")); return; }
    if (targetType === "department" && !form.target_department_id) { setMsg(t("Cần chọn phòng ban")); return; }

    startTransition(async () => {
      const res = await createRecurringTemplate({
        title: form.title,
        description: form.description || undefined,
        target_type: targetType,
        assignee_id: targetType === "individual" ? form.assignee_id : undefined,
        target_department_id: targetType === "department" ? form.target_department_id : undefined,
        priority: form.priority,
        estimated_hours: form.estimated_hours || undefined,
        recurrence_type: form.recurrence_type,
        recurrence_day_of_week: form.recurrence_type === "weekly" ? form.recurrence_day_of_week : undefined,
        recurrence_day_of_month: form.recurrence_type === "monthly" ? form.recurrence_day_of_month : undefined,
        due_hours_after_create: form.due_hours_after_create,
      });
      if (res.success) { setMsg(t("Đã tạo template")); setTimeout(() => location.reload(), 800); }
      else setMsg("" + res.error);
    });
  };

  const currentDept = departments?.find((d: any) => d.id === form.target_department_id);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="border-b border-gray-200 p-4 flex justify-between items-center sticky top-0 bg-white">
          <h2 className="font-bold flex items-center gap-2"><Repeat className="w-5 h-5" /> {t("Tạo template lặp lại")}</h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div>
            <label className="text-sm font-medium">{t("Tiêu đề *")}</label>
            <input value={tDich(form.title)} onChange={e => setForm({...form, title: e.target.value})} required
              placeholder={t("VD: Báo cáo doanh số cuối ngày")}
              className="mt-1 w-full p-2 border border-gray-200 rounded text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium">{t("Mô tả")}</label>
            <textarea value={tDich(form.description)} onChange={e => setForm({...form, description: e.target.value})}
              rows={2} placeholder={t("Chi tiết yêu cầu, format báo cáo...")}
              className="mt-1 w-full p-2 border border-gray-200 rounded text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-lg">
            <button type="button" onClick={() => setTargetType("individual")}
              className={`py-2 px-3 rounded-md text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition ${
                targetType === "individual" ? "bg-white shadow text-brand-700" : "text-gray-500 hover:text-gray-700"
              }`}>
              <User className="w-4 h-4" /> {t("Cá nhân")}
            </button>
            <button type="button" onClick={() => setTargetType("department")}
              className={`py-2 px-3 rounded-md text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition ${
                targetType === "department" ? "bg-white shadow text-purple-700" : "text-gray-500 hover:text-gray-700"
              }`}>
              <Users className="w-4 h-4" /> {t("Cả phòng ban")}
            </button>
          </div>

          {targetType === "individual" ? (
            <div>
              <label className="text-sm font-medium">{t("Giao cho *")}</label>
              <select required value={form.assignee_id} onChange={e => setForm({...form, assignee_id: e.target.value})}
                className="mt-1 w-full p-2 border border-gray-200 rounded text-sm">
                <option value="">{t("— Chọn NV —")}</option>
                {users.map((u: any) => <option key={u.id} value={u.id}>{u.full_name} ({u.position})</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium">{t("Phòng ban *")}</label>
              <select required value={form.target_department_id} onChange={e => setForm({...form, target_department_id: e.target.value})}
                className="mt-1 w-full p-2 border border-gray-200 rounded text-sm">
                <option value="">{t("— Chọn phòng ban —")}</option>
                {departments?.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name} ({d.members.length} {t("NV")})</option>
                ))}
              </select>
              {currentDept && (
                <div className="mt-2 text-[11px] bg-purple-50 border border-purple-200 rounded p-2">
                  <b className="text-purple-700">{t("Mỗi lần sinh sẽ tạo")} {currentDept.members.length} task</b>
                  <div className="text-purple-600 mt-0.5">
                    {t("cho:")} {currentDept.members.map((m: any) => m.full_name).join(", ")}
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-sm font-medium">{t("Ưu tiên")}</label>
            <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value as any})}
              className="mt-1 w-full p-2 border border-gray-200 rounded text-sm">
              <option value="low">{t("Thấp")}</option>
              <option value="medium">{t("Trung bình")}</option>
              <option value="high">{t("Cao")}</option>
              <option value="urgent">{t("KHẨN")}</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium flex items-center gap-1"><Calendar className="w-3 h-3" /> {t("Lịch lặp")}</label>
            <select value={form.recurrence_type} onChange={e => setForm({...form, recurrence_type: e.target.value as any})}
              className="mt-1 w-full p-2 border border-gray-200 rounded text-sm">
              <option value="daily">{t("Hằng ngày")}</option>
              <option value="weekdays">{t("Các ngày trong tuần (T2–T6)")}</option>
              <option value="weekly">{t("Hằng tuần (chọn thứ)")}</option>
              <option value="monthly">{t("Hằng tháng (chọn ngày)")}</option>
            </select>
          </div>

          {form.recurrence_type === "weekly" && (
            <div>
              <label className="text-sm font-medium">{t("Thứ trong tuần")}</label>
              <select value={form.recurrence_day_of_week} onChange={e => setForm({...form, recurrence_day_of_week: +e.target.value})}
                className="mt-1 w-full p-2 border border-gray-200 rounded text-sm">
                <option value={2}>{t("Thứ 2")}</option>
                <option value={3}>{t("Thứ 3")}</option>
                <option value={4}>{t("Thứ 4")}</option>
                <option value={5}>{t("Thứ 5")}</option>
                <option value={6}>{t("Thứ 6")}</option>
                <option value={7}>{t("Thứ 7")}</option>
                <option value={1}>{t("Chủ nhật")}</option>
              </select>
            </div>
          )}

          {form.recurrence_type === "monthly" && (
            <div>
              <label className="text-sm font-medium">{t("Ngày trong tháng")}</label>
              <input type="number" min={1} max={31} value={form.recurrence_day_of_month}
                onChange={e => setForm({...form, recurrence_day_of_month: +e.target.value})}
                className="mt-1 w-full p-2 border border-gray-200 rounded text-sm" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">{t("Hết hạn sau (giờ)")}</label>
              <input type="number" min={1} max={720} value={form.due_hours_after_create}
                onChange={e => setForm({...form, due_hours_after_create: +e.target.value})}
                className="mt-1 w-full p-2 border border-gray-200 rounded text-sm" />
              <div className="text-[10px] text-gray-500 mt-0.5">{t("VD 8 = ngày sinh task 06:00 → hết hạn 14:00")}</div>
            </div>
            <div>
              <label className="text-sm font-medium">{t("Est. hours")}</label>
              <input type="number" min={0} step={0.5} value={form.estimated_hours}
                onChange={e => setForm({...form, estimated_hours: +e.target.value})}
                className="mt-1 w-full p-2 border border-gray-200 rounded text-sm" />
            </div>
          </div>

          {msg && <div className="text-sm">{msg}</div>}

          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-200 rounded text-sm">{t("Huỷ")}</button>
            <button type="submit" disabled={pending}
              className="px-4 py-2 bg-brand-600 text-white rounded text-sm font-semibold disabled:opacity-50">
              {pending ? t("Đang tạo...") : t("Tạo template")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
