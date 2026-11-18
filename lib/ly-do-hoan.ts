export const LY_DO_HOAN = [
  { ma: "doi-y",        ten: "Khách đổi ý / không muốn mua nữa",     nhom: "khach" },
  { ma: "khong-lien-lac", ten: "Không liên lạc được / không nhận hàng", nhom: "khach" },
  { ma: "sai-hang",     ten: "Sai hàng / sai size-màu / hàng lỗi",    nhom: "minh" },
  { ma: "giao-cham",    ten: "Giao chậm, khách không chờ",            nhom: "minh" },
  { ma: "trung-don",    ten: "Trùng đơn / đặt nhầm",                  nhom: "ky-thuat" },
  { ma: "khac",         ten: "Khác (ghi rõ)",                         nhom: "ky-thuat" },
] as const;

export type MaLyDo = (typeof LY_DO_HOAN)[number]["ma"];
export const TEN_NHOM_LY_DO: Record<string, string> = { khach: "Phía khách", minh: "Phía mình", "ky-thuat": "Kỹ thuật / khác" };

const TIEN_TO = "HOÀN:";

export function ghiLyDo(ma: MaLyDo, ghiChu?: string): string {
  return `${TIEN_TO}${ma}${ghiChu?.trim() ? `|${ghiChu.trim().slice(0, 300)}` : ""}`;
}

export function docLyDo(blocker: string | null | undefined): { ma: MaLyDo; ten: string; nhom: string; ghiChu: string } | null {
  const s = String(blocker || "");
  if (!s.startsWith(TIEN_TO)) return null;
  const [ma, ...rest] = s.slice(TIEN_TO.length).split("|");
  const ld = LY_DO_HOAN.find((x) => x.ma === ma);
  if (!ld) return null;
  return { ma: ld.ma, ten: ld.ten, nhom: ld.nhom, ghiChu: rest.join("|") };
}

export function laViecHoan(t: { tags?: string[] | null; title?: string | null; description?: string | null }): boolean {
  const tags = t.tags || [];
  const chu = `${t.title || ""} ${t.description || ""}`;
  return tags.includes("don-jt") && /hoàn|hoan\b|trả hàng|tra hang|không thành công|khong thanh cong|returned/i.test(chu);
}

export type ThongKeHoan = {
  tong: number;
  theoLyDo: Array<{ ma: string; ten: string; nhom: string; so: number }>;
  theoNhom: Array<{ nhom: string; ten: string; so: number; pct: number }>;
  theoSanPham: Array<{ ten: string; so: number }>;
  theoSale: Array<{ ten: string; so: number }>;
  chuaGhiLyDo: number;
};

export async function thongKeHoan(sb: any, tu: string, den: string, dsSanPham: string[] = []): Promise<ThongKeHoan> {
  const { data } = await sb.from("tasks").select("title, description, tags, blocker_reason, assignee_id, completed_at, users:assignee_id(full_name)")
    .contains("tags", ["don-jt"]).eq("status", "done").gte("completed_at", tu).lte("completed_at", `${den}T23:59:59`).limit(2000);
  const viec = ((data || []) as any[]).filter(laViecHoan);
  const kd = (s: any) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const demLyDo: Record<string, number> = {}, demNhom: Record<string, number> = {}, demSP: Record<string, number> = {}, demSale: Record<string, number> = {};
  let chuaGhi = 0;
  for (const v of viec) {
    const ld = docLyDo(v.blocker_reason);
    if (!ld) { chuaGhi++; continue; }
    demLyDo[ld.ma] = (demLyDo[ld.ma] || 0) + 1;
    demNhom[ld.nhom] = (demNhom[ld.nhom] || 0) + 1;
    const sale = v.users?.full_name || "chưa gán";
    demSale[sale] = (demSale[sale] || 0) + 1;
    const chu = kd(`${v.title} ${v.description}`);
    const sp = dsSanPham.find((p) => chu.includes(kd(p))) || "không rõ SP";
    demSP[sp] = (demSP[sp] || 0) + 1;
  }
  const tong = viec.length - chuaGhi;
  return {
    tong,
    theoLyDo: LY_DO_HOAN.map((l) => ({ ma: l.ma, ten: l.ten, nhom: l.nhom, so: demLyDo[l.ma] || 0 })).filter((x) => x.so > 0).sort((a, b) => b.so - a.so),
    theoNhom: Object.entries(demNhom).map(([nhom, so]) => ({ nhom, ten: TEN_NHOM_LY_DO[nhom] || nhom, so, pct: tong ? Math.round((so / tong) * 100) : 0 })).sort((a, b) => b.so - a.so),
    theoSanPham: Object.entries(demSP).map(([ten, so]) => ({ ten, so })).sort((a, b) => b.so - a.so),
    theoSale: Object.entries(demSale).map(([ten, so]) => ({ ten, so })).sort((a, b) => b.so - a.so),
    chuaGhiLyDo: chuaGhi,
  };
}
