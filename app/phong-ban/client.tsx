"use client";
import { useState, useTransition } from "react";
import {
  createDepartment, updateDepartment, deleteDepartment,
  assignUserToDepartment, bulkAssignUsers, seedAcmeDepartments, updateNutCay, ganPhongAgent
} from "./actions";
import { Plus, Edit2, Trash2, Sprout, Users, UserPlus, Save, X, ChevronDown, ChevronUp, Bot } from "lucide-react";
import { useLang } from "@/components/lang-provider";

type Dept = {
  id: string;
  name: string;
  color: string | null;
  manager_id: string | null;
  manager?: { id: string; full_name: string } | null;
  parent_id: string | null;
  ma: string | null;
  members: Array<{ id: string; full_name: string; position: string | null; role: string }>;
};

type Agent = { id: string; ten: string; loai: string; department_id: string | null; trang_thai: string | null; ghi_chu: string | null };
type KiemNhiem = { user_id: string; department_id: string; vai_tro: string; ca: string | null; full_name: string };
type Den = Record<string, { light: string; note?: string }>;

const MAU_DEN: Record<string, string> = { green: "bg-emerald-500", yellow: "bg-amber-400", red: "bg-red-500", gray: "bg-gray-300" };
const TEN_LOAI_AGENT: Record<string, string> = { phong: "Phòng AI", tro_ly: "Trợ lý", router: "Điều phối", bot: "Bot", may: "Máy" };
const tenVaiTro = (v: string) => (v === "truc_cskh" ? "kiêm trực CSKH" : `kiêm ${v.replace(/_/g, " ")}`);

type User = { id: string; full_name: string; position: string | null; role: string; department_id: string | null };

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#6B7280", "#DC2626"];

