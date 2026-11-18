import { DAI_LY_V4, NPP_DAM_NOI_BO, SAN_PHAM_V4, sanPhamV4, giaNhap, type MaSanPham, type TrangThaiGia } from "@/lib/gia-v4";
import type { Dealer, DealerCommit } from "@/lib/dealers";

export type LoaiDaiLy = "Đại lý" | "NPP đạm";
export const LOAI_DAI_LY: LoaiDaiLy[] = ["Đại lý", "NPP đạm"];

export const BAC_CHON = ["CTV / Khởi động", "Đại lý", "Đại lý Trọng điểm", "Nhà phân phối"] as const;

export type DaiLy = Dealer & {
  loai?: LoaiDaiLy;
  vung?: string;
  doc_quyen_vung?: boolean;
  doc_quyen_tu?: string;

  chiet_khau_ghi_de?: Partial<Record<MaSanPham, { pct: number; ly_do: string }>>;
};

export type DaiLyClient = Omit<DaiLy, "cccd">;

export function boCccd(d: DaiLy): DaiLyClient {
  const { cccd: _bo, ...con } = d;
  void _bo;
  return con;
}

export type GiaoNo = { id: string; ma_dai_ly: string; loai: "no"; ngay: string; so_tien: number; ma_don?: string; ghi_chu?: string; tao_luc?: string; tao_boi?: string };
export type TraNo = { id: string; ma_dai_ly: string; loai: "tra"; ngay: string; so_tien: number; kenh?: string; ghi_chu?: string; tao_luc?: string; tao_boi?: string };
export type DongCongNo = GiaoNo | TraNo;

export type DongCongNoMoi = Omit<GiaoNo, "id" | "tao_luc"> | Omit<TraNo, "id" | "tao_luc">;

export type CongNo = {
  tongNo: number; tongTra: number; soDu: number;

  quaHan: number;

  ngayQuaHanLauNhat: number;
  dongCu?: GiaoNo;
};

const ngayMs = (s: string) => Date.parse(`${s}T00:00:00Z`);
const soNgay = (tu: string, den: string) => Math.floor((ngayMs(den) - ngayMs(tu)) / 86400000);

export function soDuCongNo(dong: DongCongNo[], homNay: string, hanNgay: number): CongNo {
  const no = dong.filter((d): d is GiaoNo => d.loai === "no").sort((a, b) => a.ngay.localeCompare(b.ngay));
  const tra = dong.filter((d): d is TraNo => d.loai === "tra");
  const tongNo = no.reduce((s, d) => s + d.so_tien, 0);
  const tongTra = tra.reduce((s, d) => s + d.so_tien, 0);
  let conTra = tongTra;
  let quaHan = 0, lau = 0; let dongCu: GiaoNo | undefined;
  for (const d of no) {
    const bu = Math.min(conTra, d.so_tien);
    conTra -= bu;
    const con = d.so_tien - bu;
    if (con <= 0) continue;
    const tre = soNgay(d.ngay, homNay) - hanNgay;
    if (tre > 0) {
      quaHan += con;
      if (tre > lau) { lau = tre; dongCu = d; }
    }
  }
  return { tongNo, tongTra, soDu: tongNo - tongTra, quaHan, ngayQuaHanLauNhat: lau, dongCu };
}

export const sdtChuan = (p: unknown) => String(p ?? "").replace(/\D/g, "").replace(/^84/, "0");

export function sdtCuaDaiLy(d: Pick<DaiLy, "dien_thoai" | "dien_thoai_khac">): string[] {
  return Array.from(new Set([d.dien_thoai, ...(d.dien_thoai_khac || [])].map(sdtChuan).filter((p) => p.length >= 9)));
}

export type DongDon = { order_code: string; order_date: string; customer_phone: string | null; net_amount: number };

export type DoanhSoDaiLy = { net: number; gop: number; don: number };

