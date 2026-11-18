export type KieuCham = "message" | "call" | "gift";

export const KIEU_CHAM: { ma: KieuCham; nhan: string }[] = [
  { ma: "message", nhan: "Đã nhắn Zalo" },
  { ma: "call", nhan: "Đã gọi điện" },
  { ma: "gift", nhan: "Đã gửi quà / tài liệu" },
];

export type MaPhanHoi = "replied" | "tuvan" | "hen" | "no_reply" | "miss" | "chot" | "tuchoi" | "chua_ket_ban" | "sai_so";

export const PHAN_HOI: { ma: MaPhanHoi; nhan: string; cls: string; trangThai: string | null }[] = [
  { ma: "replied", nhan: "Khách có trả lời", cls: "text-sky-700 bg-sky-50 border-sky-200", trangThai: "contacted" },
  { ma: "tuvan", nhan: "Đang tư vấn", cls: "text-indigo-700 bg-indigo-50 border-indigo-200", trangThai: "caring" },
  { ma: "hen", nhan: "Hẹn lại sau", cls: "text-amber-700 bg-amber-50 border-amber-200", trangThai: "caring" },
  { ma: "chot", nhan: "Đã chốt đơn", cls: "text-emerald-700 bg-emerald-50 border-emerald-200", trangThai: "won" },
  { ma: "no_reply", nhan: "Chưa phản hồi", cls: "text-gray-600 bg-gray-50 border-gray-200", trangThai: null },
  { ma: "miss", nhan: "Gọi không nghe máy", cls: "text-orange-700 bg-orange-50 border-orange-200", trangThai: null },
  { ma: "chua_ket_ban", nhan: "Gọi được, chưa kết bạn Zalo", cls: "text-violet-700 bg-violet-50 border-violet-200", trangThai: "contacted" },
  { ma: "tuchoi", nhan: "Không có nhu cầu", cls: "text-rose-700 bg-rose-50 border-rose-200", trangThai: "lost" },
  { ma: "sai_so", nhan: "Số sai / không liên lạc được", cls: "text-stone-700 bg-stone-50 border-stone-200", trangThai: "lost" },
];

const BAC: Record<string, number> = { new: 0, contacted: 1, caring: 2, won: 3, lost: 3 };
export function napTrangThai(hienTai: string | null | undefined, moi: string | null | undefined): string | null {
  if (!moi) return null;
  if (moi === "won" || moi === "lost") return moi;
  const cu = BAC[String(hienTai || "new")] ?? 0;
  return (BAC[moi] ?? 0) > cu ? moi : null;
}

export function nhanKieu(ma?: string | null) { return KIEU_CHAM.find((k) => k.ma === ma)?.nhan || null; }
export function nhanPhanHoi(ma?: string | null) { return PHAN_HOI.find((p) => p.ma === ma)?.nhan || null; }
export function phanHoiHopLe(ma?: string | null): ma is MaPhanHoi { return PHAN_HOI.some((p) => p.ma === ma); }
export function kieuHopLe(ma?: string | null): ma is KieuCham { return KIEU_CHAM.some((k) => k.ma === ma); }

export function sdt0(p?: string | null): string | null {
  let d = String(p || "").replace(/\D/g, "");
  if (d.startsWith("84")) d = "0" + d.slice(2);
  if (!d.startsWith("0")) d = "0" + d;
  return /^0(3|5|7|8|9)\d{8}$/.test(d) ? d : null;
}

export type DongCham = {
  luc: string;
  kieu: string;
  phanHoi: string | null;
  noiDung: string | null;
  nguoi: string | null;
};

export async function layNhatKyCham(sb: any, sdts: string[], moiKhach = 5): Promise<Record<string, DongCham[]>> {
  const ra: Record<string, DongCham[]> = {};
  const so = [...new Set(sdts.map((s) => sdt0(s)).filter(Boolean))] as string[];
  if (!so.length) return ra;
  const caHaiDang = [...so, ...so.map((s) => "84" + s.slice(1))];
  const { data, error } = await sb
    .from("care_events")
    .select("created_at, customer_phone, kind, outcome, content, sale_name")
    .in("customer_phone", caHaiDang)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  for (const r of (data || []) as any[]) {
    const key = sdt0(r.customer_phone);
    if (!key) continue;
    const ds = (ra[key] ||= []);
    if (ds.length >= moiKhach) continue;
    ds.push({ luc: r.created_at, kieu: r.kind, phanHoi: r.outcome || null, noiDung: r.content || null, nguoi: r.sale_name || null });
  }
  return ra;
}
