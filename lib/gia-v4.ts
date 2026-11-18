export const GIA_V4_PHIEN_BAN = "v4";
export const GIA_V4_HIEU_LUC_TU = "2026-10-01";
export const GIA_V3_HET_HIEU_LUC = "2026-10-01";

export type TrangThaiGia = "hieu_luc" | "de_xuat" | "chua_chot" | "ban_het_ton" | "thay_the_boi_de_xuat" | "noi_bo";
export type CheDoSan = "chan" | "canh_bao" | "tat";
export type MaSanPham = "dam" | "dam-hu-500" | "san-pham-b" | "san-pham-c";

export const NHAN_TRANG_THAI: Record<TrangThaiGia, string> = {
  hieu_luc: "Hiệu lực",
  de_xuat: "Đề xuất — chờ CEO duyệt",
  chua_chot: "Chưa chốt",
  ban_het_ton: "Bán đến hết tồn",
  thay_the_boi_de_xuat: "Bậc v3 — chỉ đối chiếu nội bộ",
  noi_bo: "Nội bộ — chưa áp dụng",
};
export const NHAN_CHE_DO: Record<CheDoSan, string> = { chan: "Chặn đơn dưới sàn", canh_bao: "Chỉ cảnh báo", tat: "Không xét" };

export type BacDaiLy = { ten: string; pct: number; trangThai: TrangThaiGia; ghiChu?: string };

export type SanPhamGia = {
  ma: MaSanPham;
  ten: string;
  quyCach: string;

  niemYet: number | null;

  niemYetUngVien?: number[];
  trangThai: TrangThaiGia;
  ghiChu?: string;

  san: { gia: number | null; cheDo: CheDoSan; trangThai: TrangThaiGia; ghiChu?: string };

  daiLy: BacDaiLy[];

  droppii?: { hoaHongSellerPct: number; giaGiaoPct: number | null; trangThai: TrangThaiGia; ghiChu?: string };
};

const BAC_TRA: BacDaiLy[] = [
  { ten: "Cộng tác viên", pct: 20, trangThai: "hieu_luc" },
  { ten: "Đại lý", pct: 30, trangThai: "hieu_luc" },
];

const HE_SO_SAN_TRA = 1.1;
export const sanTraKichBanB = (niemYet: number): number => Math.round(niemYet * (1 - BAC_TRA[0].pct / 100) * HE_SO_SAN_TRA);

const BAC_DAM: BacDaiLy[] = [
  { ten: "Cộng tác viên", pct: 15, trangThai: "hieu_luc" },
  { ten: "Đại lý", pct: 25, trangThai: "hieu_luc" },
];

export const SAN_PHAM_V4: SanPhamGia[] = [
  {
    ma: "dam", ten: "Sản phẩm A", quyCach: "hộp",
    niemYet: 500_000, trangThai: "hieu_luc",
    san: { gia: 450_000, cheDo: "chan", trangThai: "hieu_luc" },
    daiLy: BAC_DAM,
    droppii: { hoaHongSellerPct: 10, giaGiaoPct: null, trangThai: "de_xuat" },
  },
  {
    ma: "dam-hu-500", ten: "Sản phẩm A (quy cách cũ)", quyCach: "hũ",
    niemYet: 480_000, trangThai: "ban_het_ton",
    san: { gia: 450_000, cheDo: "chan", trangThai: "hieu_luc" },
    daiLy: BAC_DAM,
  },
  {
    ma: "san-pham-b", ten: "Sản phẩm B", quyCach: "hộp",
    niemYet: 200_000, trangThai: "hieu_luc",
    san: { gia: sanTraKichBanB(200_000), cheDo: "chan", trangThai: "hieu_luc" },
    daiLy: BAC_TRA,
    droppii: { hoaHongSellerPct: 20, giaGiaoPct: 60, trangThai: "hieu_luc" },
  },
  {
    ma: "san-pham-c", ten: "Sản phẩm C", quyCach: "hộp",
    niemYet: 150_000, trangThai: "hieu_luc",
    san: { gia: sanTraKichBanB(150_000), cheDo: "chan", trangThai: "hieu_luc" },
    daiLy: BAC_TRA,
    droppii: { hoaHongSellerPct: 20, giaGiaoPct: 60, trangThai: "hieu_luc" },
  },
];

export const DAI_LY_V4 = {
  trangThai: "hieu_luc" as TrangThaiGia,
  thuongQuy: { nguongTrieu: [100, 200, 300], pct: [2, 4, 6] },
  hanCongNoNgay: 30,
};

export const NPP_DAM_NOI_BO = {
  trangThai: "noi_bo" as TrangThaiGia,
  chietKhauCungPct: 30,
  giaNhap: 350_000,
  docQuyenVungTuTrieuQuy: 300,
  ghiChu: "Ví dụ chính sách nhà phân phối, chưa áp dụng.",
};

