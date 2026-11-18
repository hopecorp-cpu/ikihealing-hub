"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { duyetViecMay } from "@/lib/viec-may";
import { revalidatePath } from "next/cache";

async function getUserId() {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  return user?.id ?? null;
}

async function getUserWithRole() {
  const uid = await getUserId();
  if (!uid) return null;
  const sb = getServiceClient();
  const { data } = await sb.from("users").select("id, role, full_name").eq("id", uid).maybeSingle();
  return data;
}

export async function createTask(input: {
  title: string;
  description?: string;
  assignee_id: string;
  priority: "low" | "medium" | "high" | "urgent";
  due_date?: string;
  estimated_hours?: number;
  tags?: string[];
}) {
  const me = await getUserWithRole();
  if (!me) return { success: false, error: "Chưa đăng nhập" };
  if (me.role !== "admin" && me.role !== "ceo" && me.role !== "manager")
    return { success: false, error: "Chỉ Manager/Admin được giao việc" };

  const sb = getServiceClient();
  const { error } = await sb.from("tasks").insert({
    title: input.title,
    description: input.description,
    assigner_id: me.id,
    assignee_id: input.assignee_id,
    priority: input.priority,
    due_date: input.due_date,
    estimated_hours: input.estimated_hours,
    tags: input.tags,
    status: "todo"
  });
  if (error) return { success: false, error: error.message };
  revalidatePath("/tasks");
  return { success: true };
}

export async function createTaskFromAI(input: { title: string; area?: string; who?: string; impact?: string }) {
  const me = await getUserWithRole();
  if (!me) return { success: false, error: "Chưa đăng nhập" };
  if (me.role !== "admin" && me.role !== "ceo" && me.role !== "manager")
    return { success: false, error: "Chỉ Manager/Admin được giao việc" };
  const sb = getServiceClient();
  const desc = [
    input.who ? `Đề xuất giao cho: ${input.who}` : "",
    input.impact ? `Tác động kỳ vọng: ${input.impact}` : "",
    "— Nguồn: Giám đốc Kinh doanh AI",
  ].filter(Boolean).join("\n");
  const { error } = await sb.from("tasks").insert({
    title: input.title,
    description: desc,
    assigner_id: me.id,
    assignee_id: me.id,
    priority: "high",
    tags: ["giám-đốc-ai", ...(input.area ? [input.area] : [])],
    status: "todo",
  });
  if (error) return { success: false, error: error.message };
  revalidatePath("/tasks");
  return { success: true };
}

export async function createDeptTask(input: {
  title: string;
  description?: string;
  department_id: string;
  member_ids: string[];
  priority: "low" | "medium" | "high" | "urgent";
  due_date?: string;
  estimated_hours?: number;
  tags?: string[];
}) {
  const me = await getUserWithRole();
  if (!me) return { success: false, error: "Chưa đăng nhập" };
  if (me.role !== "admin" && me.role !== "ceo" && me.role !== "manager")
    return { success: false, error: "Chỉ Manager/Admin được giao việc" };
  if (!input.member_ids || input.member_ids.length === 0)
    return { success: false, error: "Cần chọn ≥1 nhân viên" };

  const sb = getServiceClient();

  const { data: parent, error: parentErr } = await sb.from("tasks").insert({
    title: input.title,
    description: input.description,
    assigner_id: me.id,
    assignee_id: null,
    priority: input.priority,
    due_date: input.due_date,
    estimated_hours: input.estimated_hours,
    tags: input.tags,
    status: "todo",
    is_dept_summary: true,
    target_department_id: input.department_id,
  }).select("id").maybeSingle();

  if (parentErr || !parent) return { success: false, error: parentErr?.message || "Không tạo được parent task" };

  const childRows = input.member_ids.map(uid => ({
    title: input.title,
    description: input.description,
    assigner_id: me.id,
    assignee_id: uid,
    priority: input.priority,
    due_date: input.due_date,
    estimated_hours: input.estimated_hours,
    tags: input.tags,
    status: "todo",
    parent_task_id: parent.id,
  }));

  const { error: childErr } = await sb.from("tasks").insert(childRows);
  if (childErr) {

    await sb.from("tasks").delete().eq("id", parent.id);
    return { success: false, error: childErr.message };
  }

  revalidatePath("/tasks");
  return { success: true, parent_id: parent.id, count: childRows.length };
}

