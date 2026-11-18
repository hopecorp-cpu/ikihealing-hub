import { leaveDaysInMonth } from "@/lib/nc";

const LOAI_KHONG_LUONG = new Set(["khong_luong", "ra_ngoai"]);

const TEN_LOAI: Record<string, string> = {
  phep: "Nghỉ phép", om: "Nghỉ ốm", khong_luong: "Không lương",
  ra_ngoai: "Ra ngoài", cuoi: "Nghỉ cưới", tang: "Nghỉ tang", thai_san: "Thai sản",
};

export type PhieuTreo = {
  id: string;
  userId: string;
  ten: string;
  loai: string;
  tenLoai: string;
  tuNgay: string;
  denNgay: string;
  soNgay: number;
  anhHuongTien: boolean;
  tuoiNgay: number;
  lyDo: string;
};

const tuoi = (iso?: string | null) =>
  iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 864e5)) : 0;

/**
 * Đọc phiếu nghỉ đang chờ duyệt.
 * @param thang "YYYY-MM" — chỉ lấy phiếu GIAO với tháng đó (dùng khi chốt lương). Bỏ trống = lấy tất.
 */
export async function layPhieuNghiTreo(sb: any, thang?: string): Promise<{ phieu: PhieuTreo[]; loi?: string }> {
  let q = sb.from("leaves")
    .select("id,user_id,type,days,from_date,to_date,reason,created_at")
    .eq("status", "pending");
  if (thang) {
    const [y, m] = thang.split("-").map(Number);
    const cuoiThang = `${thang}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
    q = q.lte("from_date", cuoiThang).or(`to_date.gte.${thang}-01,to_date.is.null`);
  }
  const { data, error } = await q.limit(500);

  if (error) return { phieu: [], loi: `không đọc được bảng leaves: ${error.message}` };

  const rows = (data ?? []) as any[];
  if (!rows.length) return { phieu: [] };

  const ids = [...new Set(rows.map(r => r.user_id))];
  const { data: us } = await sb.from("users").select("id,full_name").in("id", ids);
  const ten = Object.fromEntries(((us ?? []) as any[]).map(u => [u.id, u.full_name]));

  const phieu = rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    ten: ten[r.user_id] || "(không rõ người)",
    loai: r.type,
    tenLoai: TEN_LOAI[r.type] || r.type,
    tuNgay: r.from_date,
    denNgay: r.to_date || r.from_date,
    soNgay: thang ? leaveDaysInMonth(r, thang) : (r.days || 0),
    anhHuongTien: LOAI_KHONG_LUONG.has(r.type),
    tuoiNgay: tuoi(r.created_at),
    lyDo: (r.reason || "").slice(0, 120),
  })).sort((a, b) => b.tuoiNgay - a.tuoiNgay);

  return { phieu };
}

export async function demSuaCongTreo(sb: any): Promise<number | null> {
  const { count, error } = await sb.from("attendance_correction_requests")
    .select("id", { count: "exact", head: true }).eq("status", "pending");
  return error ? null : (count || 0);
}

export function tomTatPhieuTreo(phieu: PhieuTreo[]): string {
  if (!phieu.length) return "không còn phiếu nghỉ nào chờ duyệt";
  const tien = phieu.filter(p => p.anhHuongTien);
  const cu = phieu.filter(p => p.tuoiNgay >= 7).length;
  const ph: string[] = [`${phieu.length} phiếu nghỉ chờ duyệt`];
  if (tien.length) ph.push(`${tien.length} phiếu KHÔNG LƯƠNG (lệch tiền lương nếu bỏ qua)`);
  if (cu) ph.push(`${cu} phiếu treo quá 7 ngày`);
  return ph.join(" · ");
}
