"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { chonPhongCanTao, laLoiThieuCot } from "@/lib/to-chuc-seed";
import { kiemXoaPhong, loiXoaPhong } from "@/lib/xoa-phong";
import { buildScoreboard } from "@/lib/dept-scoreboard";
import {
  docToChuc, dungCay, phangCay, taoVong, denTheoPhong, laThieuCot, laThieuBang, type NguoiNut,
} from "@/lib/to-chuc";

async function requireAdmin() {
  const auth = getServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập");
  const sb = getServiceClient();
  const { data: profile } = await sb.from("users").select("role").eq("id", user.id).maybeSingle();
  if (!profile || (profile.role !== "admin" && profile.role !== "ceo")) {
    throw new Error("Chỉ admin được quản lý phòng ban");
  }
  return { sb };
}

export async function createDepartment(input: { name: string; color?: string; manager_id?: string }) {
  const { sb } = await requireAdmin();
  if (!input.name || input.name.length < 2) return { success: false, error: "Tên phòng ban ≥2 ký tự" };

  const { error } = await sb.from("departments").insert({
    name: input.name.trim(),
    color: input.color || "#3B82F6",
    manager_id: input.manager_id || null,
  });
  if (error) return { success: false, error: error.message };
  revalidatePath("/phong-ban");
  revalidatePath("/nhan-su");
  return { success: true };
}

export async function updateDepartment(id: string, input: { name?: string; color?: string; manager_id?: string | null }) {
  const { sb } = await requireAdmin();
  const patch: any = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.color !== undefined) patch.color = input.color;
  if (input.manager_id !== undefined) patch.manager_id = input.manager_id || null;

  const { error } = await sb.from("departments").update(patch).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/phong-ban");
  revalidatePath("/nhan-su");
  return { success: true };
}

export async function deleteDepartment(id: string) {
  const { sb } = await requireAdmin();

  const kiem = await kiemXoaPhong(sb, id);
  if (!kiem.duocXoa) return { success: false, error: kiem.lyDo };
  const { error } = await sb.from("departments").delete().eq("id", id);
  if (error) return { success: false, error: loiXoaPhong(error) };
  revalidatePath("/phong-ban");
  revalidatePath("/nhan-su");
  return { success: true };
}

export async function assignUserToDepartment(user_id: string, department_id: string | null) {
  const { sb } = await requireAdmin();
  const { error } = await sb.from("users").update({ department_id }).eq("id", user_id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/phong-ban");
  revalidatePath("/nhan-su");
  return { success: true };
}

export async function bulkAssignUsers(user_ids: string[], department_id: string | null) {
  const { sb } = await requireAdmin();
  if (user_ids.length === 0) return { success: false, error: "Cần chọn NV" };
  const { error } = await sb.from("users").update({ department_id }).in("id", user_ids);
  if (error) return { success: false, error: error.message };
  revalidatePath("/phong-ban");
  revalidatePath("/nhan-su");
  return { success: true, count: user_ids.length };
}

export async function seedAcmeDepartments() {
  const { sb } = await requireAdmin();

  let coCotMa = true;
  let { data: existing, error: eDoc } = await sb.from("departments").select("name, ma");
  if (laLoiThieuCot(eDoc)) {
    coCotMa = false;
    ({ data: existing, error: eDoc } = await sb.from("departments").select("name"));
  }
  if (eDoc) return { success: false, error: eDoc.message };

  const toInsert = chonPhongCanTao((existing ?? []) as { name: string; ma?: string | null }[]);

  if (toInsert.length === 0) {
    return { success: true, inserted: 0, message: "Đã có đủ phòng ban — không cần seed" };
  }

  const { error } = await sb.from("departments").insert(
    toInsert.map((d) => (coCotMa ? d : { name: d.name, color: d.color })),
  );
  if (error) return { success: false, error: error.message };

  revalidatePath("/phong-ban");
  return { success: true, inserted: toInsert.length, message: `Đã tạo ${toInsert.length} phòng ban mới` };
}

export async function getDepartmentsWithMembers() {
  const { sb } = await requireAdmin();
  const [tc, diem] = await Promise.all([
    docToChuc(sb),
    buildScoreboard().catch(() => null),
  ]);
  const byDept: Record<string, NguoiNut[]> = {};
  const unassigned: NguoiNut[] = [];
  for (const u of tc.nguoi) {
    if (u.department_id) (byDept[u.department_id] ||= []).push(u);
    else unassigned.push(u);
  }
  const den = diem ? denTheoPhong(tc.phong, diem.cards) : {};
  const tenNguoi = new Map(tc.nguoi.map((u) => [u.id, u.full_name]));
  return {
    departments: tc.phong.map((d) => ({ ...d, members: byDept[d.id] || [] })),
    cay: phangCay(dungCay(tc.phong)).map((x) => ({ id: x.phong.id, cap: x.cap })),
    agents: tc.agents,
    kiemNhiem: tc.kiemNhiem.map((k) => ({ ...k, full_name: tenNguoi.get(k.user_id) || "" })),
    den,
    coCotCay: tc.coCotCay,
    coBangAgents: tc.coBangAgents,
    unassigned,
    allUsers: tc.nguoi,
  };
}

export async function updateNutCay(id: string, input: { parent_id: string | null; ma: string | null }) {
  const { sb } = await requireAdmin();
  const ma = (input.ma || "").trim().toUpperCase() || null;
  if (ma && !/^[A-Z0-9-]{1,12}$/.test(ma)) return { success: false, error: "Mã chỉ gồm chữ không dấu, số, gạch nối (tối đa 12 ký tự)" };
  const { data: ds, error: eDoc } = await sb.from("departments").select("id, parent_id");
  if (laThieuCot(eDoc)) return { success: false, error: "Chờ migration 066 (cột parent_id/ma chưa có)" };
  if (eDoc) return { success: false, error: eDoc.message };
  const parent = input.parent_id || null;
  if (taoVong(ds ?? [], id, parent)) return { success: false, error: "Không được chọn cha là chính nó hoặc nút con của nó" };
  const { error } = await sb.from("departments").update({ parent_id: parent, ma }).eq("id", id);
  if (error) return { success: false, error: error.code === "23505" ? `Mã ${ma} đã có phòng khác dùng` : error.message };
  revalidatePath("/phong-ban");
  return { success: true };
}

export async function ganPhongAgent(agentId: string, department_id: string | null) {
  const { sb } = await requireAdmin();
  const { data, error, status } = await sb.from("agents").update({ department_id, updated_at: new Date().toISOString() })
    .eq("id", agentId).select("id");
  if (laThieuBang(error, status)) return { success: false, error: "Chờ migration 067 (bảng agents chưa có)" };
  if (error) return { success: false, error: error.message };
  if (!data || data.length === 0) return { success: false, error: "Không tìm thấy agent" };
  revalidatePath("/phong-ban");
  revalidatePath("/he-dieu-hanh-ai");
  return { success: true };
}
