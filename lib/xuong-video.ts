export const BUCKET_XUONG = "xuong-video";
export const KHOA_MA = "xuong_video_ma";
export const KHOA_VIEC = "xuong_video:";
export const KHOA_NHIP = "xuong_video_nhip";

export const MANH_BYTES = 40 * 1024 * 1024;
export const CLIP_TOI_DA = 300 * 1024 * 1024;
export const CLIP_TOI_THIEU = 200 * 1024;
export const VIEC_MOI_NGAY = 3;
export const VIEC_DANG_CHO = 5;
export const SO_BAN_TOI_DA = 3;
export const DUOI_CLIP = ["mp4", "mov", "m4v", "webm"] as const;

export type TrangThai = "cho_tai" | "cho_dung" | "dang_dung" | "cho_duyet" | "da_duyet" | "tu_choi" | "loi";
export const NHAN_TRANG_THAI: Record<TrangThai, string> = {
  cho_tai: "Đang tải clip lên",
  cho_dung: "Đang chờ máy dựng",
  dang_dung: "Máy đang dựng",
  cho_duyet: "Đã dựng, chờ ACME duyệt",
  da_duyet: "Đã duyệt",
  tu_choi: "Không đạt",
  loi: "Dựng lỗi",
};

export type MaDaiLy = { id: string; ten: string; bam: string; tao_luc: string; tao_boi?: string; thu_hoi?: string };

export type VideoKetQua = {
  path: string;
  ten: string;
  bytes: number;
  chu: string;
  duyet?: boolean;
};

export type ViecXuong = {
  id: string;
  ma_id: string;
  ten_dai_ly: string;
  tao_luc: string;
  trang_thai: TrangThai;
  san_pham: string;
  y_chinh: string;
  so_ban: number;
  file: { ten: string; duoi: string; bytes: number; manh: number };
  ket_qua?: VideoKetQua[];
  loi?: string;
  lan_thu?: number;
  bat_dau_dung?: string;
  xong_luc?: string;
  duyet_boi?: string;
};

export type ViecCongKhai = {
  id: string; tao_luc: string; trang_thai: TrangThai; san_pham: string; file_ten: string;
  video: { ten: string; url: string }[];
};

export const soManh = (bytes: number) => Math.max(1, Math.ceil(bytes / MANH_BYTES));
export const duongManh = (id: string, i: number) => `nguon/${id}/${String(i).padStart(3, "0")}`;
export const duongKetQua = (id: string, k: number) => `ket-qua/${id}/${k + 1}.mp4`;

export const ngayVN = (iso: string | number | Date) => new Date(new Date(iso).getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);

const gon = (s: unknown, max: number) => String(s ?? "").replace(/[\u0000-\u0008\u000b-\u001f]/g, "").trim().slice(0, max);

export type DauVaoTao = { san_pham: string; y_chinh: string; so_ban: number; ten: string; duoi: string; bytes: number };

export function kiemDauVaoTao(b: any): { ok: true; v: DauVaoTao } | { ok: false; loi: string } {
  if (!b || typeof b !== "object") return { ok: false, loi: "Thiếu thông tin" };
  const san_pham = gon(b.san_pham, 80);
  if (san_pham.length < 2) return { ok: false, loi: "Cần ghi tên sản phẩm trong clip" };
  const y_chinh = gon(b.y_chinh, 600);
  const so_ban = Math.round(Number(b.so_ban));
  if (!(so_ban >= 1 && so_ban <= SO_BAN_TOI_DA)) return { ok: false, loi: `Số bản từ 1 tới ${SO_BAN_TOI_DA}` };
  const ten = gon(b.ten, 120).replace(/[\\/]/g, "_");
  const duoi = (ten.split(".").pop() || "").toLowerCase();
  if (!(DUOI_CLIP as readonly string[]).includes(duoi)) return { ok: false, loi: `Chỉ nhận clip ${DUOI_CLIP.join(", ")}` };
  const bytes = Number(b.bytes);
  if (!Number.isFinite(bytes) || bytes < CLIP_TOI_THIEU) return { ok: false, loi: "Clip quá nhỏ hoặc hỏng" };
  if (bytes > CLIP_TOI_DA) return { ok: false, loi: `Clip nặng quá ${Math.round(CLIP_TOI_DA / 1048576)} MB` };
  return { ok: true, v: { san_pham, y_chinh, so_ban, ten, duoi, bytes } };
}

export function vuotHanMuc(viecCuaMa: Pick<ViecXuong, "tao_luc" | "trang_thai">[], bayGio: Date = new Date()): string | null {
  const hom = ngayVN(bayGio);
  if (viecCuaMa.filter((v) => ngayVN(v.tao_luc) === hom).length >= VIEC_MOI_NGAY) return `Mỗi ngày gửi tối đa ${VIEC_MOI_NGAY} clip`;
  if (viecCuaMa.filter((v) => ["cho_tai", "cho_dung", "dang_dung"].includes(v.trang_thai)).length >= VIEC_DANG_CHO) return "Còn nhiều clip đang chờ dựng, đợi xong rồi gửi tiếp";
  return null;
}

export function trangThaiSauDuyet(kq: VideoKetQua[]): TrangThai {
  if (kq.some((k) => k.duyet === undefined)) return "cho_duyet";
  return kq.some((k) => k.duyet === true) ? "da_duyet" : "tu_choi";
}

export function chuTuSrt(srt: string): string {
  return String(srt || "").split(/\r?\n/).map((d) => d.trim())
    .filter((d) => d && !/^\d+$/.test(d) && !/-->/.test(d)).join(" ").replace(/\s+/g, " ").trim();
}
