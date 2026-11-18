"use server";

import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

async function getMe() {
  const { data: { user } } = await getServerClient().auth.getUser();
  if (!user) return null;
  const { data } = await getServiceClient().from("users").select("id, role, full_name").eq("id", user.id).maybeSingle();
  return data;
}

export type GoiGiao = {
  phong: string;
  tieuDe: string;
  chiTieu: string;
  viec: string[];
  memberIds: string[];
};

export async function giaoChienDich(input: {
  tenChienDich: string;
  hanChot: string;
  goi: GoiGiao[];
}) {
  const me = await getMe();
  if (!me) return { success: false, error: "Chưa đăng nhập" };
  if (me.role !== "admin" && me.role !== "ceo" && me.role !== "manager")
    return { success: false, error: "Chỉ CEO/Manager được giao chiến dịch" };

  const sb = getServiceClient();
  const { data: depts } = await sb.from("departments").select("id, name");
  const idTheoTen = new Map((depts ?? []).map((d: any) => [d.name, d.id]));

  const ketQua: { phong: string; ok: boolean; soNguoi: number; loi?: string }[] = [];

  for (const g of input.goi) {
    if (!g.memberIds.length) { ketQua.push({ phong: g.phong, ok: false, soNguoi: 0, loi: "Không ai được chọn" }); continue; }
    const deptId = idTheoTen.get(g.phong);
    if (!deptId) { ketQua.push({ phong: g.phong, ok: false, soNguoi: 0, loi: "Không tìm thấy phòng ban" }); continue; }

    const moTa = [`CHỈ TIÊU: ${g.chiTieu}`, "", "Đầu việc:", ...g.viec.map((v) => `- ${v}`)].join("\n");

    const { data: parent, error: eParent } = await sb.from("tasks").insert({
      title: g.tieuDe,
      description: moTa,
      assigner_id: me.id,
      assignee_id: null,
      priority: "high",
      due_date: input.hanChot,
      status: "todo",
      is_dept_summary: true,
      target_department_id: deptId,
      tags: ["chien-dich", input.tenChienDich.slice(0, 40)],
    }).select("id").single();

    if (eParent || !parent) { ketQua.push({ phong: g.phong, ok: false, soNguoi: 0, loi: eParent?.message || "Không tạo được thẻ cha" }); continue; }

    const con = g.memberIds.map((uid) => ({
      title: g.tieuDe,
      description: moTa,
      assigner_id: me.id,
      assignee_id: uid,
      priority: "high",
      due_date: input.hanChot,
      status: "todo",
      parent_task_id: parent.id,
      target_department_id: deptId,
      tags: ["chien-dich", input.tenChienDich.slice(0, 40)],
    }));
    const { error: eCon } = await sb.from("tasks").insert(con);
    if (eCon) { ketQua.push({ phong: g.phong, ok: false, soNguoi: 0, loi: eCon.message }); continue; }

    ketQua.push({ phong: g.phong, ok: true, soNguoi: g.memberIds.length });
  }

  revalidatePath("/tasks");
  revalidatePath("/bo-chien-dich");
  const hong = ketQua.filter((k) => !k.ok);
  return { success: hong.length === 0, ketQua, error: hong.length ? `${hong.length} phòng chưa giao được` : undefined };
}
