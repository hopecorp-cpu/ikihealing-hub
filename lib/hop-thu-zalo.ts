export type HopThuNick = {
  ownId: string;
  sale: string | null;
  tenZalo: string | null;

  song: boolean | null;
  status: string | null;
};

export type HopThuKhach = {
  ownId: string;
  uid: string;
  ten: string;
  phone: string | null;
  phoneNorm: string | null;
  sale: string | null;
  tinCuoiAt: string | null;
  dangCho: boolean;
  soTin: number;
  choGio: number | null;
  cauCuoi: string;
  huongCuoi: "in" | "out" | null;
  laNhom: boolean;
  chuaDoc: number;

  the: TheKhach[];

  tenZalo: string | null;
  ngaySinh: string | null;
  trangThai: string | null;
  laBanBe: boolean;
  nhanSale: string[];

  anh: string | null;

  thuHoiSo: number;
  thuHoiLuc: string | null;
};

export type TheKhach = "vip" | "da-mua" | "mua-lai" | "chua-mua";

export const NHAN_THE: Record<TheKhach, { chu: string; lop: string }> = {
  vip: { chu: "Khách VIP", lop: "bg-amber-100 text-amber-800" },
  "mua-lai": { chu: "Mua lại", lop: "bg-blue-100 text-[#0068FF]" },
  "da-mua": { chu: "Đã mua", lop: "bg-emerald-100 text-emerald-700" },
  "chua-mua": { chu: "Cần chăm sóc", lop: "bg-orange-100 text-orange-700" },
};

export type TongQuanZalo = {
  tongHoiThoai: number;
  soNhom: number;
  soChuaDoc: number;
  choTrongTuan: number;
  choTatCa: number;
  choQua30Ngay: number;
  theoNick: {
    ownId: string; sale: string | null; song: boolean | null; status: string | null;
    hoiThoai: number; cho: number; choTrongTuan: number; choQua30Ngay: number; lauNhatNgay: number | null;
  }[];
  nhomThanhVien: number | null;
  nhomDaDo: number;
};

export type NhomZalo = {
  ownId: string;
  uid: string;
  ten: string;
  sale: string | null;
  soTin: number;
  tinCuoiAt: string | null;
  cauCuoi: string;
  soThanhVien: number | null;
};

export type HoatDong = {
  luc: string | null;
  loai: "don" | "cham" | "goi" | "qua" | "lead";
  tieuDe: string;
  chiTiet: string | null;
  nguoi: string | null;
};

export type HopThuTin = {
  id: string;
  huong: "in" | "out";
  noiDung: string;
  luc: string | null;

  dangGui?: boolean;

  guiLoi?: boolean;

  thuHoi?: { luc: string; boi: string | null } | null;

  media?: { loai: string; daTai: boolean; ten?: string | null; quaTran?: boolean } | null;
};

export const laTinChoGui = (msgId: string) => String(msgId || "").startsWith("app-cho:");
export const laTinGuiLoi = (msgId: string) => String(msgId || "").startsWith("app-loi:");

export type DonCuaKhach = { ngay: string | null; sanPham: string; khachTra: number };

export type HoSoKhach = {
  ten: string;
  phone: string | null;
  sale: string | null;
  tags: string[];
  diemTuVan: number | null;
  nhuCau: string | null;
  soDon: number;
  tongChi: number;
  donGanDay: DonCuaKhach[];
  care: { flow: string | null; ngay: number | null; lanCuoi: string | null; hanKe: string | null; trangThai: string | null } | null;
  lead: { nguon: string | null; trangThai: string | null; giaoLuc: string | null; chamLuc: string | null } | null;
};

export type TrangThaiKho = {
  ok: boolean;
  at: string | null;
  note: string | null;
  gioTre: number | null;
  nick: number | null;
  khach: number | null;
  tin: number | null;
};

const NHAN_LOAI_TIN: Record<string, string> = {
  "chat.photo": "Hình ảnh", "chat.gif": "Ảnh động", "chat.video.msg": "Video",
  "chat.voice": "Ghi âm", "chat.sticker": "Sticker", "chat.location": "Vị trí",
  "chat.recommended": "Thẻ chia sẻ", "chat.link": "Liên kết", "share.file": "Tệp",
};

export function chuCuaTinCuoi(s?: string | null): string {
  const t = String(s || "").trim();
  if (!t) return "";
  if (/^\[.+\]$/.test(t)) return t;

  if (!/^(chat|share)\.[a-z0-9._-]+$/i.test(t)) return t;
  return `[${NHAN_LOAI_TIN[t.toLowerCase()] || "Tin đính kèm"}]`;
}

export function chuanSdt(p?: string | null): string | null {
  if (!p) return null;
  let s = String(p).replace(/[^0-9]/g, "");
  if (!s) return null;
  if (s.startsWith("0")) s = "84" + s.slice(1);
  if (!s.startsWith("84")) s = "84" + s;
  return s.length >= 10 && s.length <= 13 ? s : null;
}

export function gioTu(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.round(((Date.now() - t) / 36e5) * 10) / 10;
}

export function doTre(gio: number | null): string {
  if (gio == null) return "";
  if (gio < 1) return `${Math.max(1, Math.round(gio * 60))} phút`;
  if (gio < 24) return `${Math.round(gio)} giờ`;
  return `${Math.round(gio / 24)} ngày`;
}

