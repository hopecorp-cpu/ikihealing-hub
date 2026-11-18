export type NhomDung = "dang_bai" | "nhan_khach" | "quang_cao" | "toan_he";

export const NHOM_DUNG: { ma: NhomDung; ten: string; moTa: string }[] = [
  { ma: "dang_bai", ten: "Đăng bài", moTa: "Chặn mọi lượt đăng công khai: fanpage, video hẹn giờ, đăng chéo." },
  { ma: "nhan_khach", ten: "Máy nhắn khách", moTa: "Chặn bot tự nhắn/trả lời khách. Người tự bấm Gửi vẫn gửi được." },
  { ma: "quang_cao", ten: "Tiền quảng cáo", moTa: "Chặn tăng ngân sách và bật lại chiến dịch. Ngừng/giảm vẫn làm được." },
  { ma: "toan_he", ten: "Toàn hệ thống", moTa: "Dừng cả ba nhóm trên cùng lúc." },
];

export type LanDung = { luc: string; boi: string; lyDo: string };
export type TrangThaiDung = Partial<Record<NhomDung, LanDung>>;
export type NhatKyDung = { luc: string; boi: string; viec: "dung" | "mo"; nhom: NhomDung; lyDo: string };

export const KEY_DUNG = "dung_khan_cap";
export const KEY_NHAT_KY_DUNG = "dung_khan_cap_nhat_ky";
export const NHAT_KY_TOI_DA = 100;

export function docTrangThai(raw: string | null | undefined): TrangThaiDung {
  if (!raw) return {};
  try {
    const j = JSON.parse(raw);
    if (!j || typeof j !== "object" || Array.isArray(j)) return {};
    const out: TrangThaiDung = {};
    for (const n of NHOM_DUNG) {
      const v = j[n.ma];
      if (v && typeof v === "object" && typeof v.luc === "string") out[n.ma] = { luc: v.luc, boi: String(v.boi || ""), lyDo: String(v.lyDo || "") };
    }
    return out;
  } catch { return {}; }
}

export function nhomBiDung(tt: TrangThaiDung, nhom: Exclude<NhomDung, "toan_he">): LanDung | null {
  return tt.toan_he || tt[nhom] || null;
}

export function cauChan(nhom: Exclude<NhomDung, "toan_he">, lan: LanDung): string {
  const ten = NHOM_DUNG.find((n) => n.ma === nhom)?.ten || nhom;
  return `Đang DỪNG KHẨN CẤP (${ten}) từ ${lan.luc.slice(0, 16).replace("T", " ")} bởi ${lan.boi || "?"}: ${lan.lyDo || "không ghi lý do"}`;
}

export const coDangDung = (tt: TrangThaiDung) => NHOM_DUNG.some((n) => !!tt[n.ma]);
