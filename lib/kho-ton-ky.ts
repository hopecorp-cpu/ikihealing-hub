import snapshot from "@/data/kho-ton-excel-anh-1010.json";
import { sanPhamV4 } from "@/lib/gia-v4";

export const NGUON_EXCEL_ANH = "excel-anh-1010" as const;
export const AS_OF_HIEN_HANH = "2026-09-26";
export const AS_OF_DOI_CHIEU = "2026-09-05";

export type DongTonKy = {
  sku: string;
  name: string;
  unit: string;

  qty: number | null;
};

export type KyTon = {
  asOf: string;
  tuNgay: string;
  denNgay: string;
  sheet: string;
  vaiTro: "hien-hanh" | "doi-chieu";
  items: DongTonKy[];
};

export type SoTonExcel = {
  nguon: typeof NGUON_EXCEL_ANH;
  kho: string;
  khongGhi: string[];
  ghiChu: string;
  ky: KyTon[];
};

export type DongAcme = { sku: string; name: string; closing: number };

export const GAN_MA_ACME: Record<string, string[]> = {
  "SẢN PHẨM A": ["BĐH-001"],
  "TRA TUI LOC": ["TTM-001"],
  THT01: [],
  G1BDTVPPBM01: [],
};

export const KHONG_GAN_MA: Record<string, string[]> = {
  "SẢN PHẨM A": ["TV668", "TV55", "TV-001", "BĐG-001", "BĐL-001"],
};

export const MA_UU_TIEN = ["SẢN PHẨM A", "G1BDTVPPBM01", "TRA TUI LOC", "THT01"] as const;

export const TIN_DAM_0810 = { ngay: "2026-10-08", qty: 64, nguon: "brief VHSP 10/10 — không đọc DB prod trong PR này" };
export const MISA_DAM_2708 = { ngay: "2026-08-27", qty: 1743, nguon: "brief: MISA đứng 27/08" };

export type DongGop = {
  sku: string;
  name: string;
  unit: string;
  cuoi0509: number | null;
  cuoi2609: number | null;
  thieuKySau: boolean;
  lechDonVi: boolean;
};

export type LechUuTien = {
  sku: (typeof MA_UU_TIEN)[number];
  name: string;
  unit: string;
  cuoi0509: number | null;
  cuoi2609: number | null;
  thieuKySau: boolean;
  acme: DongAcme[];
  tinKho: { ngay: string; qty: number } | null;
  misa: { ngay: string; qty: number } | null;

  giaGiu: number | null;
  lech: string[];
};

export function chuanMa(s: string): string {
  return String(s || "").replace(/\s+/g, " ").trim();
}

export function laDongBo(name: string | null | undefined, sku: string | null | undefined): boolean {
  const n = chuanMa(name || "");
  const s = chuanMa(sku || "");
  if (!n && !s) return true;
  if (/^(tổng|cộng|tong|cong)\b/i.test(n) || /^(tổng|cộng|tong|cong)\b/i.test(s)) return true;
  if (/^\(\d+\)/.test(n) || /^\(\d+\)/.test(s)) return true;
  if (n === "Tên hàng hóa" || s === "Mã hàng hóa" || n === "TỔNG HỢP TỒN KHO") return true;
  return false;
}