export const GIOI_THIEU_V4 = {
  trangThai: "hieu_luc" as TrangThaiGia,
  donDauPct: 10,
  muaLaiPct: 5,
  tinhTren: "giá trước VAT",
};

export const B2B_BAC_SO_LUONG = ["20–49", "50–99", "100–299", "300+"] as const;
export type BoQuaB2B = { ma: string; ten: string; ruot: string; gia: (number | null)[]; trangThai: TrangThaiGia };
export const B2B_V4: BoQuaB2B[] = [
  { ma: "combo-1", ten: "Combo mẫu 1", ruot: "Sản phẩm A + Sản phẩm B", gia: [650_000, 620_000, 590_000, 560_000], trangThai: "hieu_luc" },
  { ma: "combo-2", ten: "Combo mẫu 2", ruot: "Sản phẩm B + Sản phẩm C", gia: [320_000, 300_000, 280_000, 260_000], trangThai: "hieu_luc" },
];

export const giaNhap = (niemYet: number | null, pct: number): number | null =>
  niemYet == null ? null : Math.round(niemYet * (1 - pct / 100));

export function sanPhamV4(ma: MaSanPham): SanPhamGia {
  const sp = SAN_PHAM_V4.find((s) => s.ma === ma);
  if (!sp) throw new Error("gia-v4: không có sản phẩm " + ma);
  return sp;
}

