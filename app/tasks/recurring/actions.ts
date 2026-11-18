"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

async function requireManagerOrAdmin() {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập");
  const sb = getServiceClient();
  const { data: profile } = await sb.from("users").select("id, role").eq("id", user.id).maybeSingle();
  if (!profile || !["admin", "ceo", "manager"].includes(profile.role)) {
    throw new Error("Chỉ Manager/Admin được tạo task lặp lại");
  }
  return { sb, userId: profile.id };
}

export type RecurrenceType = "daily" | "weekdays" | "weekly" | "monthly";

export async function createRecurringTemplate(input: {
  title: string;
  description?: string;
  target_type?: "individual" | "department";
  assignee_id?: string;
  target_department_id?: string;
  priority: "low" | "medium" | "high" | "urgent";
  estimated_hours?: number;
  tags?: string[];
  recurrence_type: RecurrenceType;
  recurrence_day_of_week?: number;
  recurrence_day_of_month?: number;
  due_hours_after_create?: number;
}) {
  const { sb, userId } = await requireManagerOrAdmin();
  if (!input.title || input.title.length < 3) return { success: false, error: "Tiêu đề ≥3 ký tự" };

  const targetType = input.target_type ?? "individual";
  if (targetType === "individual" && !input.assignee_id)
    return { success: false, error: "Cần chọn NV (target=individual)" };
  if (targetType === "department" && !input.target_department_id)
    return { success: false, error: "Cần chọn phòng ban (target=department)" };

  if (input.recurrence_type === "weekly" && !input.recurrence_day_of_week)
    return { success: false, error: "Weekly cần chọn thứ" };
  if (input.recurrence_type === "monthly" && !input.recurrence_day_of_month)
    return { success: false, error: "Monthly cần chọn ngày" };

  const { error } = await sb.from("recurring_task_templates").insert({
    title: input.title,
    description: input.description,
    assignee_id: targetType === "individual" ? input.assignee_id : null,
    target_type: targetType,
    target_department_id: targetType === "department" ? input.target_department_id : null,
    assigner_id: userId,
    priority: input.priority,
    estimated_hours: input.estimated_hours,
    tags: input.tags,
    recurrence_type: input.recurrence_type,
    recurrence_day_of_week: input.recurrence_day_of_week,
    recurrence_day_of_month: input.recurrence_day_of_month,
    due_hours_after_create: input.due_hours_after_create ?? 24,
    active: true,
  });
  if (error) return { success: false, error: error.message };

  revalidatePath("/tasks/recurring");
  return { success: true };
}

export async function toggleTemplateActive(id: string) {
  const { sb } = await requireManagerOrAdmin();
  const { data } = await sb.from("recurring_task_templates").select("active").eq("id", id).maybeSingle();
  if (!data) return { success: false, error: "Không tìm thấy template" };
  const { error } = await sb.from("recurring_task_templates").update({ active: !data.active }).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/tasks/recurring");
  return { success: true, active: !data.active };
}

export async function deleteTemplate(id: string) {
  const { sb } = await requireManagerOrAdmin();
  const { error } = await sb.from("recurring_task_templates").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/tasks/recurring");
  return { success: true };
}

export async function listTemplates() {
  const { sb } = await requireManagerOrAdmin();
  const { data } = await sb.from("recurring_task_templates")
    .select(`
      *,
      assignee:users!recurring_task_templates_assignee_id_fkey(full_name, position),
      assigner:users!recurring_task_templates_assigner_id_fkey(full_name),
      target_department:departments!recurring_task_templates_target_department_id_fkey(name)
    `)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function generateDueRecurringTasks(): Promise<{
  success: boolean;
  generated: number;
  skipped: number;
  error?: string;
}> {

  const sb = getServiceClient();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const dow = today.getDay() === 0 ? 1 : today.getDay() + 1;
  const dom = today.getDate();
  const isWeekday = today.getDay() >= 1 && today.getDay() <= 5;

  const { data: templates, error: fetchErr } = await sb.from("recurring_task_templates")
    .select("*")
    .eq("active", true);
  if (fetchErr) return { success: false, generated: 0, skipped: 0, error: fetchErr.message };

  let generated = 0;
  let skipped = 0;

  for (const t of templates ?? []) {

    if (t.last_generated_date === todayStr) {
      skipped++;
      continue;
    }

    let shouldFire = false;
    switch (t.recurrence_type) {
      case "daily":    shouldFire = true; break;
      case "weekdays": shouldFire = isWeekday; break;
      case "weekly":   shouldFire = t.recurrence_day_of_week === dow; break;
      case "monthly":  shouldFire = t.recurrence_day_of_month === dom; break;
    }
    if (!shouldFire) { skipped++; continue; }

    const dueDate = new Date(today.getTime() + (t.due_hours_after_create || 24) * 3600 * 1000);
    const dueStr = dueDate.toISOString().slice(0, 10);

    const baseFields = {
      title: t.title,
      description: t.description,
      assigner_id: t.assigner_id,
      priority: t.priority,
      due_date: dueStr,
      estimated_hours: t.estimated_hours,
      tags: t.tags,
      status: "todo",
      recurring_template_id: t.id,
    };

    if (t.target_type === "department" && t.target_department_id) {

      const { data: members } = await sb.from("users")
        .select("id").eq("active", true).eq("department_id", t.target_department_id);
      if (!members || members.length === 0) { skipped++; continue; }

      const { data: parent, error: parentErr } = await sb.from("tasks").insert({
        ...baseFields,
        assignee_id: null,
        is_dept_summary: true,
        target_department_id: t.target_department_id,
      }).select("id").maybeSingle();
      if (parentErr || !parent) { skipped++; continue; }

      const childRows = members.map((m: any) => ({
        ...baseFields,
        assignee_id: m.id,
        parent_task_id: parent.id,
      }));
      await sb.from("tasks").insert(childRows);
    } else {

      const { error: insErr } = await sb.from("tasks").insert({
        ...baseFields,
        assignee_id: t.assignee_id,
      });
      if (insErr) { skipped++; continue; }
    }

    await sb.from("recurring_task_templates").update({ last_generated_date: todayStr }).eq("id", t.id);
    generated++;
  }

  revalidatePath("/tasks");
  revalidatePath("/tasks/recurring");
  return { success: true, generated, skipped };
}

export async function manualGenerate() {
  await requireManagerOrAdmin();
  return generateDueRecurringTasks();
}