export function docSoCuoiKy(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const t = String(raw).trim();
  if (!t) return null;
  const n = Number(t.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function kyTheoAsOf(so: SoTonExcel, asOf: string): KyTon | null {
  return so.ky.find((k) => k.asOf === asOf) || null;
}

export function gopHaiKy(so: SoTonExcel): DongGop[] {
  const truoc = kyTheoAsOf(so, AS_OF_DOI_CHIEU);
  const nay = kyTheoAsOf(so, AS_OF_HIEN_HANH);
  if (!truoc || !nay) return [];
  const cu = new Map(truoc.items.map((i) => [i.sku, i]));
  const da = new Set<string>();
  const ra: DongGop[] = [];
  const day = (sku: string, ten: string, unit: string, q26: number | null, q5: DongTonKy | undefined) => {
    da.add(sku);
    ra.push({
      sku,
      name: ten,
      unit,
      cuoi0509: q5 ? q5.qty : null,
      cuoi2609: q26,
      thieuKySau: q26 == null,
      lechDonVi: !!q5 && q5.unit !== unit,
    });
  };
  for (const i of nay.items) day(i.sku, i.name, i.unit, i.qty, cu.get(i.sku));
  for (const i of truoc.items) if (!da.has(i.sku)) day(i.sku, i.name, i.unit, null, i);
  return ra;
}

export function thongKe(so: SoTonExcel): { sku: number; coSo: number; thieu: number; bangKhong: number } {
  const nay = kyTheoAsOf(so, AS_OF_HIEN_HANH);
  const items = nay?.items || [];
  return {
    sku: items.length,
    coSo: items.filter((i) => i.qty != null).length,
    thieu: items.filter((i) => i.qty == null).length,
    bangKhong: items.filter((i) => i.qty === 0).length,
  };
}

function timAcme(maExcel: string, acme: DongAcme[]): DongAcme[] {
  const can = new Set(GAN_MA_ACME[maExcel] || []);
  return acme.filter((h) => can.has(chuanMa(h.sku)));
}

export function mocTuKyHienHanh(so: SoTonExcel): { tuNgay: string; nguon: string; items: { name: string; qty: number; sku: string; unit: string }[] } {
  const nay = kyTheoAsOf(so, AS_OF_HIEN_HANH);
  const items = (nay?.items || []).filter((i): i is DongTonKy & { qty: number } => i.qty != null)
    .map((i) => ({ name: i.name, qty: i.qty, sku: i.sku, unit: i.unit }));
  return { tuNgay: AS_OF_HIEN_HANH, nguon: NGUON_EXCEL_ANH, items };
}

export function lechUuTien(so: SoTonExcel, acme: DongAcme[]): LechUuTien[] {
  const gop = new Map(gopHaiKy(so).map((d) => [d.sku, d]));
  const giaSanPhamC = sanPhamV4("san-pham-c").niemYet;
  return MA_UU_TIEN.map((sku) => {
    const d = gop.get(sku);
    const hop = timAcme(sku, acme);
    const lech: string[] = [];
    const tin = sku === "SẢN PHẨM A" ? { ngay: TIN_DAM_0810.ngay, qty: TIN_DAM_0810.qty } : null;
    const misa = sku === "SẢN PHẨM A" ? { ngay: MISA_DAM_2708.ngay, qty: MISA_DAM_2708.qty } : null;
    const giaGiu = sku === "TRA TUI LOC" ? giaSanPhamC : null;
    if (!d) {
      lech.push("Không có mã này trong snapshot Excel.");
    } else if (d.thieuKySau) {
      lech.push(`26/09 thiếu số (05/09 = ${d.cuoi0509 == null ? "cũng trống" : d.cuoi0509}). Không điền 0.`);
    }
    if (sku === "SẢN PHẨM A" && d) {
      const bdh = hop.find((h) => h.sku === "BĐH-001");
      lech.push(`Excel 26/09 = ${d.cuoi2609} hộp; tin kho 08/10 = ${TIN_DAM_0810.qty}; MISA đứng 27/08 = ${MISA_DAM_2708.qty.toLocaleString("vi-VN")}; file tĩnh ${bdh ? `BĐH-001 closing ${bdh.closing} (20/06)` : "không thấy BĐH-001"}. Chưa chốt.`);
      lech.push("Không ghép TV668, TV55, TV-001, BĐG-001, BĐL-001 — không phải hũ 500g của mã SẢN PHẨM A.");
    }
    if (sku === "G1BDTVPPBM01") {
      lech.push(hop.length ? `Acme Ops có ${hop.map((h) => h.sku).join(", ")}.` : "Không có mã G1BDTVPPBM01 trong file tồn tĩnh. Không nhầm gói 10g với stick 22g.");
    }
    if (sku === "TRA TUI LOC" && d) {
      const ttm = hop.find((h) => h.sku === "TTM-001");
      lech.push(`Excel 26/09 = ${d.cuoi2609}; file tĩnh ${ttm ? `TTM-001 closing ${ttm.closing} (mã khác, 20/06)` : "không thấy TTM-001"}.`);
      lech.push(giaSanPhamC == null
        ? "Không đọc được niêm yết Trà Mẫu A. Sổ tồn không ghi giá."
        : `Giá niêm yết giữ ${giaSanPhamC.toLocaleString("vi-VN")}đ. Sổ tồn không ghi giá.`);
    }
    if (sku === "THT01" && d) {
      lech.push(hop.length
        ? `Acme Ops có ${hop.map((h) => `${h.sku}=${h.closing}`).join(", ")}.`
        : `Excel 26/09 = ${d.cuoi2609}. Không có mã THT01 trong file tồn tĩnh.`);
    }
    return {
      sku,
      name: d?.name || "",
      unit: d?.unit || "",
      cuoi0509: d?.cuoi0509 ?? null,
      cuoi2609: d?.cuoi2609 ?? null,
      thieuKySau: d?.thieuKySau ?? true,
      acme: hop,
      tinKho: tin,
      misa,
      giaGiu,
      lech,
    };
  });
}

export const SO_TON_EXCEL_ANH = snapshot as SoTonExcel;