export function maSanPhamTuTen(ten: string): MaSanPham | null {
  const t = String(ten || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
  if (/ca ?phe|caf+e|cof+ee/.test(t)) return null;
  if (/san pham c|mau a/.test(t)) return "san-pham-c";
  if (/san pham b|mau b/.test(t)) return "san-pham-b";
  if (/san pham a|dam/.test(t)) return /hu\b|500 ?g/.test(t) ? "dam-hu-500" : "dam";
  return null;
}

export function giaNhapThapNhat(sp: SanPhamGia): number | null {
  const bac = sp.daiLy.filter((b) => b.trangThai === "hieu_luc");
  if (!bac.length || sp.niemYet == null) return null;
  return giaNhap(sp.niemYet, Math.max(...bac.map((b) => b.pct)));
}

export type KenhDon = "le" | "dai_ly" | "b2b" | "khong_ro";
export type MucXet = "chan" | "canh_bao" | "ok";
export type KetQuaXet = {
  muc: MucXet;
  ma: MaSanPham | null;
  donGia: number | null;

  donGiaHieuDung?: number | null;
  san: number | null;
  co: TrangThaiGia[];
  lyDo: string;

  ngoaiLe?: string;
};

export const NGOAI_LE_QUA_SAN: { ma: MaSanPham; ten: string; donGiaTu: number; hieuLuc: boolean; ghiChu: string }[] = [];

export function xetGiaDon(o: {
  ma: MaSanPham | null; donGia: number | null; kenh?: KenhDon;

  sl?: number | null;

  quaGiaVon?: number | null;
}): KetQuaXet {
  const kenh: KenhDon = o.kenh || "le";
  const ok = (lyDo: string, ma: MaSanPham | null = o.ma, san: number | null = null, co: TrangThaiGia[] = [], them: Partial<KetQuaXet> = {}): KetQuaXet =>
    ({ muc: "ok", ma, donGia: o.donGia, donGiaHieuDung: o.donGia, san, co, lyDo, ...them });
  if (!o.ma) return ok("không thuộc 3 dòng chủ lực");
  if (o.donGia == null || !(o.donGia > 0)) return ok("không xác định được đơn giá");
  const sp = sanPhamV4(o.ma);
  const co: TrangThaiGia[] = [];
  if (sp.trangThai === "chua_chot" || sp.niemYet == null) co.push("chua_chot");
  if (sp.san.trangThai === "de_xuat") co.push("de_xuat");

  const sl = Math.max(1, Number(o.sl) || 1);
  const quaTong = Math.max(0, Number(o.quaGiaVon) || 0);
  const ngoaiLe = quaTong > 0 ? NGOAI_LE_QUA_SAN.find((n) => n.hieuLuc && n.ma === o.ma && o.donGia! >= n.donGiaTu) : undefined;
  const donGiaHD = quaTong > 0 && !ngoaiLe ? Math.round(o.donGia - quaTong / sl) : o.donGia;
  const them: Partial<KetQuaXet> = { donGiaHieuDung: donGiaHD, ...(ngoaiLe ? { ngoaiLe: ngoaiLe.ten } : {}) };
  const chuQua = quaTong > 0 && !ngoaiLe ? ` (đã trừ giá vốn quà, còn ${donGiaHD.toLocaleString("vi-VN")}đ/đơn vị)` : ngoaiLe ? ` (${ngoaiLe.ten} — không trừ quà)` : "";

  if (kenh !== "le") {
    const nhap = giaNhapThapNhat(sp);
    if (nhap == null) return ok("kênh " + kenh + ": chưa có giá nhập hiệu lực để so", o.ma, null, co, them);
    if (donGiaHD < nhap) return { muc: "canh_bao", ma: o.ma, donGia: o.donGia, san: nhap, co, lyDo: `kênh ${kenh}: đơn giá thấp hơn giá nhập thấp nhất ${nhap.toLocaleString("vi-VN")}đ${chuQua} — kiểm hợp đồng`, ...them };
    return ok("kênh " + kenh + ": không thấp hơn giá nhập", o.ma, nhap, co, them);
  }

  const san = sp.san;
  if (san.cheDo === "tat" || san.gia == null) return ok("sàn tắt", o.ma, san.gia, co, them);
  if (donGiaHD >= san.gia) return ok("không dưới sàn" + chuQua, o.ma, san.gia, co, them);

  const chanDuoc = san.cheDo === "chan" && san.trangThai === "hieu_luc" && sp.niemYet != null;
  return {
    muc: chanDuoc ? "chan" : "canh_bao", ma: o.ma, donGia: o.donGia, san: san.gia, co, ...them,
    lyDo: `${sp.ten}: đơn giá ${o.donGia.toLocaleString("vi-VN")}đ${chuQua} dưới sàn ${san.gia.toLocaleString("vi-VN")}đ`
      + (chanDuoc ? "" : co.includes("chua_chot") ? " (giá chưa chốt — chỉ cảnh báo)" : san.trangThai === "de_xuat" ? " (sàn chưa duyệt — chỉ cảnh báo)" : " (chế độ cảnh báo)"),
  };
}

export const GHI_DE_SAN_LY_DO_TOI_THIEU = 10;
export function ghiDeSan(o: { kq: KetQuaXet; lyDo?: string | null; nguoi?: string | null; luc?: Date }): { ok: boolean; nhan: string | null; loi: string | null } {
  if (o.kq.muc !== "chan") return { ok: true, nhan: null, loi: null };
  const lyDo = String(o.lyDo || "").replace(/\s+/g, " ").trim();
  if (lyDo.length < GHI_DE_SAN_LY_DO_TOI_THIEU) {
    return { ok: false, nhan: null, loi: `${o.kq.lyDo}. Đơn dưới sàn bị CHẶN — admin muốn ghi đè phải ghi lý do (ít nhất ${GHI_DE_SAN_LY_DO_TOI_THIEU} ký tự).` };
  }
  const luc = o.luc || new Date();
  const gioVN = new Date(luc.getTime() + 7 * 3600e3).toISOString().slice(0, 16).replace("T", " ");
  return { ok: true, loi: null, nhan: `[GHI ĐÈ SÀN v4: ${lyDo.slice(0, 160)} · bởi ${String(o.nguoi || "?").trim() || "?"} · ${gioVN} VN · ${o.kq.lyDo}]` };
}

export type DongHangDon = { ten?: string | null; sl?: number | null; thanh_tien?: number | null };

export function xetDonSo(o: {
  san_pham?: DongHangDon[] | null; khach_tra?: number | null; kenh?: KenhDon;

  quaGiaVon?: number | null;
}): KetQuaXet {
  const sp = Array.isArray(o.san_pham) ? o.san_pham : [];
  const dongChuLuc = sp.map((d) => ({ d, ma: maSanPhamTuTen(d.ten || "") })).filter((x) => x.ma);
  const coTien = sp.some((d) => Number(d.thanh_tien) > 0);
  let xau: KetQuaXet = { muc: "ok", ma: null, donGia: null, san: null, co: [], lyDo: "không có dòng hàng chủ lực" };
  const thuTu: Record<MucXet, number> = { ok: 0, canh_bao: 1, chan: 2 };
  const dongXet: { ma: MaSanPham; sl: number; tien: number }[] = [];
  for (const { d, ma } of dongChuLuc) {
    const sl = Math.max(1, Number(d.sl) || 1);
    let tien = Number(d.thanh_tien) || 0;
    if (!(tien > 0)) {
      if (coTien || dongChuLuc.length !== 1) continue;
      tien = Number(o.khach_tra) || 0;
      if (!(tien > 0)) continue;
    }
    dongXet.push({ ma: ma!, sl, tien });
  }
  const quaTong = Math.max(0, Number(o.quaGiaVon) || 0);
  const dongQua = quaTong > 0 && dongXet.length ? dongXet.reduce((a, b) => (b.tien > a.tien ? b : a)) : null;
  for (const x of dongXet) {
    const kq = xetGiaDon({ ma: x.ma, donGia: Math.round(x.tien / x.sl), kenh: o.kenh, sl: x.sl, quaGiaVon: x === dongQua ? quaTong : 0 });
    if (thuTu[kq.muc] > thuTu[xau.muc] || (xau.ma == null && kq.ma)) xau = kq;
  }
  return xau;
}

export type DongBangGia = {
  ma: MaSanPham | null;
  sanPham: string; quyCach: string; kenh: string; bac: string;
  chietKhauPct: number | null; gia: number | null; trangThai: TrangThaiGia; ghiChu: string;
};

export function bangGiaV4(): DongBangGia[] {
  const out: DongBangGia[] = [];
  for (const sp of SAN_PHAM_V4) {
    const goc = { ma: sp.ma, sanPham: sp.ten, quyCach: sp.quyCach };
    out.push({ ...goc, kenh: "Bán lẻ", bac: "Niêm yết", chietKhauPct: null, gia: sp.niemYet, trangThai: sp.trangThai,
      ghiChu: sp.niemYet == null && sp.niemYetUngVien ? "Đang cân nhắc " + sp.niemYetUngVien.map((n) => n.toLocaleString("vi-VN")).join(" / ") + ". " + (sp.ghiChu || "") : sp.ghiChu || "" });
    if (sp.san.cheDo !== "tat" || sp.san.gia != null) {
      out.push({ ...goc, kenh: "Bán lẻ", bac: "Sàn công khai (" + NHAN_CHE_DO[sp.san.cheDo] + ")", chietKhauPct: null, gia: sp.san.gia, trangThai: sp.san.trangThai, ghiChu: sp.san.ghiChu || "" });
    }
    if (sp.ma !== "dam-hu-500") {
      for (const b of sp.daiLy) {
        if (b.trangThai === "thay_the_boi_de_xuat" || b.trangThai === "noi_bo") continue;
        out.push({ ...goc, kenh: "Đại lý", bac: b.ten, chietKhauPct: b.pct, gia: giaNhap(sp.niemYet, b.pct), trangThai: b.trangThai, ghiChu: b.ghiChu || (sp.niemYet == null ? "Tính khi có niêm yết" : "") });
      }

      if (sp.droppii) {
        out.push({ ...goc, kenh: "Droppii", bac: `Hoa hồng seller ${sp.droppii.hoaHongSellerPct}%`, chietKhauPct: sp.droppii.giaGiaoPct, gia: sp.droppii.giaGiaoPct == null ? null : giaNhap(sp.niemYet, 100 - sp.droppii.giaGiaoPct), trangThai: sp.droppii.trangThai, ghiChu: (sp.droppii.giaGiaoPct != null ? "Giá giao = niêm yết × " + sp.droppii.giaGiaoPct + "%. " : "") + (sp.droppii.ghiChu || "") });
      }
    }
  }
  out.push({ ma: null, sanPham: "Mọi sản phẩm", quyCach: "", kenh: "Giới thiệu (app CTV)", bac: `Đơn đầu ${GIOI_THIEU_V4.donDauPct}% · mua lại ${GIOI_THIEU_V4.muaLaiPct}%`, chietKhauPct: null, gia: null, trangThai: GIOI_THIEU_V4.trangThai, ghiChu: "Tính trên " + GIOI_THIEU_V4.tinhTren + ". Chương trình riêng, không trộn với đại lý." });
  for (const b of B2B_V4) {
    b.gia.forEach((g, i) => {
      out.push({ ma: null, sanPham: "Bộ quà " + b.ten, quyCach: b.ruot, kenh: "B2B quà tặng", bac: B2B_BAC_SO_LUONG[i] + " bộ", chietKhauPct: null, gia: g, trangThai: b.trangThai, ghiChu: g == null ? "Không cao hơn combo lẻ đang bán — chưa đặt giá" : "" });
    });
  }
  return out;
}

export function choCeoChot(): string[] {
  const ra: string[] = [];
  for (const sp of SAN_PHAM_V4) {
    if (sp.niemYet == null) ra.push(`${sp.ten}: chốt giá niêm yết (${(sp.niemYetUngVien || []).map((n) => n.toLocaleString("vi-VN")).join(" / ")}).`);
    if (sp.san.trangThai === "de_xuat" && sp.san.gia != null) ra.push(`${sp.ten}: duyệt sàn bán lẻ ${sp.san.gia.toLocaleString("vi-VN")}đ (đang chỉ cảnh báo).`);
    if (sp.droppii?.trangThai === "de_xuat") ra.push(`${sp.ten}: Droppii — ${sp.droppii.giaGiaoPct == null ? "chưa nêu giá giao" : "duyệt giá giao " + sp.droppii.giaGiaoPct + "%"} (hoa hồng seller ${sp.droppii.hoaHongSellerPct}% đang đề xuất).`);
  }
  return ra;
}
