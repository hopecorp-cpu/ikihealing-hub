import { laThieuBang, laThieuCot } from "@/lib/to-chuc";

type Dem = { so: number; loi: string | null };

async function dem(sb: any, bang: string, cotChon: string, cotLoc: string, id: string): Promise<Dem> {
  try {

    const { count, error, status } = await sb.from(bang).select(cotChon, { count: "exact" }).eq(cotLoc, id).limit(1);
    if (error) {
      if (laThieuBang(error, status) || laThieuCot(error)) return { so: 0, loi: null };
      return { so: 0, loi: error.message || error.code || "lỗi không rõ" };
    }
    return { so: count ?? 0, loi: null };
  } catch (e: any) {
    return { so: 0, loi: e?.message || "lỗi không rõ" };
  }
}

export type KetQuaKiemXoa = { duocXoa: true } | { duocXoa: false; lyDo: string };

export async function kiemXoaPhong(sb: any, id: string): Promise<KetQuaKiemXoa> {
  const [nguoi, agent, kiemNhiem, con] = await Promise.all([
    dem(sb, "users", "id", "department_id", id),
    dem(sb, "agents", "id", "department_id", id),
    dem(sb, "vai_tro_kiem_nhiem", "id", "department_id", id),
    dem(sb, "departments", "id", "parent_id", id),
  ]);
  const loi = [
    ["người", nguoi], ["agent AI", agent], ["người kiêm nhiệm", kiemNhiem], ["phòng con", con],
  ].filter(([, d]) => (d as Dem).loi) as [string, Dem][];
  if (loi.length > 0) {
    return { duocXoa: false, lyDo: `Chưa xoá: không kiểm được ${loi.map(([ten]) => ten).join(", ")} của phòng (${loi[0][1].loi}). Chưa thay đổi gì, thử lại sau.` };
  }
  const con_lai: string[] = [];
  if (nguoi.so > 0) con_lai.push(`${nguoi.so} người (tính cả người đã nghỉ)`);
  if (agent.so > 0) con_lai.push(`${agent.so} agent AI`);
  if (kiemNhiem.so > 0) con_lai.push(`${kiemNhiem.so} người kiêm nhiệm`);
  if (con.so > 0) con_lai.push(`${con.so} phòng con`);
  if (con_lai.length > 0) {
    return { duocXoa: false, lyDo: `Không xoá được: phòng còn ${con_lai.join(", ")}. Chuyển hết sang phòng khác rồi mới xoá. Chưa thay đổi gì.` };
  }
  return { duocXoa: true };
}

export function loiXoaPhong(error: { code?: string; message?: string }): string {
  if (error.code === "23503") return "Không xoá được: còn dữ liệu khác gắn với phòng này (hợp đồng, hồ sơ, việc…). Chưa thay đổi gì.";
  return `Không xoá được: ${error.message || error.code || "lỗi không rõ"}. Chưa thay đổi gì.`;
}
