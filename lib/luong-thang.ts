import { runMonthlyCalc, aggregateRevenue, type BonusRule, type UserBonusCalc } from "./bonus-engine";
import {
  calcTax, calcInsurance, calcWorkdaySalary, LAW_2026, detectSaleType, saleKpiTarget,
  calcSaleCommissionNet, explainSaleCommission, calcSaleGroupBonusNet, calcTrucPageBonus,
} from "./payroll";
import { computeMonthlyNC } from "./nc";
import { layDonTele, gopTenSale, laSaleChuaRo, type DonTele } from "./doanh-thu";
import { loadOrderOverrides } from "./order-attribution";
import { layPhieuNghiTreo, tomTatPhieuTreo } from "@/lib/phieu-nghi-treo";
import { BOD_EMAILS, ACCOUNTANT_EMAILS } from "@/lib/auth";

const VAT = 1 + LAW_2026.vatSanPhamA;
const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n || 0)) + "đ";
const trieu = (n: number) => (n / 1e6).toFixed(1).replace(".", ",") + "tr";

export const NGAY_NGHI_LE_MAC_DINH = [
  "2026-01-01",
  "2026-02-14", "2026-02-15", "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20", "2026-02-21", "2026-02-22",
  "2026-04-27", "2026-04-30", "2026-05-01",
  "2026-09-01", "2026-09-02",
  "2027-01-01",
];

export function vnHomNay(d: Date = new Date()): string {
  return new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 10);
}

