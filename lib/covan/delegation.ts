import { getServiceClient } from "@/lib/supabase-server";
import { getConfigValue } from "@/lib/app-config";
import { callClaude } from "./advisor";
import type { PendingBrief } from "./state";

export const CEO_NAME = "Nguyễn Văn An";
export const TAG = "ai-covan";

export type UserRow = { id: string; full_name: string; position: string | null };

export async function activeUsers(): Promise<UserRow[]> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("users")
    .select("id,full_name,position")
    .eq("active", true);
  if (error) throw new Error(`Đọc users lỗi: ${error.message}`);
  return (data || []) as UserRow[];
}

export async function draftBrief(message: string): Promise<
  { ok: false; error: string } | ({ ok: true } & PendingBrief)
> {
  const users = await activeUsers();
  const roster = users
    .filter((u) => u.full_name !== CEO_NAME)
    .map((u) => `- ${u.full_name} (${u.position || "nhân viên"})`)
    .join("\n");
  const rosterNotes = await getConfigValue("covan_roster_notes").catch(() => null);
  const system =
    "Bạn soạn BRIEF giao việc cho nhân sự công ty. Trả về DUY NHẤT một JSON " +
    "(không markdown) với các khóa: title (ngắn, bắt đầu bằng động từ), " +
    "description (4-6 dòng: Mục tiêu / Việc cụ thể từng bước / Tiêu chí đo " +
    "khi nào tính là XONG / Ghi chú), assignee_name (chọn ĐÚNG 1 tên từ danh " +
    "sách dưới, hợp vai nhất), priority (low|medium|high), due_days (số ngày " +
    "hợp lý để xong, 1-14). KHÔNG bịa tên ngoài danh sách. KHÔNG emoji. " +
    "Tiếng Việt đủ dấu.\n" +
    `Danh sách nhân sự:\n${roster}` +
    (rosterNotes ? `\nGHI CHÚ VAI TRÒ TỪ CEO (TUÂN THỦ TUYỆT ĐỐI khi chọn người):\n${rosterNotes}` : "");

  const raw = await callClaude([{ role: "user", content: message }], system, 2000);
  let brief: Record<string, unknown>;
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("no json");
    brief = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return { ok: false, error: `LLM không trả JSON hợp lệ: ${raw.slice(0, 200)}` };
  }
  const wantName = String(brief.assignee_name || "").toLowerCase();
  const match = users.find((u) => u.full_name.toLowerCase() === wantName);
  if (!match) {
    return { ok: false, error: `Không khớp được người nhận '${String(brief.assignee_name || "")}'` };
  }
  const dueDays = Math.min(14, Math.max(1, Number(brief.due_days) || 3));
  const priority = ["low", "medium", "high"].includes(String(brief.priority))
    ? String(brief.priority)
    : "medium";
  return {
    ok: true,
    title: String(brief.title || "").trim() || "Việc do AI Cố vấn soạn",
    description: String(brief.description || ""),
    assignee_name: match.full_name,
    assignee_id: match.id,
    assignee_position: match.position || "",
    priority,
    due_days: dueDays,
  };
}

export async function createTask(brief: PendingBrief): Promise<
  { ok: false; error: string } | { ok: true; task_id: string; title: string; assignee: string; due_date: string }
> {
  const users = await activeUsers();
  const ceo = users.find((u) => u.full_name === CEO_NAME);
  if (!ceo) return { ok: false, error: "Không tìm thấy user CEO trong ikihealing-hub" };
  const dueDate = new Date(Date.now() + 7 * 3600e3 + (brief.due_days || 3) * 86400e3)
    .toISOString()
    .slice(0, 10);
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("tasks")
    .insert({
      title: `[AI Cố vấn] ${brief.title}`,
      description: brief.description || "",
      assigner_id: ceo.id,
      assignee_id: brief.assignee_id,
      priority: brief.priority || "medium",
      status: "todo",
      due_date: dueDate,
      tags: [TAG],
    })
    .select("id,title,due_date")
    .single();
  if (error || !data) return { ok: false, error: `Ghi tasks lỗi: ${error?.message || "không rõ"}` };
  return {
    ok: true,
    task_id: String(data.id),
    title: data.title as string,
    assignee: brief.assignee_name,
    due_date: data.due_date as string,
  };
}

export type AiTask = {
  id: string;
  title: string;
  status: string;
  assignee: string;
  due_date: string | null;
  acknowledged: boolean | null;
  completed_at: string | null;
};

export async function listAiTasks(): Promise<{ ok: true; tasks: AiTask[] }> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("tasks")
    .select("id,title,status,due_date,assignee_id,acknowledged,completed_at")
    .contains("tags", [TAG])
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(`Đọc tasks lỗi: ${error.message}`);
  const users = await activeUsers();
  const names = new Map(users.map((u) => [u.id, u.full_name]));
  return {
    ok: true,
    tasks: (data || []).map((t) => ({
      id: String(t.id),
      title: t.title as string,
      status: (t.status as string) || "?",
      assignee: names.get(t.assignee_id as string) || "?",
      due_date: (t.due_date as string) || null,
      acknowledged: (t.acknowledged as boolean) ?? null,
      completed_at: (t.completed_at as string) || null,
    })),
  };
}