export async function listDepartmentsWithMembers() {
  const sb = getServiceClient();
  const [{ data: depts }, { data: users }] = await Promise.all([
    sb.from("departments").select("id, name").order("name"),
    sb.from("users").select("id, full_name, position, department_id").eq("active", true).order("full_name"),
  ]);
  const byDept: Record<string, any[]> = {};
  for (const u of users ?? []) {
    if (!u.department_id) continue;
    (byDept[u.department_id] ||= []).push(u);
  }
  return (depts ?? []).map((d: any) => ({
    ...d,
    members: byDept[d.id] || [],
  }));
}

export async function updateTaskStatus(taskId: string, status: string, blocker_reason?: string) {
  const me = await getUserWithRole();
  if (!me) return { success: false, error: "Chưa đăng nhập" };

  const sb = getServiceClient();
  const updates: any = { status, updated_at: new Date().toISOString() };
  if (status === "done") updates.completed_at = new Date().toISOString();
  if (status === "blocked") updates.blocker_reason = blocker_reason;

  if (status === "done" && blocker_reason?.startsWith("HOÀN:")) updates.blocker_reason = blocker_reason;

  const { error } = await sb.from("tasks").update(updates).eq("id", taskId);
  if (error) return { success: false, error: error.message };

  const { data: thisTask } = await sb.from("tasks").select("parent_task_id").eq("id", taskId).maybeSingle();
  if (thisTask?.parent_task_id) {
    await syncParentStatus(sb, thisTask.parent_task_id);
  }

  revalidatePath("/tasks");
  return { success: true };
}

async function syncParentStatus(sb: any, parentId: string) {
  const { data: children } = await sb.from("tasks").select("status").eq("parent_task_id", parentId);
  if (!children || children.length === 0) return;

  const statuses = children.map((c: any) => c.status);
  let parentStatus: string;
  if (statuses.every((s: string) => s === "done")) parentStatus = "done";
  else if (statuses.some((s: string) => s === "blocked")) parentStatus = "blocked";
  else if (statuses.some((s: string) => s === "doing" || s === "review")) parentStatus = "doing";
  else parentStatus = "todo";

  const updates: any = { status: parentStatus, updated_at: new Date().toISOString() };
  if (parentStatus === "done") updates.completed_at = new Date().toISOString();
  await sb.from("tasks").update(updates).eq("id", parentId);
}

export async function acknowledgeTask(taskId: string) {
  const me = await getUserWithRole();
  if (!me) return { success: false, error: "Chưa đăng nhập" };
  const sb = getServiceClient();
  const { error } = await sb.from("tasks").update({
    acknowledged: true,
    acknowledged_at: new Date().toISOString()
  }).eq("id", taskId).eq("assignee_id", me.id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/tasks");
  return { success: true };
}

export async function addTaskComment(taskId: string, content: string) {
  const me = await getUserWithRole();
  if (!me) return { success: false, error: "Chưa đăng nhập" };
  const sb = getServiceClient();
  const { error } = await sb.from("task_comments").insert({
    task_id: taskId,
    user_id: me.id,
    content
  });
  if (error) return { success: false, error: error.message };
  revalidatePath("/tasks");
  return { success: true };
}

export async function duyetViecMayAction(id: number, ok: boolean, ghiChu?: string) {
  const me = await getUserWithRole();
  if (!me) return { success: false, error: "Chưa đăng nhập" };
  if (me.role !== "admin" && me.role !== "ceo" && me.role !== "manager")
    return { success: false, error: "Chỉ Manager/Admin được duyệt" };
  const done = await duyetViecMay(id, me.id, ok, ghiChu);
  if (!done) return { success: false, error: "Không duyệt được — có thể ai đó đã duyệt trước" };
  revalidatePath("/tasks");
  return { success: true };
}