export function gioVN(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("vi-VN", {
      hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh",
    });
  } catch { return ""; }
}

export function ngayVN(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("vi-VN", {
      day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh",
    });
  } catch { return ""; }
}

export function tienVN(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return Math.round(n).toLocaleString("vi-VN");
}

export function chuDau(ten?: string | null): string {
  const s = String(ten || "").trim();
  if (!s) return "?";
  const w = s.split(/\s+/).filter(Boolean);
  const c = (w.length > 1 ? w[w.length - 2][0] + w[w.length - 1][0] : s.slice(0, 2));
  return c.toUpperCase();
}

export const TU_MUA = /(giá|bao nhiêu|bao nhiu|mua|đặt|order|lên đơn|ship|giao|còn hàng|combo|thanh toán|chuyển khoản|ck|cod|địa chỉ|hộp|thùng|lấy \d|cho e|cho em|gửi cho)/i;
export const TU_LANH = /(không quan tâm|ko quan tâm|k quan tâm|đừng nhắn|thôi nhé|không cần|ko cần|spam|chặn)/i;

export function chamDiemKhach(k: Pick<HopThuKhach, "dangCho" | "choGio" | "chuaDoc" | "cauCuoi" | "huongCuoi" | "the" | "laBanBe" | "phone" | "nhanSale" | "soTin" | "tinCuoiAt" | "laNhom">): { diem: number; lyDo: string[] } {
  if (k.laNhom) return { diem: 0, lyDo: [] };
  let diem = 20; const lyDo: string[] = [];
  const cau = String(k.cauCuoi || "");
  const gioTuTinCuoi = k.tinCuoiAt ? (Date.now() - Date.parse(k.tinCuoiAt)) / 36e5 : null;

  if (k.huongCuoi === "in" && TU_MUA.test(cau)) { diem += 30; lyDo.push("Khách đang hỏi giá/đặt hàng"); }
  if (k.dangCho && k.choGio != null && k.choGio <= 24) { diem += 20; lyDo.push("Vừa nhắn, đang chờ mình trả lời"); }
  else if (k.dangCho && k.choGio != null && k.choGio <= 24 * 7) { diem += 10; lyDo.push("Đang chờ trả lời trong tuần"); }
  if (k.chuaDoc > 0) { diem += 5; lyDo.push(`${k.chuaDoc} tin chưa đọc`); }
  if (gioTuTinCuoi != null && gioTuTinCuoi <= 48) { diem += 10; lyDo.push("Có tin trong 48 giờ"); }

  if (k.the.includes("mua-lai")) { diem += 15; lyDo.push("Đã mua lại"); }
  else if (k.the.includes("da-mua") || k.the.includes("vip")) { diem += 10; lyDo.push("Đã từng mua"); }
  if (k.the.includes("vip")) { diem += 10; lyDo.push("Khách VIP theo đơn"); }
  if (k.laBanBe) { diem += 5; lyDo.push("Đã kết bạn"); }
  if (k.phone) { diem += 5; lyDo.push("Có SĐT"); }
  if (k.nhanSale.some((n) => /vip|quen|tiềm năng|tiem nang|nóng|nong/i.test(n))) { diem += 10; lyDo.push("Sale gắn nhãn tiềm năng/VIP"); }
  if (k.soTin >= 20) { diem += 5; lyDo.push("Hội thoại dài (từ 20 tin)"); }

  if (TU_LANH.test(cau)) { diem -= 30; lyDo.push("Khách nói không quan tâm"); }
  if (gioTuTinCuoi != null && gioTuTinCuoi > 24 * 60) { diem -= 15; lyDo.push("Im hơn 60 ngày"); }
  else if (gioTuTinCuoi != null && gioTuTinCuoi > 24 * 30) { diem -= 5; lyDo.push("Im hơn 30 ngày"); }

  return { diem: Math.max(0, Math.min(100, diem)), lyDo };
}
export const mucDiem = (d: number): "nong" | "am" | "nguoi" => (d >= 70 ? "nong" : d >= 40 ? "am" : "nguoi");

export type ManhChu = { laLink: boolean; chu: string };
export function tachLink(s: string): ManhChu[] {
  const re = /https?:\/\/[^\s<>"']+/g;
  const ra: ManhChu[] = [];
  let cuoi = 0;
  for (const m of s.matchAll(re)) {
    const tu = m.index ?? 0;
    let link = m[0];

    let bo = 0;
    while (link.length > bo) {
      const c = link[link.length - 1 - bo];
      if (".,;:!?".includes(c)) { bo++; continue; }
      if (c === ")" && !link.slice(0, link.length - bo).includes("(")) { bo++; continue; }
      break;
    }
    if (bo) link = link.slice(0, link.length - bo);
    if (tu > cuoi) ra.push({ laLink: false, chu: s.slice(cuoi, tu) });
    ra.push({ laLink: true, chu: link });
    cuoi = tu + link.length;
  }
  if (cuoi < s.length) ra.push({ laLink: false, chu: s.slice(cuoi) });
  return ra.length ? ra : [{ laLink: false, chu: s }];
}