export function doanhSoTheoDaiLy(ds: DaiLy[], rows: DongDon[], vatRate = 0.08): { theoMa: Record<string, DoanhSoDaiLy>; canhBao: string[] } {
  const chu = new Map<string, string>();
  const canhBao: string[] = [];
  for (const d of ds) for (const p of sdtCuaDaiLy(d)) {
    const co = chu.get(p);
    if (co && co !== d.ma) { canhBao.push(`SĐT ${p} có ở cả ${co} và ${d.ma} — tính cho ${co}, kiểm lại sổ.`); continue; }
    chu.set(p, d.ma);
  }
  const theoMa: Record<string, DoanhSoDaiLy> = {};
  const donCua: Record<string, Set<string>> = {};
  for (const d of ds) { theoMa[d.ma] = { net: 0, gop: 0, don: 0 }; donCua[d.ma] = new Set(); }
  for (const r of rows) {
    const ma = chu.get(sdtChuan(r.customer_phone));
    if (!ma) continue;
    theoMa[ma].net += r.net_amount;
    donCua[ma].add(r.order_code);
  }
  for (const ma of Object.keys(theoMa)) {
    theoMa[ma].net = Math.round(theoMa[ma].net);
    theoMa[ma].gop = Math.round(theoMa[ma].net * (1 + vatRate));
    theoMa[ma].don = donCua[ma].size;
  }
  return { theoMa, canhBao };
}

export function kyCua(ngay: string): { thang: { tu: string; den: string; nhan: string }; quy: { tu: string; den: string; nhan: string } } {
  const y = Number(ngay.slice(0, 4)), m = Number(ngay.slice(5, 7));
  const cuoi = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10);
  const q = Math.floor((m - 1) / 3);
  const mq = q * 3 + 1;
  return {
    thang: { tu: `${ngay.slice(0, 7)}-01`, den: cuoi(y, m), nhan: `${String(m).padStart(2, "0")}/${y}` },
    quy: { tu: `${y}-${String(mq).padStart(2, "0")}-01`, den: cuoi(y, mq + 2), nhan: `Q${q + 1}/${y}` },
  };
}

export type ChietKhauDaiLy = { ma: MaSanPham; ten: string; pct: number | null; giaNhap: number | null; trangThai: TrangThaiGia | null; ghiDe?: string };

export function chietKhauTheoBac(d: Pick<DaiLy, "bac" | "loai" | "chiet_khau_ghi_de">): ChietKhauDaiLy[] {
  return SAN_PHAM_V4.filter((sp) => sp.ma !== "dam-hu-500").map((sp) => {
    const gd = d.chiet_khau_ghi_de?.[sp.ma];
    if (gd && gd.ly_do?.trim() && Number.isFinite(gd.pct)) {
      return { ma: sp.ma, ten: sp.ten, pct: gd.pct, giaNhap: giaNhap(sp.niemYet, gd.pct), trangThai: sp.trangThai === "chua_chot" ? "chua_chot" : "hieu_luc", ghiDe: gd.ly_do };
    }
    if (d.loai === "NPP đạm" && sp.ma === "dam") {
      return { ma: sp.ma, ten: sp.ten, pct: NPP_DAM_NOI_BO.chietKhauCungPct, giaNhap: NPP_DAM_NOI_BO.giaNhap, trangThai: NPP_DAM_NOI_BO.trangThai };
    }

    const b = sp.daiLy.find((x) => x.ten === d.bac) || sp.daiLy.find((x) => d.bac && x.ten.startsWith(d.bac));
    if (!b) return { ma: sp.ma, ten: sp.ten, pct: null, giaNhap: null, trangThai: null };
    return { ma: sp.ma, ten: sp.ten, pct: b.pct, giaNhap: giaNhap(sp.niemYet, b.pct), trangThai: b.trangThai };
  });
}

export type CauHinhThuong = {

  nguongQuy: number[];
  pct: number[];
  trangThai: TrangThaiGia;
};