export function thangTruoc(ngay: string): string {
  const [y, m] = ngay.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export function cuoiThang(thang: string): string {
  const [y, m] = thang.split("-").map(Number);
  return `${thang}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
}

export function congNgay(ngay: string, n: number): string {
  return new Date(Date.parse(ngay + "T00:00:00Z") + n * 86400e3).toISOString().slice(0, 10);
}

export async function docNgayNghiLe(sb: any): Promise<string[]> {
  const ds = new Set(NGAY_NGHI_LE_MAC_DINH);
  try {
    const { data } = await sb.from("config").select("value").eq("key", "ngay_nghi_le").maybeSingle();
    const j = JSON.parse(data?.value || "[]");
    for (const x of Array.isArray(j) ? j : []) if (/^\d{4}-\d{2}-\d{2}$/.test(String(x))) ds.add(String(x));
  } catch {  }
  return [...ds].sort();
}

export function quyetDinhChayLuong(homNay: string, ngayNghi: string[], cuaSo = 5): { thang: string; chay: boolean; lyDo: string } {
  const thang = thangTruoc(homNay);
  const d = Number(homNay.slice(8, 10));
  if (d > cuaSo) return { thang, chay: false, lyDo: `ngày ${d} ngoài cửa sổ mùng 1-${cuaSo}` };
  if (ngayNghi.includes(homNay)) return { thang, chay: false, lyDo: `${homNay} là ngày nghỉ lễ, chờ ngày làm việc kế tiếp` };
  return { thang, chay: true, lyDo: d === 1 ? "mùng 1" : `mùng ${d} (bù cho mùng 1)` };
}

export type VanDon = { ma: string; ngay: string; sdt: string; nhom: string; freight: number };
export type GiaoDichNH = { ngay: string; tien: number };

export type KetQuaDon = DonTele & {
  tinhTrang: "tinh" | "hoan" | "chua_xac_minh" | "si" | "khong_tien";
  ly: string;
  vanDon: string | null;
  quaVon: number;
  ship: number;
  netKpi: number;
};

const boDau = (s: string) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();

export function chuanTenQua(ten: string): string | null {
  const t = boDau(ten);
  if (!t) return null;
  const nhom: Array<[RegExp, string]> = [
    [/dam|true ?vegan|tvp|^hop( dam)?$/, "Đạm Mẫu"],
    [/san pham c/, "Trà Mẫu A"],
    [/san pham b/, "Trà Mẫu B"],
    [/cafe|ca phe|caphe/, "Cà phê hữu cơ NOVA"],
    [/binh lac/, "Bình lắc"],
    [/muoi tre/, "Muối tre SAHU 300gr"],
    [/kem danh rang|kdr/, "Kem đánh răng thảo mộc Sudanta 100g"],
    [/mat mia/, "Mật mía 500ml"],
  ];
  const trung = nhom.filter(([re]) => re.test(t));
  if (trung.length !== 1) return null;
  return trung[0][1];
}

export function xepDon(
  don: DonTele[], vanDon: VanDon[], ngHang: GiaoDichNH[],
  giaVon: (tenChuan: string) => number | null, shipTB: number,
): { ketQua: KetQuaDon[]; quaKhongGia: Record<string, number> } {
  const theoSdt = new Map<string, VanDon[]>();
  for (const v of vanDon) if (v.sdt) (theoSdt.get(v.sdt) || theoSdt.set(v.sdt, []).get(v.sdt)!).push(v);
  const daDung = new Set<string>();
  const nhDaDung = new Set<number>();
  const quaKhongGia: Record<string, number> = {};
  const ngayMs = (s: string) => Date.parse(s.slice(0, 10) + "T00:00:00Z");

  const ketQua: KetQuaDon[] = [...don].sort((a, b) => a.ngay.localeCompare(b.ngay)).map((d) => {

    let quaVon = 0;
    for (const q of d.qua) {
      const tc = chuanTenQua(q.ten);
      const gv = tc ? giaVon(tc) : null;
      if (gv) quaVon += Math.round(gv * VAT) * q.sl;
      else quaKhongGia[q.ten] = (quaKhongGia[q.ten] || 0) + q.sl;
    }
    const base = { ...d, quaVon, vanDon: null as string | null, ship: 0, netKpi: 0 };
    if (d.laSi) return { ...base, tinhTrang: "si" as const, ly: "đơn sỉ/đại lý — tách khỏi KPI" };
    if (d.khachTra <= 0) return { ...base, tinhTrang: "khong_tien" as const, ly: "khách trả 0đ" };

    const cs = theoSdt.get(d.sdt) || [];
    const t0 = ngayMs(d.ngay);
    const trongCuaSo = cs.filter((v) => { const dt = (ngayMs(v.ngay) - t0) / 86400e3; return dt >= -3 && dt <= 14; });
    const chon = trongCuaSo.filter((v) => !daDung.has(v.ma)).sort((a, b) => Math.abs(ngayMs(a.ngay) - t0) - Math.abs(ngayMs(b.ngay) - t0))[0];
    const shipCua = (v: VanDon | undefined) => d.kieuShip === "khach_tra_ship" ? 0 : (v && v.freight > 0 ? v.freight : shipTB);

    if (chon) {
      daDung.add(chon.ma);
      if (chon.nhom === "returned") {
        return { ...base, tinhTrang: "hoan" as const, vanDon: chon.ma, ly: "khách hoàn về (J&T D205)" };
      }
      if (chon.nhom === "cancelled") {
        const thay = trongCuaSo.find((v) => v.ma !== chon.ma && v.nhom !== "cancelled");
        if (!thay) return { ...base, tinhTrang: "hoan" as const, vanDon: chon.ma, ly: "vận đơn huỷ, không có vận đơn thay thế" };
        daDung.add(thay.ma);
        const ship = shipCua(thay);
        return { ...base, tinhTrang: "tinh" as const, vanDon: thay.ma, ship, netKpi: Math.round(d.khachTra / VAT - quaVon - ship), ly: "huỷ vận đơn cũ, tạo lại và giao" };
      }
      const ship = shipCua(chon);
      return { ...base, tinhTrang: "tinh" as const, vanDon: chon.ma, ship, netKpi: Math.round(d.khachTra / VAT - quaVon - ship), ly: `vận đơn J&T ${chon.nhom}` };
    }

    const iNH = ngHang.findIndex((g, i) => !nhDaDung.has(i) && Math.abs(g.tien - d.khachTra) <= 1000
      && (ngayMs(g.ngay) - t0) / 86400e3 >= -2 && (ngayMs(g.ngay) - t0) / 86400e3 <= 10);
    if (iNH >= 0) {
      nhDaDung.add(iNH);
      const ship = d.kieuShip === "khach_tra_ship" ? 0 : (d.kieuShip === "ck_truoc" ? 0 : shipTB);
      return { ...base, tinhTrang: "tinh" as const, ship, netKpi: Math.round(d.khachTra / VAT - quaVon - ship), ly: "khách CK, khớp sao kê" };
    }
    return { ...base, tinhTrang: "chua_xac_minh" as const, ly: "không thấy vận đơn J&T, cũng chưa thấy tiền về — chuyển sang tháng sau" };
  });
  return { ketQua, quaKhongGia };
}

export type HoaHongSale = {
  ten: string;
  userId: string | null;
  viTri: string;
  loai: "leader_sale" | "sale" | "truc_page" | "none";
  target: number;
  soDon: number;
  khachTra: number;
  hoan: { don: number; tienNet: number };
  chuaXacMinh: { don: number; tienNet: number; ds: KetQuaDon[] };
  daTinh: number;
  quaVon: number;
  ship: number;
  thangTruocVe: { don: number; tienNet: number; ds: Array<{ ma: string; khach: string; khachTra: number; vanDon: string | null }> };
  netKpi: number;
  kpiPct: number;
  bac: string;
  congThuc: string;
  hoaHong: number;
  thuongNhom: number;
  ghiChu: string[];
};

export type HoaHongThang = {
  thang: string; tu: string; den: string;
  theoSale: HoaHongSale[];
  chuaRo: { don: number; khachTra: number; ds: KetQuaDon[] };
  si: { don: number; khachTra: number };
  quaKhongGia: Record<string, number>;
  tongKhachTra: number;
  tongNetKpiSale: number;
  thuongNhomPool: number;
  shipTB: number;
  nguon: { soDon: number; jtToi: string | null; jtSoVanDon: number; nhToi: string | null; nhSoGiaoDich: number };
  choXacMinhGhiConfig: Array<{ ma: string; sale: string; khach: string; sdt: string; khachTra: number; ngay: string }>;
  canhBao: string[];
};

type NguoiSale = { id: string; full_name: string; position: string | null };

export function gomTheoSale(
  ketQua: KetQuaDon[], users: NguoiSale[],
  thangTruocVe: Array<{ ma: string; sale: string; khach: string; khachTra: number; vanDon: string | null; netKpi: number }> = [],
  xetKpiTheoDsBan = false,
): { theoSale: HoaHongSale[]; chuaRo: HoaHongThang["chuaRo"]; si: HoaHongThang["si"]; tongNetKpiSale: number; thuongNhomPool: number } {
  const gop = gopTenSale(users.map((u) => ({ ten: u.full_name })));
  const theoTen = new Map<string, HoaHongSale>();
  const chuaRo: HoaHongThang["chuaRo"] = { don: 0, khachTra: 0, ds: [] };
  const si: HoaHongThang["si"] = { don: 0, khachTra: 0 };

  const lay = (tenThô: string) => {
    const ten = gop(tenThô);
    let s = theoTen.get(ten.toLowerCase());
    if (s) return s;
    const u = users.find((x) => x.full_name.toLowerCase() === ten.toLowerCase());
    const loai = detectSaleType(u?.position ?? null);
    s = {
      ten, userId: u?.id ?? null, viTri: u?.position || "", loai, target: saleKpiTarget(u?.position),
      soDon: 0, khachTra: 0, hoan: { don: 0, tienNet: 0 }, chuaXacMinh: { don: 0, tienNet: 0, ds: [] },
      daTinh: 0, quaVon: 0, ship: 0, thangTruocVe: { don: 0, tienNet: 0, ds: [] },
      netKpi: 0, kpiPct: 0, bac: "", congThuc: "", hoaHong: 0, thuongNhom: 0, ghiChu: [],
    };
    theoTen.set(ten.toLowerCase(), s);
    return s;
  };

  for (const d of ketQua) {
    if (d.tinhTrang === "si") { si.don++; si.khachTra += d.khachTra; continue; }
    if (d.tinhTrang === "khong_tien") continue;
    if (laSaleChuaRo(d.sale)) { chuaRo.don++; chuaRo.khachTra += d.khachTra; chuaRo.ds.push(d); continue; }
    const s = lay(String(d.sale));
    s.soDon++; s.khachTra += d.khachTra; s.quaVon += d.quaVon;
    if (d.tinhTrang === "hoan") { s.hoan.don++; s.hoan.tienNet += Math.round(d.khachTra / VAT); continue; }
    if (d.tinhTrang === "chua_xac_minh") { s.chuaXacMinh.don++; s.chuaXacMinh.tienNet += Math.round(d.khachTra / VAT); s.chuaXacMinh.ds.push(d); continue; }
    s.daTinh++; s.ship += d.ship; s.netKpi += d.netKpi;
  }
  for (const v of thangTruocVe) {
    const s = lay(v.sale);
    s.thangTruocVe.don++; s.thangTruocVe.tienNet += v.netKpi;
    s.thangTruocVe.ds.push({ ma: v.ma, khach: v.khach, khachTra: v.khachTra, vanDon: v.vanDon });
    s.netKpi += v.netKpi;
  }

  let tongNetKpiSale = 0;
  for (const s of theoTen.values()) {
    if (s.loai === "leader_sale" || s.loai === "sale") tongNetKpiSale += s.netKpi;
    s.kpiPct = s.target ? Math.round((s.netKpi / s.target) * 100) : 0;
    if (s.loai === "leader_sale" || s.loai === "sale") {
      const dsBan = xetKpiTheoDsBan ? Math.round(s.khachTra / VAT) : undefined;
      const ex = explainSaleCommission(s.netKpi, s.target, dsBan);
      s.hoaHong = calcSaleCommissionNet(s.netKpi, s.target, dsBan);
      s.bac = ex.pct; s.congThuc = ex.formula;
    } else if (s.loai === "truc_page") {
      s.hoaHong = calcTrucPageBonus(s.khachTra, false);
      s.bac = "1,5%"; s.congThuc = `Trực Page: 1,5% × ${fmt(s.khachTra / VAT)} net`;
    } else {
      s.bac = "—"; s.congThuc = "không thuộc cơ chế hoa hồng sale (vị trí hỗ trợ)";
    }
    if (!s.userId) s.ghiChu.push("chữ ký không khớp ai trong sổ nhân sự — kiểm lại tên");
  }

  const thuongNhomPool = calcSaleGroupBonusNet(tongNetKpiSale);
  const leaders = [...theoTen.values()].filter((s) => s.loai === "leader_sale");
  if (thuongNhomPool > 0 && leaders.length) for (const l of leaders) l.thuongNhom = Math.round(thuongNhomPool / leaders.length);

  const theoSale = [...theoTen.values()].sort((a, b) => b.netKpi - a.netKpi);
  return { theoSale, chuaRo, si, tongNetKpiSale, thuongNhomPool };
}

async function layHet(build: () => any): Promise<any[]> {
  const out: any[] = [];
  for (let f = 0; f < 40000; f += 1000) {
    const { data, error } = await build().range(f, f + 999);
    if (error || !data?.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

const NHOM_JT: Record<string, string> = { D203: "delivered", D205: "returned", D104: "cancelled", D207: "transit", D202: "transit", D204: "other" };

export async function layVanDon(sb: any, tu: string, den: string): Promise<VanDon[]> {
  const raw = await layHet(() => sb.from("jt_waybills")
    .select("waybill_no, order_create_time, status_code, status_group, is_void, receiver_phone, freight")
    .gte("order_create_time", tu + "T00:00:00+07:00").lte("order_create_time", den + "T23:59:59+07:00")
    .eq("is_void", false).order("order_create_time")).catch(() => []);
  return raw.map((w: any) => ({
    ma: String(w.waybill_no),
    ngay: new Date(new Date(w.order_create_time).getTime() + 7 * 3600e3).toISOString().slice(0, 10),
    sdt: String(w.receiver_phone || "").replace(/\D/g, "").replace(/^84/, "0"),
    nhom: String(w.status_group || NHOM_JT[String(w.status_code)] || "other"),
    freight: Number(w.freight) || 0,
  }));
}

export async function layTienVe(sb: any, tu: string, den: string): Promise<{ ds: GiaoDichNH[]; toi: string | null }> {
  const ds: GiaoDichNH[] = [];
  let toi: string | null = null;
  for (const key of ["mb_transactions", "tcb_transactions"]) {
    try {
      const { data } = await sb.from("config").select("value").eq("key", key).maybeSingle();
      const j = JSON.parse(data?.value || "[]");
      const arr: any[] = Array.isArray(j) ? j : (j.items || j.transactions || []);
      for (const x of arr) {
        const ngay = String(x.date || "").slice(0, 10);
        if (!ngay) continue;
        if (!toi || ngay > toi) toi = ngay;
        const tien = Number(x.amount) || 0;
        if (x.isJt || tien <= 0 || (x.type && x.type !== "credit")) continue;
        if (ngay >= tu && ngay <= den) ds.push({ ngay, tien });
      }
    } catch {  }
  }
  return { ds, toi };
}

export async function layGiaVon(sb: any): Promise<(ten: string) => number | null> {
  const CEO_CAP: Record<string, number> = { "Trà Mẫu B": 38_000, "Trà Mẫu A": 37_000, "Bình lắc": 37_000 };
  const bang = new Map<string, number>();
  try {
    const { data } = await sb.from("products").select("name, cost_price");
    for (const p of data || []) if (Number(p.cost_price) > 0) bang.set(boDau(p.name), Number(p.cost_price));
  } catch {  }
  const tim = (ten: string) => {
    const k = boDau(ten);
    if (bang.has(k)) return bang.get(k)!;
    for (const [n, v] of bang) if (n.startsWith(k)) return v;
    return null;
  };
  return (ten) => tim(ten) ?? CEO_CAP[ten] ?? null;
}

async function docChoXacMinh(sb: any, thang: string): Promise<HoaHongThang["choXacMinhGhiConfig"]> {
  try {
    const { data } = await sb.from("config").select("value").eq("key", `luong_cho_xac_minh_${thang}`).maybeSingle();
    const j = JSON.parse(data?.value || "[]");
    return Array.isArray(j) ? j : [];
  } catch { return []; }
}

export async function tinhHoaHongThang(sb: any, thang: string, users: NguoiSale[]): Promise<HoaHongThang | null> {
  const tu = `${thang}-01`, den = cuoiThang(thang);
  const don = await layDonTele(sb, tu, den);
  if (!don.length) return null;

  const ov = await loadOrderOverrides(sb).catch(() => ({ excluded: new Set<string>(), reassign: {} as Record<string, string> }));
  const donHieuLuc = don.filter((d) => !ov.excluded.has(d.ma)).map((d) => ov.reassign[d.ma] ? { ...d, sale: ov.reassign[d.ma] } : d);

  const [vanDon, nh, giaVon, choXacMinhTruoc] = await Promise.all([
    layVanDon(sb, congNgay(tu, -3), congNgay(den, 14)),
    layTienVe(sb, congNgay(tu, -2), congNgay(den, 10)),
    layGiaVon(sb),
    docChoXacMinh(sb, thangTruoc(tu)),
  ]);
  const vdTrongThang = vanDon.filter((v) => v.ngay >= tu && v.ngay <= den && v.freight > 0);
  const shipTB = vdTrongThang.length ? Math.round(vdTrongThang.reduce((s, v) => s + v.freight, 0) / vdTrongThang.length) : 25_940;

  const { ketQua, quaKhongGia } = xepDon(donHieuLuc, vanDon, nh.ds, giaVon, shipTB);

  const thangTruocVe: Array<{ ma: string; sale: string; khach: string; khachTra: number; vanDon: string | null; netKpi: number }> = [];
  const choXacMinhConLai: HoaHongThang["choXacMinhGhiConfig"] = [];
  if (choXacMinhTruoc.length) {
    const vdRong = await layVanDon(sb, congNgay(`${thangTruoc(tu)}-01`, 0), congNgay(den, 14));
    const dung = new Set(ketQua.map((k) => k.vanDon).filter(Boolean) as string[]);
    for (const c of choXacMinhTruoc) {
      const sdt = String(c.sdt || "").replace(/\D/g, "").replace(/^84/, "0");
      const vd = vdRong.find((v) => v.sdt === sdt && sdt && !dung.has(v.ma) && v.nhom !== "cancelled" && v.nhom !== "returned" && v.ngay >= c.ngay);
      if (vd) {
        dung.add(vd.ma);
        thangTruocVe.push({ ma: c.ma, sale: c.sale, khach: c.khach, khachTra: c.khachTra, vanDon: vd.ma, netKpi: Math.round(c.khachTra / VAT - vd.freight) });
      } else choXacMinhConLai.push(c);
    }
  }

  const g = gomTheoSale(ketQua, users, thangTruocVe, thang >= "2026-11");
  const canhBao: string[] = [];
  const jtToi = vanDon.length ? vanDon.map((v) => v.ngay).sort().pop()! : null;
  if (!vanDon.length) canhBao.push("KHÔNG có vận đơn J&T nào trong kỳ — mọi đơn COD sẽ thành 'chưa xác minh'. Chạy scripts/jt-login.mjs rồi jt-fetch trước khi chốt.");
  else if (jtToi && jtToi < congNgay(den, 3)) canhBao.push(`Kho J&T mới tới ${jtToi}, đơn cuối tháng chưa kịp có vận đơn — chạy jt-fetch rồi tính lại thì số 'chưa xác minh' sẽ giảm.`);
  if (!nh.toi || nh.toi < den) canhBao.push(`Sổ phụ ngân hàng mới tới ${nh.toi || "trống"} — đơn khách CK sau mốc đó chưa khớp được tiền về.`);
  if (g.chuaRo.don) canhBao.push(`${g.chuaRo.don} đơn (${trieu(g.chuaRo.khachTra)} khách trả) KHÔNG có chữ ký sale — gán ở /gan-don rồi tính lại, không thì tiền này không về ai.`);
  if (Object.keys(quaKhongGia).length) canhBao.push(`Quà chưa có giá vốn (chưa trừ): ${Object.entries(quaKhongGia).map(([k, v]) => `${v}x ${k}`).join(" · ")}.`);
  if (choXacMinhTruoc.length) canhBao.push(`Đơn tháng trước chờ xác minh: ${thangTruocVe.length}/${choXacMinhTruoc.length} nay đã có vận đơn, đã cộng vào tháng này; ${choXacMinhConLai.length} vẫn chưa thấy vận đơn — chưa tính; sale chứng minh được thì anh cộng tay.`);

  const choXacMinhGhiConfig = ketQua.filter((k) => k.tinhTrang === "chua_xac_minh" && !laSaleChuaRo(k.sale))
    .map((k) => ({ ma: k.ma, sale: String(k.sale), khach: k.khach || "", sdt: k.sdt, khachTra: k.khachTra, ngay: k.ngay }));

  return {
    thang, tu, den,
    theoSale: g.theoSale, chuaRo: g.chuaRo, si: g.si, quaKhongGia,
    tongKhachTra: ketQua.filter((k) => k.tinhTrang !== "si").reduce((s, k) => s + k.khachTra, 0),
    tongNetKpiSale: g.tongNetKpiSale, thuongNhomPool: g.thuongNhomPool, shipTB,
    nguon: { soDon: don.length, jtToi, jtSoVanDon: vanDon.length, nhToi: nh.toi, nhSoGiaoDich: nh.ds.length },
    choXacMinhGhiConfig, canhBao,
  };
}

function isSalePosition(position: string | null): boolean {
  if (!position) return false;
  return /(sale|leader sale|trực page|tư vấn)/i.test(position.toLowerCase());
}

export const MIEN_CHAM_CONG_MAC_DINH = [...BOD_EMAILS, ...ACCOUNTANT_EMAILS];

async function docLuatChamCong(sb: any): Promise<{ mien: Set<string>; loai: Record<string, Record<string, string>> }> {
  const mien = new Set(MIEN_CHAM_CONG_MAC_DINH);
  let loai: Record<string, Record<string, string>> = {};
  try {
    const { data } = await sb.from("config").select("value").eq("key", "luong_cham_cong").maybeSingle();
    const j = data?.value ? JSON.parse(data.value) : null;
    if (Array.isArray(j?.mien)) { mien.clear(); for (const e of j.mien) mien.add(String(e).toLowerCase().trim()); }
    if (j?.loai && typeof j.loai === "object") for (const [e, v] of Object.entries(j.loai)) loai[String(e).toLowerCase().trim()] = (v || {}) as Record<string, string>;
  } catch {  }
  return { mien, loai };
}

export type ThuongTay = Record<string, Array<{ tien: number; lyDo: string }>>;
async function docThuongTay(sb: any, month: string): Promise<ThuongTay> {
  try {
    const { data } = await sb.from("config").select("value").eq("key", `luong_thuong_tay_${month}`).maybeSingle();
    const j = data?.value ? JSON.parse(data.value) : {};
    const out: ThuongTay = {};
    for (const [k, v] of Object.entries(j || {})) {
      const ds = (Array.isArray(v) ? v : [v]).filter((x: any) => x && Number(x.tien)).map((x: any) => ({ tien: Math.round(Number(x.tien)), lyDo: String(x.lyDo || "") }));
      if (ds.length) out[k.toLowerCase().trim()] = ds;
    }
    return out;
  } catch { return {}; }
}

export type SanLuongKhoan = Record<string, { soLuong: number; donGia: number; donVi?: string; ghiChu?: string }>;
async function docSanLuong(sb: any, month: string): Promise<SanLuongKhoan> {
  try {
    const { data } = await sb.from("config").select("value").eq("key", `luong_san_luong_${month}`).maybeSingle();
    const j = data?.value ? JSON.parse(data.value) : {};
    const out: SanLuongKhoan = {};
    for (const [k, v] of Object.entries(j || {})) {
      const x: any = v;
      if (x && Number(x.soLuong) >= 0 && Number(x.donGia) > 0) out[k.toLowerCase().trim()] = { soLuong: Number(x.soLuong), donGia: Number(x.donGia), donVi: x.donVi, ghiChu: x.ghiChu };
    }
    return out;
  } catch { return {}; }
}

export function kyLamViec(month: string, hireDate?: string | null, terminatedAt?: string | null): { tu: string; den: string } {
  const tu0 = `${month}-01`, den0 = cuoiThang(month);
  const tu = hireDate && hireDate > tu0 ? hireDate : tu0;
  let den = den0;
  if (terminatedAt && terminatedAt <= den0) den = congNgay(terminatedAt, -1);
  return { tu, den };
}

export function danhSachNgayLamViec(tu: string, den: string): string[] {
  const out: string[] = [];
  for (let d = tu; d <= den; d = congNgay(d, 1)) if (new Date(d + "T00:00:00Z").getUTCDay() !== 0) out.push(d);
  return out;
}

export type XemTruocLuong = Awaited<ReturnType<typeof xemTruocLuongThang>>;

export async function xemTruocLuongThang(sb: any, month: string) {

  const monthStartForUsers = `${month}-01`;
  const [uy, um] = month.split("-").map(Number);
  const nextStartForUsers = um === 12 ? `${uy + 1}-01-01` : `${uy}-${String(um + 1).padStart(2, "0")}-01`;

  const { data: usersRaw } = await sb.from("users")
    .select("id, email, full_name, position, contract_type, base_salary, insurance_salary, max_bonus, dependent_count, hire_date, terminated_at, manager_id")
    .or(`active.eq.true,terminated_at.gte.${monthStartForUsers}`);

  const users = (usersRaw ?? []).filter((u: any) => !(u.terminated_at && u.terminated_at <= monthStartForUsers));

  const chamCong = await docLuatChamCong(sb);
  const ngayNghiLe = new Set(await docNgayNghiLe(sb));
  const attDays: Record<string, Set<string>> = {};
  const attTre: Record<string, number> = {};
  const attThieuOut: Record<string, number> = {};
  {
    const { data: ad } = await sb.from("attendance").select("user_id, date, check_in_time, check_out_time, late_minutes")
      .gte("date", monthStartForUsers).lt("date", nextStartForUsers);
    (ad ?? []).forEach((a: any) => {
      if (!a.check_in_time) return;
      (attDays[a.user_id] ||= new Set()).add(String(a.date).slice(0, 10));
      if ((Number(a.late_minutes) || 0) > 0) attTre[a.user_id] = (attTre[a.user_id] || 0) + 1;
      if (!a.check_out_time) attThieuOut[a.user_id] = (attThieuOut[a.user_id] || 0) + 1;
    });
  }

  const sanLuong = await docSanLuong(sb, month);

  const thuongTay = await docThuongTay(sb, month);

  const { data: rules } = await sb.from("bonus_rules")
    .select("*")
    .eq("active", true)
    .order("priority", { ascending: false });

  const { data: channels } = await sb.from("revenue_channels").select("*").eq("active", true);

  const [y, m] = month.split("-").map(Number);
  const nextStart = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const monthStart = `${month}-01`;
  const { data: orders } = await sb.from("orders")
    .select("sale_id, channel, final_revenue, vat_amount, status, order_date")
    .gte("order_date", monthStart)
    .lt("order_date", nextStart);

  const contractMap: Record<string, string> = Object.fromEntries((users ?? []).map((u: any) => [u.id, u.contract_type || ""]));
  const isTrialUser = (uid: string) => /Thử việc/i.test(contractMap[uid] || "");
  const unpaidLeaveMap: Record<string, number> = {};
  const { data: leaves } = await sb.from("leaves")
    .select("user_id, type, status, days, from_date")
    .gte("from_date", monthStart).lt("from_date", nextStart).eq("status", "approved");
  (leaves ?? []).forEach((l: any) => {
    const isUnpaidType = l.type === "ra_ngoai" || l.type === "khong_luong";
    const isTrialPaidType = (l.type === "phep" || l.type === "om") && isTrialUser(l.user_id);
    if (isUnpaidType || isTrialPaidType) {
      unpaidLeaveMap[l.user_id] = (unpaidLeaveMap[l.user_id] || 0) + (l.days || 0);
    }
  });

  const phieuTreo = await layPhieuNghiTreo(sb, month);

  const hourlyRateMap: Record<string, number> = {};
  const hoursWorkedMap: Record<string, number> = {};
  let hourlyColsReady = false;
  {
    const { data: hr, error } = await sb.from("users").select("id, hourly_rate");
    if (!error && hr) {
      hourlyColsReady = true;
      hr.forEach((x: any) => { if (x.hourly_rate) hourlyRateMap[x.id] = Number(x.hourly_rate); });
      const { data: hw } = await sb.from("payroll").select("user_id, hours_worked").eq("month", month);
      (hw ?? []).forEach((x: any) => { if (x.hours_worked) hoursWorkedMap[x.user_id] = Number(x.hours_worked); });
    }
  }

  const attHoursMap: Record<string, number> = {};
  if (hourlyColsReady) {
    const { data: ah } = await sb.from("attendance")
      .select("user_id, check_in_time, check_out_time")
      .gte("date", monthStart).lt("date", nextStart);
    (ah ?? []).forEach((a: any) => {
      if (a.check_in_time && a.check_out_time) {
        const h = (new Date(a.check_out_time).getTime() - new Date(a.check_in_time).getTime()) / 3_600_000;
        if (h > 0) attHoursMap[a.user_id] = (attHoursMap[a.user_id] || 0) + h;
      }
    });
  }

  const ptHoursMap: Record<string, number> = {};
  if (hourlyColsReady) {
    const { data: pts, error } = await sb.from("part_time_shifts")
      .select("user_id, check_in_time, check_out_time")
      .gte("date", monthStart).lt("date", nextStart);
    if (!error) (pts ?? []).forEach((s: any) => {
      if (s.check_in_time && s.check_out_time) {
        const h = (new Date(s.check_out_time).getTime() - new Date(s.check_in_time).getTime()) / 3_600_000;
        if (h > 0) ptHoursMap[s.user_id] = (ptHoursMap[s.user_id] || 0) + h;
      }
    });
  }

  const livestreamMap: Record<string, number> = {};
  {
    const { data: ls, error } = await sb.from("livestream_sessions")
      .select("user_id, amount, session_date")
      .gte("session_date", monthStart).lt("session_date", nextStart);
    if (!error) (ls ?? []).forEach((s: any) => { livestreamMap[s.user_id] = (livestreamMap[s.user_id] || 0) + (s.amount || 0); });
  }
  let livestreamColsReady = false;
  { const { error: pe } = await sb.from("payroll").select("livestream_bonus").limit(1); livestreamColsReady = !pe; }

  const validOrders = (orders ?? []).filter((o: any) =>
    o.sale_id && !["cancelled", "refunded"].includes(o.status)
  );

  const channelVat = new Map<string, number>(
    (channels ?? []).map((c: any) => [c.code, typeof c.vat_rate === "number" ? c.vat_rate : 0.08])
  );

  const rawRevenue: Record<string, Record<string, { gross: number; net: number; count: number }>> = {};
  for (const o of validOrders) {
    const uId = o.sale_id;
    const ch = o.channel || "manual";
    if (!rawRevenue[uId]) rawRevenue[uId] = {};
    if (!rawRevenue[uId][ch]) rawRevenue[uId][ch] = { gross: 0, net: 0, count: 0 };
    const final = o.final_revenue || 0;
    const rate = channelVat.get(o.channel) ?? 0.08;

    const vat = o.vat_amount ?? (rate > 0 ? final * rate / (1 + rate) : 0);
    rawRevenue[uId][ch].gross += final;
    rawRevenue[uId][ch].net += final - vat;
    rawRevenue[uId][ch].count += 1;
  }
  const rawRevenueList: any[] = [];
  for (const uId of Object.keys(rawRevenue)) {
    for (const ch of Object.keys(rawRevenue[uId])) {
      rawRevenueList.push({
        user_id: uId, channel: ch,
        gross_revenue: rawRevenue[uId][ch].gross,
        net_revenue: rawRevenue[uId][ch].net,
        order_count: rawRevenue[uId][ch].count
      });
    }
  }

  const { data: manualAttributions } = await sb.from("revenue_attribution")
    .select("user_id, revenue_amount, attribution_type, source_platform")
    .eq("month", month);

  const revenueMap = aggregateRevenue(
    rawRevenueList,
    (manualAttributions ?? []) as any,
    (channels ?? []) as any
  );

  const userInputs = (users ?? []).map((u: any) => ({
    id: u.id,
    full_name: u.full_name,
    position: u.position || "",
    contract_type: u.contract_type || "Chính thức",
    is_sale: isSalePosition(u.position),
    manager_id: u.manager_id || null
  }));

  const { calcs, teamTotalRevenue, teamBonusTriggered } = runMonthlyCalc({
    users: userInputs,
    revenueMap,
    rules: (rules ?? []) as BonusRule[]
  });

  const hoaHong = await tinhHoaHongThang(sb, month, (users ?? []).map((u: any) => ({ id: u.id, full_name: u.full_name, position: u.position })));
  if (hoaHong) {
    for (const c of calcs as UserBonusCalc[]) {
      const s = hoaHong.theoSale.find((x) => x.userId === c.user_id);
      const loai = detectSaleType(c.position);
      if (loai === "none") continue;
      const hh = s ? s.hoaHong : 0, nhom = s ? s.thuongNhom : 0;
      c.total_revenue_net = s ? s.netKpi : 0;
      c.product_revenue_net = s ? s.netKpi : 0;
      c.individual_bonus = hh;
      c.group_bonus_share = nhom;
      c.auto_total_bonus = hh + nhom;
      c.bonus_explanation = s
        ? `Sổ đơn Telegram ${month}: NET tính KPI ${fmt(s.netKpi)} (${s.kpiPct}% KPI ${trieu(s.target)}) → bậc ${s.bac}: ${s.congThuc}${nhom ? ` + thưởng nhóm ${fmt(nhom)}` : ""}`
        : `Sổ đơn Telegram ${month}: không có đơn ký tên → 0đ`;
    }
  }

  {
    const emailById = Object.fromEntries((users ?? []).map((u: any) => [u.id, String(u.email || "").toLowerCase().trim()]));
    for (const c of calcs as UserBonusCalc[]) {
      const ds = thuongTay[emailById[c.user_id]];
      if (!ds?.length) continue;
      const tong = ds.reduce((a, x) => a + x.tien, 0);
      c.auto_total_bonus += tong;
      c.bonus_explanation = `${c.bonus_explanation ? c.bonus_explanation + " + " : ""}${ds.map((x) => `${x.tien < 0 ? "phạt" : "thưởng"} ${fmt(Math.abs(x.tien))} (${x.lyDo})`).join(" + ")}`;
    }
  }

  const userById = Object.fromEntries((users ?? []).map((u: any) => [u.id, u]));
  const fullPreview = calcs.map(c => {
    const u = userById[c.user_id] || {};
    const grossSalary = u.base_salary || 0;
    const insuranceSalary = u.insurance_salary || 0;

    const ct = u.contract_type || "";
    const noInsurance = /CTV|Part-time|Khoán việc|Dịch ?Vụ|Thử việc/i.test(ct);
    const isTrial = /Thử việc/i.test(ct);

    const isService = /Dịch ?Vụ/i.test(ct);
    const ins = calcInsurance(insuranceSalary, noInsurance);

    const hourlyRate = hourlyRateMap[u.id] || 0;
    const isHourly = hourlyRate > 0;

    const hoursWorked = (hoursWorkedMap[u.id] && hoursWorkedMap[u.id] > 0)
      ? hoursWorkedMap[u.id]
      : Math.round(((ptHoursMap[u.id] || attHoursMap[u.id] || 0)) * 100) / 100;

    let ncStandard: number, ncActual: number, salaryByWorkdays: number;
    const email = String(u.email || "").toLowerCase().trim();
    const sl = sanLuong[email];
    const mienChamCong = chamCong.mien.has(email) || isService || /CTV/i.test(ct);
    let chamCongGhiChu: string | null = null;
    let ngayThieu: string[] = [];
    if (sl) {

      ncStandard = 0; ncActual = 0;
      salaryByWorkdays = Math.min(Math.round(sl.soLuong * sl.donGia), grossSalary > 0 ? grossSalary : Infinity);
      chamCongGhiChu = `khoán ${sl.soLuong} ${sl.donVi || "sản phẩm"} × ${fmt(sl.donGia)}`;
    } else if (isHourly) {
      ncStandard = 0;
      ncActual = 0;
      salaryByWorkdays = Math.round(hourlyRate * hoursWorked);
    } else if (isService) {

      ncStandard = LAW_2026.workDaysStandard;
      ncActual = LAW_2026.workDaysStandard;
      salaryByWorkdays = grossSalary;
    } else {

      const nc = computeMonthlyNC({
        month,
        hireDate: u.hire_date,
        terminatedAt: u.terminated_at,
        unpaidLeaveDays: unpaidLeaveMap[u.id] || 0,
      });
      ncStandard = nc.ncStandard;
      ncActual = nc.ncActual;
      if (!mienChamCong) {

        const { tu: kyTu, den: kyDen } = kyLamViec(month, u.hire_date, u.terminated_at);
        const loaiNgay = chamCong.loai[email] || {};
        const ngayChamTho = [...(attDays[u.id] || [])].filter((d) => d >= kyTu && d <= kyDen).sort();
        const ngayCham = ngayChamTho.filter((d) => !loaiNgay[d]);
        const ngayBiLoai = ngayChamTho.filter((d) => loaiNgay[d]);

        const ngayLamViecTho = danhSachNgayLamViec(kyTu, kyDen);
        const ngayLe = ngayLamViecTho.filter((d) => ngayNghiLe.has(d));
        const ngayLamViec = ngayLamViecTho.filter((d) => !ngayNghiLe.has(d));
        if (ngayChamTho.length === 0) {
          chamCongGhiChu = `KHÔNG có dòng chấm công nào tháng này — tạm tính ${ncActual}/${ncStandard} như cũ, anh kiểm`;
        } else {
          ngayThieu = ngayLamViec.filter((d) => !attDays[u.id]?.has(d));

          const ngayThuongCoCham = new Set(ngayLamViec);
          const chamNgayThuong = ngayCham.filter((d) => ngayThuongCoCham.has(d)).length;
          ncActual = Math.min(chamNgayThuong + ngayLe.length, ncStandard);
          chamCongGhiChu = `chấm công ${chamNgayThuong}/${ngayLamViec.length} ngày` +
            (ngayLe.length ? ` · +${ngayLe.length} ngày nghỉ lễ ăn lương (${ngayLe.map((d) => d.slice(8)).join(",")})` : "") +
            (ngayBiLoai.length ? ` · không tính ${ngayBiLoai.map((d) => `${d.slice(8)} (${loaiNgay[d]})`).join(", ")}` : "") +
            (ngayThieu.length ? ` · thiếu ${ngayThieu.map((d) => d.slice(8)).join(",")}` : "") +
            ((attTre[u.id] || 0) ? ` · trễ ${attTre[u.id]} ngày` : "") +
            ((attThieuOut[u.id] || 0) ? ` · thiếu checkout ${attThieuOut[u.id]}` : "");
        }
      }
      salaryByWorkdays = calcWorkdaySalary(grossSalary, ncActual, ncStandard, isTrial);
    }

    const duoi14 = !isHourly && !isService && !sl && ncStandard > 0 && ncActual < 14;
    const insCuoi = duoi14 ? { employee: 0, employer: 0, base: 0 } : ins;
    if (duoi14 && !noInsurance) chamCongGhiChu = `${chamCongGhiChu ? chamCongGhiChu + " · " : ""}dưới 14 công → không đóng BHXH tháng này`;

    const bonus = c.auto_total_bonus;
    const livestream = livestreamMap[u.id] || 0;
    const personalDeduction = LAW_2026.personalDeduction;
    const dependentDeduction = (u.dependent_count || 0) * LAW_2026.dependentDeduction;
    const totalIncome = salaryByWorkdays + bonus + livestream;
    const taxable = isService ? 0 : Math.max(0, totalIncome - insCuoi.employee - personalDeduction - dependentDeduction);
    const tax = isService ? 0 : calcTax(taxable);
    const net = totalIncome - insCuoi.employee - tax;
    const totalCost = totalIncome + insCuoi.employer;
    const taxPct = grossSalary ? (tax / grossSalary * 100) : 0;

    return {
      ...c,
      contract_type: ct,
      insurance_salary: insuranceSalary,
      base_salary: insuranceSalary,
      gross_salary: grossSalary,
      working_days_standard: ncStandard,
      working_days_actual: ncActual,
      is_hourly: isHourly,
      hourly_rate: hourlyRate,
      hours_worked: hoursWorked,
      livestream_bonus: livestream,
      salary_by_workdays: salaryByWorkdays,
      allowance_phone: 0, allowance_attendance: 0, allowance_lunch: 0, allowance_fuel: 0,
      advance_payment: 0,
      insurance_employee: insCuoi.employee,
      insurance_employer: insCuoi.employer,
      cham_cong: chamCongGhiChu,
      ngay_thieu: ngayThieu,
      personal_deduction: personalDeduction,
      dependent_count: u.dependent_count || 0,
      dependent_deduction: dependentDeduction,
      total_income: totalIncome,
      taxable_income: taxable,
      personal_income_tax: tax,
      tax_pct: taxPct,
      net_salary: net,
      total_company_cost: totalCost
    };
  });

  const { data: committed } = await sb.from("payroll")
    .select("user_id, gross_salary, base_salary, salary_by_workdays, working_days_actual, working_days_standard, allowance_phone, allowance_attendance, allowance_lunch, allowance_fuel, bonus_amount, total_income, employee_insurance, employer_insurance, personal_deduction, dependent_count, dependent_deduction, taxable_income, personal_income_tax, advance_payment, net_salary, total_company_cost, status")
    .eq("month", month);

  return {
    month,
    rules: rules || [],
    channels: channels || [],
    teamTotalRevenue: hoaHong ? hoaHong.tongNetKpiSale : teamTotalRevenue,
    teamBonusTriggered: hoaHong ? hoaHong.thuongNhomPool > 0 : teamBonusTriggered,
    totalBonus: fullPreview.reduce((s, c) => s + c.auto_total_bonus, 0),
    totalPayrollCost: fullPreview.reduce((s, c) => s + c.total_company_cost, 0),
    preview: fullPreview,
    committed: committed || [],
    hourlyColsReady,
    livestreamColsReady,
    hoaHong,
    phieuNghiTreo: phieuTreo.phieu,
    canhBaoNghi: phieuTreo.loi
      ? `KHÔNG ĐỌC ĐƯỢC phiếu nghỉ chờ duyệt (${phieuTreo.loi}) — ngày công tháng này chưa chắc đủ.`
      : (phieuTreo.phieu.length
          ? `Tháng ${month} còn ${tomTatPhieuTreo(phieuTreo.phieu)}. Số ngày công dưới đây CHƯA trừ những phiếu này — duyệt ở /admin/xin-nghi rồi tính lại.`
          : null),
  };
}

export const MANUAL_NUM = [
  "gross_salary", "bonus_amount", "working_days_actual", "working_days_standard",
  "salary_by_workdays", "total_income",
  "allowance_phone", "allowance_attendance", "allowance_lunch", "allowance_fuel",
  "employee_insurance", "employer_insurance", "personal_deduction", "dependent_count",
  "dependent_deduction", "taxable_income", "personal_income_tax", "advance_payment",
  "deduction_penalty", "net_salary", "total_company_cost",
];

export function dungDongLuong(c: any, opts: {
  month: string; finalBonus: number; bonusOverride: number | null;
  truTay?: { advance: number; penalty: number };
  livestreamColsReady: boolean; hourlyColsReady: boolean;
  runId?: string | null; teamTotalRevenue: number; teamBonusTriggered: boolean;
  manualEdit?: { fields: Record<string, number>; reason: string } | null;
  note?: string | null;
}) {
  const { finalBonus } = opts;

  const isSvc = /Dịch ?Vụ/i.test(c.contract_type || "");
  const livestream = c.livestream_bonus || 0;
  const totalIncome = (c.salary_by_workdays ?? c.gross_salary) + finalBonus + livestream;
  const taxable = isSvc ? 0 : Math.max(0, totalIncome - c.insurance_employee - c.personal_deduction - c.dependent_deduction);
  const tax = isSvc ? 0 : calcTax(taxable);
  const advance = opts.truTay?.advance || 0;
  const penalty = opts.truTay?.penalty || 0;
  const net = totalIncome - c.insurance_employee - tax - advance - penalty;
  const totalCost = totalIncome + c.insurance_employer - penalty;

  const row: any = {
    user_id: c.user_id,
    month: opts.month,
    base_salary: c.base_salary,
    salary_by_workdays: c.salary_by_workdays,
    gross_salary: c.gross_salary,
    sales_revenue_net: c.total_revenue_net,
    bonus_amount: finalBonus,
    bonus_auto: c.auto_total_bonus,
    bonus_override: opts.bonusOverride,
    employee_insurance: c.insurance_employee,
    employer_insurance: c.insurance_employer,
    personal_deduction: c.personal_deduction,
    dependent_deduction: c.dependent_deduction,
    taxable_income: taxable,
    personal_income_tax: tax,
    total_income: totalIncome,
    advance_payment: advance,
    deduction_penalty: penalty,
    net_salary: net,
    total_company_cost: totalCost,
    auto_calc_data: {
      applied_rule: c.applied_rule?.name,
      applied_rate: c.applied_rate,
      contract_modifier: c.contract_modifier,
      revenue_breakdown: c.revenue_breakdown,
      product_revenue_net: c.product_revenue_net,
      course_revenue_net: c.course_revenue_net,
      product_commission: c.product_commission,
      course_commission: c.course_commission,
      group_bonus_share: c.group_bonus_share,
      team_total_revenue: opts.teamTotalRevenue,
      team_bonus_triggered: opts.teamBonusTriggered,
      bonus_explanation: c.bonus_explanation,
      run_id: opts.runId ?? null
    },
    working_days_actual: c.working_days_actual ?? 26,
    working_days_standard: c.working_days_standard ?? 26,
    allowance_phone: c.allowance_phone ?? 0,
    allowance_attendance: c.allowance_attendance ?? 0,
    allowance_lunch: c.allowance_lunch ?? 0,
    allowance_fuel: c.allowance_fuel ?? 0,
    ...(opts.livestreamColsReady ? { livestream_bonus: livestream } : {}),
    status: "draft",
    dependent_count: c.dependent_count ?? 0
  };
  if (opts.note != null) row.note = opts.note;

  const me = opts.manualEdit;
  if (me?.fields) {
    for (const k of MANUAL_NUM) {
      if (me.fields[k] !== undefined && me.fields[k] !== null) row[k] = Math.round(Number(me.fields[k]) || 0);
    }
  }

  if (opts.hourlyColsReady) {
    const h = me?.fields?.hours_worked;
    const hours = (h !== undefined && h !== null) ? (Number(h) || 0) : (c.hours_worked || 0);
    row.hours_worked = hours;

    if (c.is_hourly && (me?.fields?.salary_by_workdays === undefined || me?.fields?.salary_by_workdays === null)) {
      const sal = Math.round((c.hourly_rate || 0) * hours);
      row.salary_by_workdays = sal;
      const totalIncome2 = sal + finalBonus;
      const taxable2 = Math.max(0, totalIncome2 - c.insurance_employee - c.personal_deduction - c.dependent_deduction);
      const tax2 = calcTax(taxable2);
      row.total_income = totalIncome2;
      row.taxable_income = taxable2;
      row.personal_income_tax = tax2;
      row.net_salary = totalIncome2 - c.insurance_employee - tax2 - advance - penalty;
      row.total_company_cost = totalIncome2 + c.insurance_employer - penalty;
    }
  }
  return row;
}

export type KetQuaChayLuong = {
  thang: string;
  trangThai: "da-ghi" | "chi-bao-cao" | "bo-qua";
  lyDo: string;
  soDong: number;
  tongThucLinh: number;
  tongChiPhi: number;
  tongHoaHong: number;
  viecCanCeo: string[];
  baoCao: string[];
  markdown: string;
  xemTruoc: XemTruocLuong | null;
};

const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function chiaTin(text: string, tran = 3800): string[] {
  const out: string[] = [];
  let cur = "";
  for (const line of text.split("\n")) {
    if ((cur + "\n" + line).length > tran && cur) { out.push(cur); cur = line; }
    else cur = cur ? cur + "\n" + line : line;
  }
  if (cur) out.push(cur);
  return out;
}

export function viecCanCeo(xt: XemTruocLuong, hh: HoaHongThang | null, month: string): string[] {
  const v: string[] = [];
  for (const c of xt.preview) {
    if (c.is_hourly && !(c.hours_worked > 0) && !c.cham_cong) v.push(`${c.full_name}: trả theo giờ (${fmt(c.hourly_rate)}/giờ) mà tháng này chưa có số giờ/số sản phẩm → lương đang 0đ; ghi vào config luong_san_luong_${month} rồi tính lại.`);
    if (c.ngay_thieu?.length >= 3) v.push(`${c.full_name}: thiếu chấm công ${c.ngay_thieu.length} ngày (${c.ngay_thieu.map((d: string) => d.slice(8)).join(", ")}) — đã trừ công; nếu là nghỉ có lý do thì anh sửa tay.`);
  }
  if (hh) {
    for (const s of hh.theoSale) {
      if (s.chuaXacMinh.don) v.push(`${s.ten}: ${s.chuaXacMinh.don} đơn (${trieu(s.chuaXacMinh.tienNet)} net) chưa có vận đơn/tiền về — tạm chưa tính, sale đưa mã vận đơn thì cộng vào tháng sau.`);
    }
    if (hh.chuaRo.don) v.push(`${hh.chuaRo.don} đơn không có chữ ký sale (${trieu(hh.chuaRo.khachTra)}) — gán ở /gan-don nếu là của ai đó.`);
  }
  v.push(`Thưởng chiến dịch / thưởng động viên / phạt: máy không tự đặt — anh nói, em ghi vào config luong_thuong_tay_${month} rồi tính lại (hoặc sửa tay ở /bang-luong).`);
  return v;
}

export function dungBaoCao(month: string, xt: XemTruocLuong, hh: HoaHongThang | null, trangThai: KetQuaChayLuong["trangThai"], lyDo: string, lech: string[]): { baoCao: string[]; markdown: string } {
  const [y, m] = month.split("-");
  const L: string[] = [];
  const tongNet = xt.preview.reduce((s, c) => s + c.net_salary, 0);
  const tongCost = xt.preview.reduce((s, c) => s + c.total_company_cost, 0);
  const tongBonus = xt.preview.reduce((s, c) => s + c.auto_total_bonus, 0);

  L.push(`<b>BẢNG LƯƠNG THÁNG ${m}/${y} — ${trangThai === "da-ghi" ? "đã tính, chờ anh duyệt" : trangThai === "chi-bao-cao" ? "đã có sẵn, em chỉ đối chiếu hoa hồng" : "chưa ghi"}</b>`);
  L.push(`<i>${esc(lyDo)}</i>`);
  L.push(`${xt.preview.length} người · thực lĩnh <b>${fmt(tongNet)}</b> · chi phí DN <b>${fmt(tongCost)}</b> · hoa hồng ${fmt(tongBonus)}`);
  L.push("");

  if (hh) {
    L.push(`<b>HOA HỒNG SALE — sổ đơn Telegram ${hh.tu} → ${hh.den}</b>`);
    L.push(`Nguồn: ${hh.nguon.soDon} đơn · vận đơn J&T ${hh.nguon.jtSoVanDon} (tới ${hh.nguon.jtToi || "trống"}) · sổ phụ ngân hàng tới ${hh.nguon.nhToi || "trống"} · ship TB ${fmt(hh.shipTB)}`);
    for (const s of hh.theoSale) {
      if (s.loai === "none" && s.soDon < 3) continue;
      L.push("");
      L.push(`<b>${esc(s.ten)}</b> — ${esc(s.viTri || "?")}${s.loai !== "none" ? ` · KPI ${trieu(s.target)}` : ""}`);
      L.push(`  bán ${s.soDon} đơn · khách trả ${fmt(s.khachTra)}`);
      if (s.hoan.don) L.push(`  − hoàn về ${s.hoan.don} đơn (${fmt(s.hoan.tienNet)} net)`);
      if (s.chuaXacMinh.don) L.push(`  − chưa xác minh ${s.chuaXacMinh.don} đơn (${fmt(s.chuaXacMinh.tienNet)} net) → chuyển tháng sau`);
      L.push(`  − VAT 8% · quà theo giá vốn ${fmt(s.quaVon)} · ship ${fmt(s.ship)}`);
      if (s.thangTruocVe.don) L.push(`  + ${s.thangTruocVe.don} đơn tháng trước nay đã có vận đơn: ${fmt(s.thangTruocVe.tienNet)}`);
      L.push(`  = NET tính KPI <b>${fmt(s.netKpi)}</b> (${s.kpiPct}% KPI)`);
      L.push(`  → bậc ${esc(s.bac)}: ${esc(s.congThuc)} = <b>${fmt(s.hoaHong)}</b>${s.thuongNhom ? ` + nhóm ${fmt(s.thuongNhom)}` : ""}`);
      for (const g of s.ghiChu) L.push(`  ! ${esc(g)}`);
    }
    if (hh.chuaRo.don) L.push(`\nChưa rõ sale: ${hh.chuaRo.don} đơn · ${fmt(hh.chuaRo.khachTra)} — ${hh.chuaRo.ds.slice(0, 6).map((d) => `${d.ngay.slice(5)} ${esc(d.khach || "?")} ${trieu(d.khachTra)}`).join(" · ")}${hh.chuaRo.don > 6 ? " …" : ""}`);
    if (hh.si.don) L.push(`Đơn sỉ đã tách: ${hh.si.don} đơn · ${fmt(hh.si.khachTra)}`);
    L.push(`Tổng NET đội sale ${fmt(hh.tongNetKpiSale)} — mốc thưởng nhóm 500tr${hh.thuongNhomPool ? ` → pool ${fmt(hh.thuongNhomPool)}` : " (chưa chạm)"}`);
    for (const c of hh.canhBao) L.push(`! ${esc(c)}`);
  } else {
    L.push("<b>HOA HỒNG:</b> tháng này sổ đơn Telegram không có đơn — hoa hồng lấy theo bảng orders cũ (engine).");
  }

  L.push("");
  L.push("<b>TỪNG NGƯỜI (thực lĩnh)</b>");
  for (const c of [...xt.preview].sort((a, b) => b.net_salary - a.net_salary)) {
    const nc = c.cham_cong ? c.cham_cong : c.is_hourly ? `${c.hours_worked}h` : `${c.working_days_actual}/${c.working_days_standard} (miễn chấm công)`;
    L.push(`${esc(c.full_name)}: <b>${fmt(c.net_salary)}</b> — ${esc(nc)}${c.auto_total_bonus ? ` · thưởng ${fmt(c.auto_total_bonus)}` : ""}${c.personal_income_tax ? ` · thuế ${fmt(c.personal_income_tax)}` : ""}${c.insurance_employee ? ` · BHXH ${fmt(c.insurance_employee)}` : ""}`);
  }
  if (lech.length) { L.push(""); L.push(`<b>CHỖ CẦN KIỂM (${lech.length}):</b>`); for (const x of lech) L.push(`  - ${esc(x)}`); }

  L.push("");
  L.push("<b>VIỆC CẦN ANH QUYẾT</b>");
  for (const v of viecCanCeo(xt, hh, month)) L.push(`- ${esc(v)}`);
  L.push("");
  L.push(`Mở bảng: ikihealing-hub.example.com/bang-luong?m=${month} — duyệt xong nhân viên mới xem được phiếu.`);

  const text = L.join("\n");
  const markdown = text.replace(/<\/?b>/g, "**").replace(/<\/?i>/g, "_").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  return { baoCao: chiaTin(text), markdown };
}

export async function chayLuongThang(sb: any, opts: { thang: string; ghi: boolean; lyDo?: string; ghiLai?: boolean }): Promise<KetQuaChayLuong> {
  const { thang } = opts;
  const xt = await xemTruocLuongThang(sb, thang);
  const hh = xt.hoaHong;

  let { data: daCo } = await sb.from("payroll").select("id, status").eq("month", thang);

  if (opts.ghiLai && opts.ghi && (daCo || []).length && (daCo || []).every((r: any) => r.status === "draft")) {
    await sb.from("payroll").delete().eq("month", thang).eq("status", "draft");
    await sb.from("config").delete().eq("key", `luong_thang_da_ghi_${thang}`);
    daCo = [];
  }
  const daCoDong = (daCo || []).length;
  let trangThai: KetQuaChayLuong["trangThai"] = "bo-qua";
  let lyDo = opts.lyDo || "";

  const khacThangTruoc: string[] = [];
  try {
    const { data: truoc } = await sb.from("payroll").select("user_id, gross_salary, status").eq("month", thangTruoc(`${thang}-01`)).in("status", ["approved", "paid"]);
    for (const c of xt.preview) {
      const t = (truoc || []).find((r: any) => r.user_id === c.user_id);
      if (t && !c.is_hourly && Math.abs((t.gross_salary || 0) - c.gross_salary) > 1000)
        khacThangTruoc.push(`${c.full_name}: lương HĐ trong sổ nhân sự ${fmt(c.gross_salary)} khác tháng trước đã duyệt ${fmt(t.gross_salary)} — bên nào đúng?`);
    }
  } catch {  }

  let mayDaGhi: any = null;
  try {
    const { data } = await sb.from("config").select("value").eq("key", `luong_thang_da_ghi_${thang}`).maybeSingle();
    mayDaGhi = data?.value ? JSON.parse(data.value) : null;
  } catch {  }

  if (daCoDong && mayDaGhi) {
    trangThai = "da-ghi";
    lyDo = `${lyDo ? lyDo + " — " : ""}máy đã ghi ${mayDaGhi.soDong} dòng DRAFT lúc ${String(mayDaGhi.at).slice(0, 16).replace("T", " ")} (giờ UTC), đang chờ anh duyệt ở /bang-luong; không ghi lại để giữ sửa tay`;
  } else if (daCoDong) {
    trangThai = "chi-bao-cao";
    lyDo = `${lyDo ? lyDo + " — " : ""}tháng ${thang} đã có ${daCoDong} dòng lương (${[...new Set((daCo || []).map((r: any) => r.status))].join(", ")}) do người tính → KHÔNG ghi đè, chỉ gửi hoa hồng để đối chiếu`;
  } else if (opts.ghi) {
    let runId: string | null = null;
    try {
      const { data: run } = await sb.from("bonus_calc_runs").insert({
        month: thang, status: "committed", total_revenue: xt.teamTotalRevenue, total_bonus: xt.totalBonus,
        total_payroll_cost: xt.totalPayrollCost, users_count: xt.preview.length, team_bonus_triggered: xt.teamBonusTriggered,
        committed_at: new Date().toISOString(), notes: "máy tính tự động (lib/luong-thang.ts)",
      }).select("id").single();
      runId = run?.id ?? null;
    } catch {  }
    const rows = xt.preview.map((c) => {
      const s = hh?.theoSale.find((x) => x.userId === c.user_id);
      const note = s && (s.loai === "leader_sale" || s.loai === "sale" || s.loai === "truc_page")
        ? `Máy tính ${vnHomNay()}: ${c.bonus_explanation}${s.chuaXacMinh.don ? `. Chưa tính ${s.chuaXacMinh.don} đơn chờ xác minh (${fmt(s.chuaXacMinh.tienNet)} net) — chuyển tháng sau.` : ""}${s.hoan.don ? ` Trừ ${s.hoan.don} đơn hoàn.` : ""}`
        : c.auto_total_bonus && c.bonus_explanation ? `Máy tính ${vnHomNay()}: ${c.bonus_explanation}` : null;
      return dungDongLuong(c, {
        month: thang, finalBonus: c.auto_total_bonus, bonusOverride: null,
        livestreamColsReady: xt.livestreamColsReady, hourlyColsReady: xt.hourlyColsReady,
        runId, teamTotalRevenue: xt.teamTotalRevenue, teamBonusTriggered: xt.teamBonusTriggered, note,
      });
    });
    const { error } = await sb.from("payroll").upsert(rows, { onConflict: "user_id,month" });
    if (error) throw new Error("ghi payroll hỏng: " + error.message);
    trangThai = "da-ghi";
    lyDo = `${lyDo ? lyDo + " — " : ""}đã ghi ${rows.length} dòng DRAFT`;
    try {
      await sb.from("config").upsert({ key: `luong_thang_da_ghi_${thang}`, value: JSON.stringify({ at: new Date().toISOString(), soDong: rows.length }), description: "Máy tính lương đã ghi draft tháng này — lượt sau không ghi lại" }, { onConflict: "key" });
    } catch {  }
    if (hh) {
      try {
        await sb.from("config").upsert({ key: `luong_cho_xac_minh_${thang}`, value: JSON.stringify(hh.choXacMinhGhiConfig), description: `Đơn ${thang} chưa xác minh lúc chốt lương — tháng sau máy kiểm lại vận đơn` }, { onConflict: "key" });
      } catch {  }
    }
  } else {
    lyDo = `${lyDo ? lyDo + " — " : ""}xem thử, không ghi`;
  }

  const lech: string[] = [];
  for (const c of xt.preview) {
    const thuNhap = c.salary_by_workdays + c.auto_total_bonus + (c.livestream_bonus || 0);
    if (Math.abs(thuNhap - c.total_income) > 1) lech.push(`${c.full_name}: tổng thu nhập ${fmt(c.total_income)} ≠ cộng lại ${fmt(thuNhap)}`);
    const net = c.total_income - c.insurance_employee - c.personal_income_tax;
    if (Math.abs(net - c.net_salary) > 1) lech.push(`${c.full_name}: thực lĩnh ${fmt(c.net_salary)} ≠ tính lại ${fmt(net)}`);
  }

  const { baoCao, markdown } = dungBaoCao(thang, xt, hh, trangThai, lyDo, [...lech, ...khacThangTruoc]);
  return {
    thang, trangThai, lyDo, soDong: xt.preview.length,
    tongThucLinh: xt.preview.reduce((s, c) => s + c.net_salary, 0),
    tongChiPhi: xt.preview.reduce((s, c) => s + c.total_company_cost, 0),
    tongHoaHong: xt.preview.reduce((s, c) => s + c.auto_total_bonus, 0),
    viecCanCeo: viecCanCeo(xt, hh, thang),
    baoCao, markdown, xemTruoc: xt,
  };
}