export function PhongBanClient({ departments, unassigned, allUsers, cay, agents, kiemNhiem, den, coCotCay, coBangAgents }: {
  departments: Dept[]; unassigned: User[]; allUsers: User[];
  cay: { id: string; cap: number }[]; agents: Agent[]; kiemNhiem: KiemNhiem[]; den: Den;
  coCotCay: boolean; coBangAgents: boolean;
}) {
  const { t } = useLang();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bulkAssignTarget, setBulkAssignTarget] = useState<string | null>(null);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [expandedDept, setExpandedDept] = useState<string | null>(null);

  const showMsg = (text: string, type: "ok" | "err") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3000);
  };

  const reload = () => setTimeout(() => location.reload(), 600);

  const deptById = new Map(departments.map((d) => [d.id, d]));
  const agentChuaGan = agents.filter((a) => !a.department_id || !deptById.has(a.department_id));

  const onMoveAgent = (agentId: string, deptId: string | null) => {
    startTransition(async () => {
      const res = await ganPhongAgent(agentId, deptId);
      if (res.success) { showMsg(t("Đã gắn agent vào phòng"), "ok"); reload(); }
      else showMsg("" + (res as any).error, "err");
    });
  };

  const onSeed = () => {
    if (!confirm(t("Seed 7 phòng ban chuẩn ACME? (BDH · KD · MKT · CSKH · KHO · TC · PL)"))) return;
    startTransition(async () => {
      const res = await seedAcmeDepartments();
      if (res.success) { showMsg(res.message || `${t("Đã seed")} ${res.inserted}`, "ok"); reload(); }
      else showMsg("" + (res as any).error, "err");
    });
  };

  const onDelete = (d: Dept) => {

    if (d.members.length > 0) {
      showMsg(`${t("Không xoá được: phòng")} "${d.name}" ${t("còn")} ${d.members.length} ${t("người. Chuyển hết sang phòng khác rồi mới xoá.")}`, "err");
      return;
    }
    if (!confirm(`${t("Xoá phòng")} "${d.name}"? ${t("Chỉ xoá được khi phòng không còn người, agent, người kiêm nhiệm hay phòng con.")}`)) return;
    startTransition(async () => {
      const res = await deleteDepartment(d.id);
      if (res.success) { showMsg(t("Đã xoá"), "ok"); reload(); }
      else showMsg("" + (res as any).error, "err");
    });
  };

  const onAssign = (userId: string, deptId: string | null) => {
    startTransition(async () => {
      const res = await assignUserToDepartment(userId, deptId);
      if (res.success) { showMsg(t("Đã gán phòng"), "ok"); reload(); }
      else showMsg("" + (res as any).error, "err");
    });
  };

  const onBulkAssign = () => {
    if (!bulkAssignTarget || bulkSelected.size === 0) return;
    startTransition(async () => {
      const res = await bulkAssignUsers(Array.from(bulkSelected), bulkAssignTarget);
      if (res.success) {
        showMsg(`${t("Gán")} ${res.count} ${t("NV vào phòng")}`, "ok");
        setBulkSelected(new Set());
        setBulkAssignTarget(null);
        reload();
      } else showMsg("" + (res as any).error, "err");
    });
  };

  const toggleBulk = (uid: string) => {
    const s = new Set(bulkSelected);
    s.has(uid) ? s.delete(uid) : s.add(uid);
    setBulkSelected(s);
  };

  return (
    <div className="space-y-6">
      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {msg.text}
        </div>
      )}

      <div className="flex justify-between gap-3 flex-wrap">
        <div className="flex gap-2">
          <button onClick={() => setShowNewModal(true)}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-semibold inline-flex items-center gap-1">
            <Plus className="w-4 h-4" /> {t("Tạo phòng ban")}
          </button>
          {departments.length === 0 && (
            <button onClick={onSeed} disabled={pending}
              className="px-4 py-2 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-semibold inline-flex items-center gap-1">
              <Sprout className="w-4 h-4" /> {t("Seed 7 phòng ban chuẩn ACME")}
            </button>
          )}
        </div>
        <div className="text-xs text-gray-500 self-center">
          {departments.length} {t("phòng")} · {allUsers.length} {t("NV")} · {unassigned.length} {t("chưa phân phòng")}
        </div>
      </div>

      {showNewModal && <NewDeptModal allUsers={allUsers} onClose={() => setShowNewModal(false)} />}

      {!coCotCay && (
        <div className="p-3 rounded-lg text-sm bg-gray-50 border border-gray-200 text-gray-600">
          {t("Cây phòng ban đang hiện phẳng: chờ migration 066 (cột phòng cha, mã phòng). Chưa sửa được phòng cha và mã.")}
        </div>
      )}

      <div className="space-y-3">
        {cay.map(({ id, cap }) => {
          const d = deptById.get(id);
          if (!d) return null;
          return (
            <div key={d.id} style={{ marginLeft: cap * 28 }} className={cap > 0 ? "border-l-2 border-gray-200 pl-3" : ""}>
              <DeptCard
                dept={d}
                allUsers={allUsers}
                isEditing={editingId === d.id}
                isExpanded={expandedDept === d.id}
                onEdit={() => setEditingId(d.id)}
                onCloseEdit={() => setEditingId(null)}
                onToggleExpand={() => setExpandedDept(expandedDept === d.id ? null : d.id)}
                onDelete={() => onDelete(d)}
                onUnassign={(uid: string) => onAssign(uid, null)}
                onMoveTo={(uid: string, newDeptId: string | null) => onAssign(uid, newDeptId)}
                onMoveAgent={onMoveAgent}
                departments={departments}
                agents={agents.filter((a) => a.department_id === d.id)}
                kiemNhiem={kiemNhiem.filter((k) => k.department_id === d.id)}
                den={den[d.id]}
                coCotCay={coCotCay}
                coBangAgents={coBangAgents}
                pending={pending}
              />
            </div>
          );
        })}
        {departments.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-12 text-center text-gray-500">
            {t("Chưa có phòng ban — bấm \"Seed 7 phòng ban chuẩn ACME\" để bắt đầu nhanh")}
          </div>
        )}
      </div>

      {agentChuaGan.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-1">
            <Bot className="w-5 h-5 text-brand-600" />
            {agentChuaGan.length} {t("agent AI chưa gắn phòng")}
          </h3>
          {!coBangAgents && (
            <div className="text-xs text-gray-500 mb-3">
              {t("Danh sách lấy từ bản đồ máy trong code. Chờ migration 067 (bảng agents) mới gắn phòng được.")}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
            {agentChuaGan.map((a) => (
              <AgentRow key={a.id} agent={a} departments={departments} disabled={!coBangAgents || pending} onMove={onMoveAgent} />
            ))}
          </div>
        </div>
      )}

      {unassigned.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-xl p-5">
          <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
            <h3 className="font-bold text-amber-800 flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              {unassigned.length} {t("NV chưa thuộc phòng ban nào")}
            </h3>
            {bulkSelected.size > 0 && (
              <div className="flex items-center gap-2">
                <select value={bulkAssignTarget || ""} onChange={e => setBulkAssignTarget(e.target.value)}
                  className="p-2 border border-gray-200 rounded text-sm">
                  <option value="">{t("— Gán vào phòng —")}</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <button onClick={onBulkAssign} disabled={!bulkAssignTarget || pending}
                  className="px-3 py-2 bg-emerald-600 text-white rounded text-sm font-semibold disabled:opacity-50">
                  {t("Gán")} {bulkSelected.size} {t("NV")}
                </button>
                <button onClick={() => setBulkSelected(new Set())}
                  className="text-sm text-gray-500 hover:text-gray-700">{t("Bỏ chọn")}</button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {unassigned.map(u => (
              <label key={u.id} className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${
                bulkSelected.has(u.id) ? "bg-emerald-100 border-emerald-300" : "bg-white border-amber-200"
              }`}>
                <input type="checkbox" checked={bulkSelected.has(u.id)} onChange={() => toggleBulk(u.id)} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{u.full_name}</div>
                  <div className="text-xs text-gray-500 truncate">{u.position || "—"}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AgentRow({ agent, departments, disabled, onMove }: {
  agent: Agent; departments: Dept[]; disabled: boolean; onMove: (agentId: string, deptId: string | null) => void;
}) {
  const { t } = useLang();
  return (
    <div className="flex items-center justify-between gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate flex items-center gap-1.5">
          <Bot className="w-3.5 h-3.5 text-gray-500 shrink-0" /> {t(agent.ten)}
        </div>
        <div className="text-xs text-gray-500 truncate">
          {t(TEN_LOAI_AGENT[agent.loai]) || agent.loai}{agent.ghi_chu ? ` · ${agent.ghi_chu}` : ""}
        </div>
      </div>
      <select value={agent.department_id || ""} disabled={disabled}
        onChange={(e) => onMove(agent.id, e.target.value || null)}
        title={disabled ? t("Chờ migration 067") : t("Gắn vào phòng")}
        className="text-xs p-1 border border-gray-200 rounded disabled:opacity-50">
        <option value="">{t("— Chưa gắn phòng —")}</option>
        {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
    </div>
  );
}

function DeptCard({
  dept, allUsers, isEditing, isExpanded, onEdit, onCloseEdit, onToggleExpand, onDelete, onUnassign, onMoveTo, onMoveAgent,
  departments, agents, kiemNhiem, den, coCotCay, coBangAgents, pending
}: any) {
  const { t } = useLang();
  const [pendingEdit, startEdit] = useTransition();
  const [form, setForm] = useState({
    name: dept.name, color: dept.color, manager_id: dept.manager_id || "", parent_id: dept.parent_id || "", ma: dept.ma || "",
  });

  const saveEdit = () => {
    startEdit(async () => {
      const res = await updateDepartment(dept.id, {
        name: form.name,
        color: form.color,
        manager_id: form.manager_id || null,
      });
      if (!res.success) { alert("" + (res as any).error); return; }
      if (coCotCay && (form.parent_id !== (dept.parent_id || "") || form.ma !== (dept.ma || ""))) {
        const r2 = await updateNutCay(dept.id, { parent_id: form.parent_id || null, ma: form.ma || null });
        if (!r2.success) { alert("" + (r2 as any).error); return; }
      }
      onCloseEdit(); setTimeout(() => location.reload(), 600);
    });
  };

  if (isEditing) {
    return (
      <div className="bg-white border-2 border-brand-300 rounded-xl p-4 ring-2 ring-brand-100">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">{t("Tên phòng ban")}</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full p-2 border border-gray-200 rounded text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium">{t("Trưởng phòng")}</label>
            <select value={form.manager_id} onChange={e => setForm({ ...form, manager_id: e.target.value })}
              className="mt-1 w-full p-2 border border-gray-200 rounded text-sm">
              <option value="">{t("— Không có —")}</option>
              {allUsers.map((u: any) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium">{t("Phòng cha")}</label>
              <select value={form.parent_id} disabled={!coCotCay} onChange={e => setForm({ ...form, parent_id: e.target.value })}
                className="mt-1 w-full p-2 border border-gray-200 rounded text-sm disabled:opacity-50">
                <option value="">{t("— Gốc (không có cha) —")}</option>
                {departments.filter((d: any) => d.id !== dept.id).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">{t("Mã phòng")}</label>
              <input value={form.ma} disabled={!coCotCay} onChange={e => setForm({ ...form, ma: e.target.value })}
                placeholder="VD: MKT" className="mt-1 w-full p-2 border border-gray-200 rounded text-sm disabled:opacity-50" />
            </div>
            {!coCotCay && (
              <div className="col-span-2 text-xs text-gray-500">{t("Chờ migration 066: chưa sửa được phòng cha và mã.")}</div>
            )}
          </div>
          <div>
            <label className="text-xs font-medium">{t("Màu")}</label>
            <div className="flex gap-1 mt-1">
              {COLORS.map(c => (
                <button key={c} onClick={() => setForm({ ...form, color: c })}
                  className={`w-7 h-7 rounded-md border-2 transition ${form.color === c ? "border-gray-900 scale-110" : "border-white"}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2 border-t">
            <button onClick={saveEdit} disabled={pendingEdit}
              className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded text-sm font-semibold inline-flex items-center justify-center gap-1">
              <Save className="w-3 h-3" /> {t("Lưu")}
            </button>
            <button onClick={onCloseEdit} className="px-3 py-2 border border-gray-200 rounded text-sm">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center text-lg shrink-0"
            style={{ backgroundColor: dept.color + "22", color: dept.color }}>

          </div>
          <div className="min-w-0">
            <div className="font-bold text-base truncate flex items-center gap-2">
              {den && (
                <span title={t(den.note) || ""} className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${MAU_DEN[den.light] || MAU_DEN.gray}`} />
              )}
              <span className="truncate">{dept.name}</span>
              {dept.ma && <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-1.5 rounded">{dept.ma}</span>}
            </div>
            <div className="text-xs text-gray-500">
              {dept.members.length} {t("nhân viên")}
              {agents.length > 0 && <> · {agents.length} {t("agent AI")}</>}
              {kiemNhiem.length > 0 && <> · {kiemNhiem.length} {t("kiêm nhiệm")}</>}
              {dept.manager?.full_name && <> · {t("Trưởng:")} <b>{dept.manager.full_name}</b></>}
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} title={t("Sửa")} className="p-1.5 hover:bg-gray-100 rounded">
            <Edit2 className="w-3.5 h-3.5 text-gray-600" />
          </button>
          <button onClick={onDelete} title={t("Xoá")} className="p-1.5 hover:bg-red-50 rounded">
            <Trash2 className="w-3.5 h-3.5 text-red-600" />
          </button>
          <button onClick={onToggleExpand} className="p-1.5 hover:bg-gray-100 rounded">
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
          {dept.members.length === 0 ? (
            <div className="text-xs text-gray-400">{t("Chưa có NV nào")}</div>
          ) : (
            dept.members.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between gap-2 p-2 rounded hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{m.full_name}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {m.position || "—"}
                    <span className={`ml-2 inline-block px-1.5 py-0 rounded text-[10px] ${
                      m.role === "admin" || m.role === "ceo" ? "bg-red-100 text-red-700" :
                      m.role === "manager" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                    }`}>{m.role}</span>
                  </div>
                </div>
                <select onChange={e => onMoveTo(m.id, e.target.value || null)} value={dept.id}
                  disabled={pending}
                  className="text-xs p-1 border border-gray-200 rounded">
                  <option value={dept.id}>{dept.name}</option>
                  {departments.filter((d: any) => d.id !== dept.id).map((d: any) => (
                    <option key={d.id} value={d.id}>→ {d.name}</option>
                  ))}
                  <option value="">{t("→ Bỏ phòng")}</option>
                </select>
              </div>
            ))
          )}
          {kiemNhiem.length > 0 && (
            <div className="pt-2">
              <div className="text-xs font-semibold text-gray-600 mb-1">{t("Người kiêm nhiệm")}</div>
              {kiemNhiem.map((k: KiemNhiem) => (
                <div key={k.user_id + k.vai_tro} className="text-sm p-2 rounded hover:bg-gray-50">
                  {k.full_name || t("(người đã nghỉ)")} <span className="text-xs text-gray-500">· {t(tenVaiTro(k.vai_tro))}{k.ca ? ` (${t("ca")} ${k.ca})` : ""}</span>
                </div>
              ))}
            </div>
          )}
          {agents.length > 0 && (
            <div className="pt-2 space-y-1.5">
              <div className="text-xs font-semibold text-gray-600">{t("Agent AI")}</div>
              {agents.map((a: Agent) => (
                <AgentRow key={a.id} agent={a} departments={departments} disabled={!coBangAgents || pending} onMove={onMoveAgent} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NewDeptModal({ allUsers, onClose }: any) {
  const { t } = useLang();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", color: COLORS[0], manager_id: "" });
  const [msg, setMsg] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setMsg(t("Cần tên phòng ban")); return; }
    startTransition(async () => {
      const res = await createDepartment({
        name: form.name,
        color: form.color,
        manager_id: form.manager_id || undefined,
      });
      if (res.success) { setMsg(t("Đã tạo")); setTimeout(() => location.reload(), 600); }
      else setMsg("" + res.error);
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="border-b border-gray-200 p-4 flex justify-between items-center">
          <h2 className="font-bold">{t("Tạo phòng ban mới")}</h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div>
            <label className="text-sm font-medium">{t("Tên phòng ban *")}</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
              placeholder={t("VD: Sales — Đạm Mẫu")}
              className="mt-1 w-full p-2 border border-gray-200 rounded text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium">{t("Trưởng phòng (tuỳ chọn)")}</label>
            <select value={form.manager_id} onChange={e => setForm({ ...form, manager_id: e.target.value })}
              className="mt-1 w-full p-2 border border-gray-200 rounded text-sm">
              <option value="">{t("— Không có —")}</option>
              {allUsers.map((u: any) => <option key={u.id} value={u.id}>{u.full_name} ({u.position})</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">{t("Màu")}</label>
            <div className="flex gap-2 mt-1">
              {COLORS.map(c => (
                <button type="button" key={c} onClick={() => setForm({ ...form, color: c })}
                  className={`w-9 h-9 rounded-md border-2 transition ${form.color === c ? "border-gray-900 scale-110" : "border-white"}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          {msg && <div className="text-sm">{msg}</div>}
          <div className="flex justify-end gap-2 pt-3 border-t">
            <button type="button" onClick={onClose} className="px-3 py-1.5 border rounded text-sm">{t("Huỷ")}</button>
            <button type="submit" disabled={pending}
              className="px-4 py-1.5 bg-brand-600 text-white rounded text-sm font-semibold disabled:opacity-50">
              {pending ? t("Đang tạo...") : t("Tạo")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