export const hanCongNoMacDinh = (): number => DAI_LY_V4.hanCongNoNgay;

export function cauHinhThuongMacDinh(): CauHinhThuong {
  return { nguongQuy: DAI_LY_V4.thuongQuy.nguongTrieu.map((n) => n * 1e6), pct: [...DAI_LY_V4.thuongQuy.pct], trangThai: DAI_LY_V4.trangThai };
}

export type ThuongQuy = { bac: number; pct: number; tien: number; hop: number | null; nguongKe: number | null; conThieu: number | null; trangThai: TrangThaiGia };

export function thuongQuy(doanhSoQuy: number, ch: CauHinhThuong = cauHinhThuongMacDinh()): ThuongQuy {
  let bac = 0;
  for (let i = 0; i < ch.nguongQuy.length; i++) if (doanhSoQuy >= ch.nguongQuy[i]) bac = i + 1;
  const pct = bac ? ch.pct[bac - 1] : 0;
  const tien = Math.round(doanhSoQuy * pct / 100);
  const giaHop = NPP_DAM_NOI_BO.giaNhap;
  const nguongKe = bac < ch.nguongQuy.length ? ch.nguongQuy[bac] : null;
  return { bac, pct, tien, hop: giaHop > 0 ? Math.floor(tien / giaHop) : null, nguongKe, conThieu: nguongKe == null ? null : nguongKe - doanhSoQuy, trangThai: ch.trangThai };
}

export const vungChuan = (v: unknown) => String(v ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/\s+/g, " ").trim();

export function canhBaoDocQuyenVung(ds: DaiLy[]): string[] {
  const theoVung = new Map<string, DaiLy[]>();
  for (const d of ds) {
    if (!d.doc_quyen_vung) continue;
    const k = vungChuan(d.vung);
    if (!k) continue;
    theoVung.set(k, [...(theoVung.get(k) || []), d]);
  }
  return Array.from(theoVung.entries()).filter(([, xs]) => xs.length > 1)
    .map(([, xs]) => `Vùng "${xs[0].vung}" có ${xs.length} đại lý cùng bật độc quyền: ${xs.map((x) => `${x.ma} (${x.ho_ten})`).join(", ")} — chỉ một được độc quyền, kiểm hợp đồng.`);
}

export function duDieuKienDocQuyen(doanhSoQuy: number): boolean {
  return doanhSoQuy >= NPP_DAM_NOI_BO.docQuyenVungTuTrieuQuy * 1e6;
}

export type TienDoCamKet = { pct: number; conLai: number; conNgay: number | null; trangThai: "dat" | "dung_nhip" | "cham" | "qua_han" | "khong" };

export function tienDoCamKet(c: DealerCommit | undefined, homNay: string): TienDoCamKet {
  if (!c || !(c.can_lay > 0)) return { pct: 0, conLai: 0, conNgay: null, trangThai: "khong" };
  const pct = Math.min(100, Math.round(c.da_lay / c.can_lay * 100));
  const conLai = Math.max(0, c.can_lay - c.da_lay);
  const conNgay = c.han ? soNgay(homNay, c.han) : null;
  if (conLai === 0) return { pct, conLai, conNgay, trangThai: "dat" };
  if (conNgay != null && conNgay < 0) return { pct, conLai, conNgay, trangThai: "qua_han" };

  if (c.moc_giua && conNgay != null) {
    const quaGiua = soNgay(c.moc_giua, homNay) >= 0;
    if (quaGiua && pct < 50) return { pct, conLai, conNgay, trangThai: "cham" };
  }
  return { pct, conLai, conNgay, trangThai: "dung_nhip" };
}

export function giaNhapNppDam(): { gia: number; trangThai: TrangThaiGia; niemYet: number | null } {
  return { gia: NPP_DAM_NOI_BO.giaNhap, trangThai: NPP_DAM_NOI_BO.trangThai, niemYet: sanPhamV4("dam").niemYet };
}
