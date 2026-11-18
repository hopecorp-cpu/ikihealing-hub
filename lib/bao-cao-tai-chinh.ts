import { getConfigValue } from "@/lib/app-config";
import { layDoanhThu, type DongDoanhThu } from "@/lib/doanh-thu";
import { laiTrongKy } from "@/lib/lai-vay";
import { khoaKhopTen } from "@/lib/kho-van-dong";
import { VAT_RATE } from "@/lib/money";

export type CheDoKy = "tuan" | "thang" | "quy" | "nam";
export type Ky = { key: string; nhan: string; tu: string; den: string };

const NGAY = 86_400_000;
const ms = (s: string) => new Date(`${s}T00:00:00Z`).getTime();
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);
const dm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

export function dungKy(che: CheDoKy, nam: number, den: string): Ky[] {
  const dauNam = `${nam}-01-01`, cuoiNam = `${nam}-12-31`;
  const het = den < cuoiNam ? den : cuoiNam;
  const out: Ky[] = [];
  if (che === "nam") return [{ key: String(nam), nhan: `Năm ${nam}`, tu: dauNam, den: het }];
  if (che === "quy") {
    for (let q = 1; q <= 4; q++) {
      const tu = `${nam}-${String(q * 3 - 2).padStart(2, "0")}-01`;
      if (tu > het) break;
      const cuoi = ymd(Date.UTC(nam, q * 3, 0));
      out.push({ key: `${nam}-Q${q}`, nhan: `Quý ${q}`, tu, den: cuoi < het ? cuoi : het });
    }
    return out;
  }
  if (che === "thang") {
    for (let m = 1; m <= 12; m++) {
      const tu = `${nam}-${String(m).padStart(2, "0")}-01`;
      if (tu > het) break;
      const cuoi = ymd(Date.UTC(nam, m, 0));
      out.push({ key: tu.slice(0, 7), nhan: `T${m}/${String(nam).slice(2)}`, tu, den: cuoi < het ? cuoi : het });
    }
    return out;
  }

  const d0 = new Date(ms(dauNam));
  let t = ms(dauNam) - ((d0.getUTCDay() + 6) % 7) * NGAY;
  while (ymd(t) <= het) {
    const tu = ymd(Math.max(t, ms(dauNam)));
    const cuoi = ymd(t + 6 * NGAY);
    const den2 = cuoi < het ? cuoi : het;
    out.push({ key: `W${ymd(t)}`, nhan: `${dm(tu)}–${dm(den2)}`, tu, den: den2 });
    t += 7 * NGAY;
  }
  return out;
}

export type Nhom = "kd" | "dt" | "tc" | "nb";
type HangMuc = { key: string; nhan: string; chieu: "thu" | "chi"; nhom: Nhom; vaoKqkd?: boolean };

export const HANG_MUC: HangMuc[] = [
  { key: "thu_cod", nhan: "Thu COD J&T", chieu: "thu", nhom: "kd" },
  { key: "thu_san", nhan: "Tiền về từ sàn TMĐT", chieu: "thu", nhom: "kd" },
  { key: "thu_cong", nhan: "Thu qua cổng/đối tác thanh toán", chieu: "thu", nhom: "kd" },
  { key: "thu_ck", nhan: "Khách chuyển khoản", chieu: "thu", nhom: "kd" },
  { key: "thu_nop", nhan: "Nộp tiền mặt bán hàng", chieu: "thu", nhom: "kd" },
  { key: "thu_hoan_ncc", nhan: "Hoàn tiền từ nhà cung cấp", chieu: "thu", nhom: "kd" },
  { key: "thu_lai", nhan: "Lãi tiền gửi", chieu: "thu", nhom: "kd" },
  { key: "thu_vay", nhan: "Vay, góp vốn", chieu: "thu", nhom: "tc" },
  { key: "mua_hang", nhan: "Mua hàng, bao bì", chieu: "chi", nhom: "kd" },
  { key: "luong", nhan: "Lương, thưởng", chieu: "chi", nhom: "kd" },
  { key: "bhxh", nhan: "BHXH, BHYT", chieu: "chi", nhom: "kd" },
  { key: "thue", nhan: "Thuế nộp ngân sách", chieu: "chi", nhom: "kd" },
  { key: "quang_cao", nhan: "Quảng cáo, truyền thông", chieu: "chi", nhom: "kd", vaoKqkd: true },
  { key: "phan_mem", nhan: "Phần mềm, AI, hạ tầng", chieu: "chi", nhom: "kd", vaoKqkd: true },
  { key: "thue_vp", nhan: "Thuê văn phòng, mặt bằng", chieu: "chi", nhom: "kd", vaoKqkd: true },
  { key: "dich_vu", nhan: "Dịch vụ thuê ngoài, tư vấn", chieu: "chi", nhom: "kd", vaoKqkd: true },
  { key: "kiem_nghiem", nhan: "Kiểm nghiệm, hồ sơ sản phẩm", chieu: "chi", nhom: "kd", vaoKqkd: true },
  { key: "van_chuyen", nhan: "Phí vận chuyển J&T (theo vận đơn)", chieu: "chi", nhom: "kd", vaoKqkd: true },
  { key: "phi_san", nhan: "Phí sàn TMĐT", chieu: "chi", nhom: "kd", vaoKqkd: true },
  { key: "dien_nuoc", nhan: "Điện, nước, viễn thông", chieu: "chi", nhom: "kd", vaoKqkd: true },
  { key: "di_lai", nhan: "Đi lại, xăng xe, phí đường", chieu: "chi", nhom: "kd", vaoKqkd: true },
  { key: "dao_tao", nhan: "Đào tạo, huấn luyện, sách", chieu: "chi", nhom: "kd", vaoKqkd: true },
  { key: "phuc_loi", nhan: "Phúc lợi nhân viên", chieu: "chi", nhom: "kd", vaoKqkd: true },
  { key: "phap_ly", nhan: "Pháp lý, hành chính", chieu: "chi", nhom: "kd", vaoKqkd: true },
  { key: "van_phong", nhan: "Văn phòng phẩm, sửa chữa nhỏ", chieu: "chi", nhom: "kd", vaoKqkd: true },
  { key: "hoan_khach", nhan: "Hoàn tiền khách", chieu: "chi", nhom: "kd", vaoKqkd: true },
  { key: "hoan_ung", nhan: "Hoàn ứng cá nhân chi hộ", chieu: "chi", nhom: "kd", vaoKqkd: true },
  { key: "phi_nh", nhan: "Phí ngân hàng", chieu: "chi", nhom: "kd", vaoKqkd: true },
  { key: "lai_vay", nhan: "Trả lãi vay", chieu: "chi", nhom: "kd" },
  { key: "rut_tien", nhan: "Rút tiền mặt", chieu: "chi", nhom: "kd" },
  { key: "dat_coc", nhan: "Đặt cọc (được trả lại)", chieu: "chi", nhom: "kd" },
  { key: "chi_khac", nhan: "Chi khác (chưa phân loại)", chieu: "chi", nhom: "kd", vaoKqkd: true },
  { key: "tai_san", nhan: "Mua tài sản, thiết bị", chieu: "chi", nhom: "dt" },
  { key: "tra_goc", nhan: "Trả gốc vay", chieu: "chi", nhom: "tc" },
  { key: "noi_bo_thu", nhan: "Nhận chuyển nội bộ (MB → TCB)", chieu: "thu", nhom: "nb" },
  { key: "noi_bo_chi", nhan: "Chuyển nội bộ sang TK khác", chieu: "chi", nhom: "nb" },
];
export const HM = Object.fromEntries(HANG_MUC.map((h) => [h.key, h])) as Record<string, HangMuc>;

const REF_VAY = new Set(["TT26028057212872", "TT26014229167333", "FT25349346000335"]);

const REF_TRA_GOC = new Set(["FT26086072053416", "FT26170574075075"]);

export const TRA_TRUOC: { ref: string; tu: string; den: string; chiPhi: number; hangMuc: string; ghiChu: string }[] = [
  { ref: "FT26031900428052", tu: "2026-02-02", den: "2027-02-01", chiPhi: 199_000_000, hangMuc: "dao_tao",
    ghiChu: "HĐ tư vấn & huấn luyện AI cho doanh nghiệp 12 tháng — Cty TNHH Công nghệ và Giáo dục Taki (199tr + VAT 8% 15,92tr)" },
  { ref: "FT26264306818213", tu: "2026-10-01", den: "2027-03-31", chiPhi: 84_000_000, hangMuc: "thue_vp",
    ghiChu: "Thuê nhà 40 Quang Trung kỳ 1 (6 tháng × 14tr), HĐ 21.09.26/HDTN/ACME Corp" },
  { ref: "FT26068281775627", tu: "2026-03-01", den: "2026-09-30", chiPhi: 30_000_000, hangMuc: "thue_vp",
    ghiChu: "Phí thuê mặt bằng tháng 3-9/2026 (theo nội dung CK)" },
  { ref: "FT26141580040283", tu: "2026-05-21", den: "2026-11-20", chiPhi: 48_000_000, hangMuc: "thue_vp",
    ghiChu: "Thuê nhà: CK 56tr = 1 tháng cọc 8tr + 6 tháng 48tr (theo nội dung CK; ngày bắt đầu tạm lấy ngày chi)" },
];
const REF_TRA_TRUOC = new Map(TRA_TRUOC.map((x) => [x.ref, x]));

export type GiaoDich = {
  id: string; ref: string; ngay: string; tien: number; chieu: "thu" | "chi"; nganHang: "MB" | "TCB";
  noiDung: string; tomTat: string; hangMuc: string; suaTay: boolean;
};

const bo = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toUpperCase();

export function phanLoai(t: { ref?: string; amount: number; type: string; details?: string; cat?: string; isJt?: boolean }): string {
  const a = t.amount;

  const goc = bo(t.details || "");
  const so = Number(a).toLocaleString("en-US", { minimumFractionDigits: 2 });
  const vt = goc.indexOf(so);
  const s = vt >= 0 ? goc.slice(0, vt + so.length + 80) : goc;
  if (t.type === "credit") {
    if (REF_VAY.has(t.ref || "")) return "thu_vay";
    if (t.isJt) return "thu_cod";
    if (/IBT-MB.*NOI BO|NOI BO.*IBT-MB|CK TK NOI BO|TK NOI BO CUA/.test(s)) return "noi_bo_thu";
    if (t.cat === "Shopee" || /SHOPEE|WSS SELLER|TIKTOK SHOP/.test(s)) return "thu_san";
    if (t.cat === "Lãi nhập vốn" || /TRA LAI SO DU|LAI NHAP VON/.test(s)) return "thu_lai";
    if (/CREDIT\/REV|REFUND|HOAN TIEN/.test(s)) return "thu_hoan_ncc";
    if (/CTCP DICH VU CONG|VINAPASS|PAYOS|VNPAY|MOMO/.test(s)) return "thu_cong";
    if (/NOP TIEN/.test(s)) return "thu_nop";
    return "thu_ck";
  }
  const tt = REF_TRA_TRUOC.get(t.ref || "");
  if (tt) return tt.hangMuc;
  if (t.type === "fee" || /PHI DV QUAN LY TK|PHI QUAN LY TAI KHOAN|SMS# TRU PHI/.test(s) && a < 200_000) return "phi_nh";
  if (REF_TRA_GOC.has(t.ref || "")) return "tra_goc";
  if (/SANG TK NOI BO|TK NOI BO CUA|CK TK NOI BO|NOI BO CTY|CHUYEN CHI PHI DANH CHO ADS/.test(s)) return "noi_bo_chi";
  if (/LAI VAY/.test(s)) return "lai_vay";
  if (/\bLUONG\b|THUONG TET|TIEN LUONG|THANG 13/.test(s)) return "luong";
  if (/BAO HIEM XA HOI|TT BH\b|BHXH/.test(s)) return "bhxh";
  if (/KBNN|NTDT|TKNS|NGAN SACH/.test(s)) return "thue";
  if (/DAT COC HD/.test(s)) return "dat_coc";
  if (/THUE NHA|MAT BANG|TIEN THUE KY/.test(s)) return "thue_vp";
  if (/RV NUTRITION|TVG PRO|CONG TY CO PHAN RV|TIEN HANG|NHAP HANG|NHAP TRA|NHAP MAT ONG|PHI NHAP|NHAP DUONG|NHAP TUI|NHAP MUO|NHAP TUONG|COC LO HANG|SAN PHAM B|COFFEE CONCEPT|BAO BI|TRUC IN|HOP DONG TRUC|TIEN SACH|SHIP COD NHAP|TIEN NHAP|\bNHAP (DAU|SACH|KDR|COT|MAT|DUONG|TUI|TRA|HANG|SP|BOT)/.test(s)) return "mua_hang";
  if (/KIEM NGHIEM|PHI XN|CP XN|EUROFINS/.test(s)) return "kiem_nghiem";
  if (/GIAO DUC TAKI|TNHH CONG \d|0900000002 CONG TY TNHH CONG/.test(s)) return "dao_tao";
  if (/AC QUY|VE MAY BAY|MAY BAY|BAY TRUC TUYEN/.test(s)) return "di_lai";
  if (/TAM UNG/.test(s) && !/TIEN HANG/.test(s)) return "hoan_ung";
  if (/(PHI DICH VU|PDV|CP DV)\b.*TU VAN|TU VAN.*(PHI DICH VU|PDV|CP DV)/.test(s)) return "dich_vu";
  if (/HOAN TIEN CHO KHACH|HOAN TIEN KHACH/.test(s)) return "hoan_khach";
  if (/CA NHAN UNG|CHI HO|UNG TRUOC/.test(s)) return "hoan_ung";
  if (/RUT TIEN/.test(s)) return "rut_tien";
  if (/MUA THIET BI|THIET BI MT|NOI THAT/.test(s)) return a >= 10_000_000 ? "tai_san" : "van_phong";
  if (/SUA THIET BI|VAN PHONG PHAM|MAY LOC NUOC|NUOC RUA BAT/.test(s)) return "van_phong";
  if (/SC XE|SUA XE|THACO/.test(s)) return "di_lai";
  if (/ZOOM|APP QUAN TRI|TAO HE THONG/.test(s)) return "phan_mem";
  if (/DI HOC|KHOA HOC|DAO TAO/.test(s)) return "dao_tao";
  if (/LIEN HOAN|SINH NHAT|TRI LIEU|TAT NIEN|TRUNG THU|QUA TANG/.test(s)) return "phuc_loi";
  if (/DICH THUAT|DKKD|CONG CHUNG/.test(s)) return "phap_ly";
  if (/ONETIK|TRUYEN THONG|QUANG CAO/.test(s)) return "quang_cao";
  if (t.cat === "Facebook / Meta ads" || t.cat === "TikTok ads" || t.cat === "Google (Cloud/Ads/Play)") return "quang_cao";
  if (t.cat === "Hạ tầng / SaaS" || t.cat === "AI / công cụ sáng tạo") return "phan_mem";
  if (t.cat === "Shopee") return "phi_san";
  if (a < 10_000_000) {
    if (/FACEBK|FACEBOOK/.test(s)) return "quang_cao";
    if (/ANTHROPIC|CLAUDE|OPENAI|CHATGPT|NOTION|VERCEL|CANVA|MANYCHAT|TURBOSCRIBE|GAMMA|GOOGLE ONE|APPLE\.COM|KAKAO|MISA|CLOUDPOT|SUPABASE|GITHUB|PAYOO/.test(s)) return "phan_mem";
    if (/EPASS|PLX|PETROLIMEX/.test(s)) return "di_lai";
    if (/HOTLINE|INTERNET|FPT|VNPT|WATER|DIEN LUC/.test(s)) return "dien_nuoc";
  }
  return "chi_khac";
}

const DOI_TAC_QUEN: [RegExp, string][] = [
  [/CAXA/, "Cty TNHH Tư vấn và Đầu tư Caxa"],
  [/GIAO DUC TAKI|TNHH CONG 22\/05|0900000002 CONG TY TNHH CONG/, "Cty TNHH Công nghệ và Giáo dục Taki"],
  [/RV NUTRITION|CONG TY CO PHAN RV/, "RV Nutrition (sản xuất đạm)"],
  [/THUAN PHONG THANH TOAN COD|CONG TY THUAN PHONG/, "J&T (Thuận Phong) trả COD"],
  [/BAO HIEM XA HOI/, "BHXH"],
];

export function tomTatNoiDung(details: string, amount: number): string {
  const tat = tomTatTho(details, amount);
  const so = amount.toLocaleString("en-US", { minimumFractionDigits: 2 });
  const goc = bo(details);
  const vt = goc.indexOf(so);
  const cua = vt >= 0 ? goc.slice(0, vt + so.length + 80) : goc;
  const dt = DOI_TAC_QUEN.find(([re]) => re.test(cua))?.[1];
  return dt ? `${dt} · ${tat}` : tat;
}

function tomTatTho(details: string, amount: number): string {
  const s = (details || "").replace(/Chứng từ này được xuất tự động[^.]*\.\/?[^.]*\.?/g, " ").replace(/\s+/g, " ").trim();
  const m = s.match(/(CTY ACME|ACME TT|ACME THANH TOAN|MBCT CTY ACME|CTU ACME)[^#]{0,90}/i);
  if (m) return m[0].replace(/\s*-?\s*Ma giao dich.*$/i, "").trim();
  const so = amount.toLocaleString("en-US", { minimumFractionDigits: 2 });
  const i = s.indexOf(so);
  const sau = i >= 0 ? s.slice(i + so.length).trim() : s;
  return sau.slice(0, 100) || "(sổ phụ không còn nội dung — xem app ngân hàng theo ngày và số tiền)";
}

const idGd = (t: any, nh: string) => `${nh}|${t.ref || t.date}|${t.amount}|${t.type}`;

async function docJson<T>(key: string): Promise<T | null> {
  try { const raw = await getConfigValue(key); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
}

export async function layGiaoDich(): Promise<{ ds: GiaoDich[]; tu: string | null; den: string | null; soDuCuoi: number }> {
  const [mb, tcb, mbL, tcbL, sua] = await Promise.all([
    docJson<any[]>("mb_transactions"), docJson<any[]>("tcb_transactions"),
    docJson<any>("mb_latest"), docJson<any>("tcb_latest"), docJson<Record<string, string>>("bctc_phan_loai"),
  ]);
  const ds: GiaoDich[] = [];
  const nap = (arr: any[] | null, nh: "MB" | "TCB") => {
    for (const t of arr || []) {
      if (!t?.date || !(Number(t.amount) > 0)) continue;
      const id = idGd(t, nh);
      const tay = sua?.[id];
      const hm = tay && HM[tay] ? tay : phanLoai(t);
      ds.push({ id, ref: String(t.ref || ""), ngay: t.date, tien: Number(t.amount), chieu: t.type === "credit" ? "thu" : "chi", nganHang: nh,
        noiDung: String(t.details || "").replace(/\s+/g, " ").trim().slice(0, 220),
        tomTat: REF_TRA_TRUOC.get(String(t.ref || ""))?.ghiChu || tomTatNoiDung(String(t.details || ""), Number(t.amount)), hangMuc: hm, suaTay: !!(tay && HM[tay]) });
    }
  };
  nap(mb, "MB"); nap(tcb, "TCB");

  const NGAY4 = 4 * 86_400_000;
  for (const v of ds.filter((g) => g.nganHang === "TCB" && g.chieu === "thu" && !g.suaTay && (g.hangMuc === "thu_ck" || g.hangMuc === "noi_bo_thu") && g.tien >= 1_000_000)) {
    const r = ds.find((g) => g.nganHang === "MB" && g.chieu === "chi" && !g.suaTay && g.tien === v.tien &&
      Math.abs(ms(g.ngay) - ms(v.ngay)) <= NGAY4 && (g.hangMuc === "noi_bo_chi" || g.hangMuc === "chi_khac"));
    if (r) { v.hangMuc = "noi_bo_thu"; r.hangMuc = "noi_bo_chi"; }
  }
  ds.sort((a, b) => a.ngay.localeCompare(b.ngay));
  return {
    ds, tu: ds[0]?.ngay || null, den: ds[ds.length - 1]?.ngay || null,
    soDuCuoi: (Number(mbL?.balance?.closing) || 0) + (Number(tcbL?.balance?.closing) || 0),
  };
}

type BangGiaVon = { khop: (ten: string) => number | null };

async function bangGiaVon(sb: any): Promise<BangGiaVon> {
  const { data } = await sb.from("products").select("name,cost_price");
  const sp = (data || []).filter((p: any) => Number(p.cost_price) > 0).map((p: any) => ({ k: khoaKhopTen(p.name), gv: Number(p.cost_price) }));
  const tim = (re: RegExp) => sp.find((p: any) => re.test(p.k))?.gv ?? null;
  const dam = tim(/Sản phẩm A/) ?? tim(/^Sản phẩm A$/);
  const cafe = tim(/ca phe huu co nova/);
  return {
    khop(ten: string) {
      const k = khoaKhopTen(ten);
      if (!k) return null;
      if (/\b(dam|protein|true ?vegan|truvegan|sanphama|tvg)\b/.test(k) && !/combo|thung/.test(k)) return dam;
      if (/^(cafe|ca phe)( 500 ?g)?$/.test(k)) return cafe;
      const p = sp.find((x: any) => x.k === k) || sp.find((x: any) => k.length >= 6 && (x.k.startsWith(k) || k.startsWith(x.k)));
      return p?.gv ?? null;
    },
  };
}

export type DongKqkd = {
  ky: Ky;
  doanhThu: number; doanhThuUoc: number;
  giaVon: number; tyLeKhopGv: number;
  laiGop: number;
  luong: number; luongThieu: boolean;
  chiPhi: Record<string, number>; tongChiPhi: number;
  laiVay: number;
  loiNhuan: number;
};
export type DongTien = {
  ky: Ky; coSo: boolean;
  theoMuc: Record<string, number>;
  thuKd: number; chiKd: number; dt: number; tc: number; rong: number;
  soDuCuoi: number | null;
};

export type BaoCao = {
  che: CheDoKy; nam: number; homNay: string;
  kqkd: DongKqkd[]; dongTien: DongTien[];
  giaoDich: GiaoDich[];
  nguon: { nganHangTu: string | null; nganHangDen: string | null; soDonTu: string | null; soDonDen: string | null; luongToi: string | null; tyLeGvChung: number };
  canhBao: string[];
};

const trongKy = (ngay: string, k: Ky) => ngay >= k.tu && ngay <= k.den;

export async function dungBaoCao(sb: any, che: CheDoKy, nam: number, homNay: string): Promise<BaoCao> {
  const kys = dungKy(che, nam, homNay);
  const tuNam = `${nam}-01-01`;
  const canhBao: string[] = [];

  const thangs = dungKy("thang", nam, homNay);
  const [dtThang, gv, gd, payroll, loans] = await Promise.all([
    Promise.all(thangs.map((m) => layDoanhThu(sb, m.tu, m.den, { si: "gop" }).catch(() => null))),
    bangGiaVon(sb),
    layGiaoDich(),
    sb.from("payroll").select("month,total_company_cost").gte("month", `${nam}-01`).lte("month", `${nam}-12`),
    sb.from("loans").select("id,principal_amount,interest_rate,withholding_tax_rate,start_date,status"),
  ]);
  const dong: DongDoanhThu[] = dtThang.flatMap((r) => r?.rows || []);
  dtThang.forEach((r, i) => { if (!r) canhBao.push(`Không đọc được sổ đơn tháng ${thangs[i].nhan}.`); });
  const soDonTu = dong.length ? dong.reduce((a, b) => (a.order_date < b.order_date ? a : b)).order_date : null;
  const soDonDen = dong.length ? dong.reduce((a, b) => (a.order_date > b.order_date ? a : b)).order_date : null;

  let dtKhop = 0, gvKhop = 0;
  const gvDong = dong.map((r) => {
    const g = gv.khop(r.product_name || "");
    const q = Number(r.quantity) || 0;

    if (g != null && q > 0) { dtKhop += r.net_amount; gvKhop += g * q; return g * q; }
    return r.net_amount > 0 ? null : 0;
  });
  const tyLeGv = dtKhop > 0 ? gvKhop / dtKhop : 0;
  const dtTong = dong.reduce((s, r) => s + r.net_amount, 0);
  if (dtTong > 0 && dtKhop / dtTong < 0.6) canhBao.push(`Chỉ ${Math.round((dtKhop / dtTong) * 100)}% doanh thu khớp được giá vốn theo sản phẩm; phần còn lại tính theo tỷ lệ chung. Thêm giá vốn cho sản phẩm còn thiếu ở /admin/products để số sát hơn.`);

  const luongThang: Record<string, number> = {};
  for (const p of payroll.data || []) luongThang[p.month] = (luongThang[p.month] || 0) + (Number(p.total_company_cost) || 0);
  const luongToi = Object.keys(luongThang).sort().pop() || null;

  const vay = (loans.data || []) as any[];
  const kyTra = vay.length
    ? ((await sb.from("loan_payments").select("loan_id,id,payment_type,status,period_start,period_end,paid_date,gross_amount").in("loan_id", vay.map((v) => v.id))).data || []) as any[]
    : [];
  const laiKhoang = (tu: string, den: string) => vay.reduce((s, v) => {
    const bd = String(v.start_date || "").slice(0, 10);
    if (!bd || bd > den) return s;
    const a = bd > tu ? bd : tu;
    const ky = kyTra.filter((k) => k.loan_id === v.id);
    const traHet = ky.filter((k) => k.payment_type === "principal" && k.status === "paid").reduce((x, k) => x + (Number(k.gross_amount) || 0), 0);
    if (traHet >= Number(v.principal_amount) && v.status === "paid_off") {
      const ngayHet = ky.filter((k) => k.payment_type === "principal" && k.paid_date).map((k) => k.paid_date).sort().pop();
      if (ngayHet && ngayHet < a) return s;
    }
    return s + laiTrongKy(v, ky, a, den);
  }, 0);

  const phiShip: { ngay: string; tien: number }[] = [];
  for (let off = 0; ; off += 1000) {
    const { data } = await sb.from("jt_waybills").select("freight,order_create_time,is_void")
      .gte("order_create_time", `${tuNam} 00:00:00`).lte("order_create_time", `${nam}-12-31 23:59:59`).range(off, off + 999);
    if (!data?.length) break;
    for (const w of data) if (!w.is_void && Number(w.freight) > 0) phiShip.push({ ngay: String(w.order_create_time).slice(0, 10), tien: Number(w.freight) });
    if (data.length < 1000) break;
  }

  const ngayCoSo = soDonTu || "9999-12-31";
  const thuKdNgay: Record<string, number> = {};
  for (const g of gd.ds) if (g.chieu === "thu" && HM[g.hangMuc]?.nhom === "kd" && g.hangMuc !== "thu_lai" && g.hangMuc !== "thu_hoan_ncc") thuKdNgay[g.ngay] = (thuKdNgay[g.ngay] || 0) + g.tien;
  if (soDonTu && soDonTu > tuNam) canhBao.push(`Sổ đơn năm ${nam} bắt đầu từ ${dm(soDonTu)}. Doanh thu trước ngày đó là ƯỚC từ tiền kinh doanh về tài khoản (chia 1,08), đánh dấu "ước" trong bảng.`);

  const kqkd: DongKqkd[] = kys.map((k) => {
    let doanhThu = 0, giaVon = 0, dtCoGv = 0;
    dong.forEach((r, i) => {
      if (!trongKy(r.order_date, k)) return;
      doanhThu += r.net_amount;
      if (gvDong[i] != null) { giaVon += gvDong[i] as number; dtCoGv += r.net_amount; } else giaVon += r.net_amount * tyLeGv;
    });
    let doanhThuUoc = 0;
    for (const [ngay, tien] of Object.entries(thuKdNgay)) if (ngay < ngayCoSo && trongKy(ngay, k)) doanhThuUoc += tien / (1 + VAT_RATE);
    doanhThu += doanhThuUoc; giaVon += doanhThuUoc * tyLeGv;

    let luong = 0, luongThieu = false;
    for (let t = ms(k.tu); t <= ms(k.den); t += NGAY) {
      const d = ymd(t), m = d.slice(0, 7);
      const soNgay = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate();
      if (luongThang[m] == null) { luongThieu = true; continue; }
      luong += luongThang[m] / soNgay;
    }
    const chiPhi: Record<string, number> = {};
    for (const g of gd.ds) if (g.chieu === "chi" && HM[g.hangMuc]?.vaoKqkd && trongKy(g.ngay, k) && !REF_TRA_TRUOC.has(g.ref)) chiPhi[g.hangMuc] = (chiPhi[g.hangMuc] || 0) + g.tien;

    for (const x of TRA_TRUOC) {
      const a = k.tu > x.tu ? k.tu : x.tu, b = k.den < x.den ? k.den : x.den;
      if (a > b) continue;
      const soNgay = (ms(x.den) - ms(x.tu)) / NGAY + 1;
      chiPhi[x.hangMuc] = (chiPhi[x.hangMuc] || 0) + (x.chiPhi * ((ms(b) - ms(a)) / NGAY + 1)) / soNgay;
    }
    const ship = phiShip.filter((x) => trongKy(x.ngay, k)).reduce((s, x) => s + x.tien, 0);
    if (ship) chiPhi.van_chuyen = ship;
    const tongChiPhi = Object.values(chiPhi).reduce((s, v) => s + v, 0);
    const laiVay = laiKhoang(k.tu, k.den);
    const laiGop = doanhThu - giaVon;
    return {
      ky: k, doanhThu, doanhThuUoc, giaVon, tyLeKhopGv: doanhThu > 0 ? dtCoGv / doanhThu : 0, laiGop,
      luong: Math.round(luong), luongThieu, chiPhi, tongChiPhi, laiVay,
      loiNhuan: laiGop - luong - tongChiPhi - laiVay,
    };
  });

  const dongTien: DongTien[] = kys.map((k) => {
    const theoMuc: Record<string, number> = {};
    let thuKd = 0, chiKd = 0, dt = 0, tc = 0;
    for (const g of gd.ds) {
      if (!trongKy(g.ngay, k)) continue;
      const v = g.chieu === "thu" ? g.tien : -g.tien;
      theoMuc[g.hangMuc] = (theoMuc[g.hangMuc] || 0) + v;
      const n = HM[g.hangMuc]?.nhom || "kd";
      if (n === "kd") { if (v > 0) thuKd += v; else chiKd += -v; } else if (n === "dt") dt += v; else if (n === "tc") tc += v;
    }
    const coSo = !!gd.den && k.tu <= gd.den;
    let soDuCuoi: number | null = null;
    if (coSo && gd.den) {
      const moc = k.den < gd.den ? k.den : gd.den;
      const sau = gd.ds.filter((g) => g.ngay > moc).reduce((s, g) => s + (g.chieu === "thu" ? g.tien : -g.tien), 0);
      soDuCuoi = gd.soDuCuoi - sau;
    }
    return { ky: k, coSo, theoMuc, thuKd, chiKd, dt, tc, rong: thuKd - chiKd + dt + tc, soDuCuoi };
  });

  if (gd.den && gd.den < homNay) canhBao.push(`Sổ phụ ngân hàng mới tới ${dm(gd.den)}/${gd.den.slice(0, 4)} (ngân hàng gửi theo tháng). Dòng tiền và chi phí lấy từ ngân hàng của các ngày sau đó CHƯA có.`);
  if (luongToi && luongToi < homNay.slice(0, 7)) canhBao.push(`Bảng lương mới tới tháng ${luongToi.slice(5)}/${luongToi.slice(0, 4)}; kỳ chưa có bảng lương thì cột lương thiếu (đánh dấu *).`);
  const chuaPl = gd.ds.filter((g) => g.hangMuc === "chi_khac" && g.ngay >= tuNam);
  if (chuaPl.length) canhBao.push(`${chuaPl.length} khoản chi (${Math.round(chuaPl.reduce((s, g) => s + g.tien, 0) / 1e6).toLocaleString("vi-VN")} triệu) chưa phân loại được — đang tính vào chi phí khác. Gán nhãn ở thẻ Dòng tiền.`);

  return {
    che, nam, homNay, kqkd, dongTien,
    giaoDich: gd.ds.filter((g) => g.ngay >= tuNam && g.ngay <= `${nam}-12-31`),
    nguon: { nganHangTu: gd.tu, nganHangDen: gd.den, soDonTu, soDonDen, luongToi, tyLeGvChung: tyLeGv },
    canhBao,
  };
}

export type MocTonDam = { ngay: string; hop: number; nguon: string };
export type TheoDoiDam = {
  tuan: { tuan: string; hop: number; don: number }[];
  thanhToanNcc: { ngay: string; tien: number; noiDung: string }[];
  mocTon: MocTonDam[];
  uocTonNay: { tuMoc: MocTonDam; daGuiSauMoc: number; con: number } | null;
  tbTuan4: number; soTuanConLai: number | null;
  vanDonTu: string | null;
};

const LA_DAM = /\b(dam|protein|proten|true ?vegan|tvg)\b/;

export async function theoDoiDam(sb: any, nam: number, giaoDich: GiaoDich[]): Promise<TheoDoiDam> {
  let wb: any[] = [], off = 0;
  while (true) {
    const { data } = await sb.from("jt_waybills").select("goods_items,goods_name,order_create_time,is_void")
      .gte("order_create_time", `${nam}-01-01 00:00:00`).order("order_create_time").range(off, off + 999);
    if (!data?.length) break;
    wb = wb.concat(data);
    if (data.length < 1000) break;
    off += 1000;
  }
  const tuanCua = (d: string) => { const t = ms(d.slice(0, 10)); return ymd(t - ((new Date(t).getUTCDay() + 6) % 7) * NGAY); };
  const m: Record<string, { hop: number; don: number }> = {};
  const theoNgay: { ngay: string; hop: number }[] = [];
  for (const w of wb) {
    if (w.is_void) continue;
    const items = Array.isArray(w.goods_items) && w.goods_items.length ? w.goods_items : (w.goods_name ? [{ name: w.goods_name, qty: 1 }] : []);
    let hop = 0;

    for (const it of items) { const k = khoaKhopTen(it.name); if (LA_DAM.test(k) && !/goi 10|10g/.test(k)) hop += Number(it.qty) || 0; }
    if (!hop) continue;
    const ngay = String(w.order_create_time).slice(0, 10);
    theoNgay.push({ ngay, hop });
    const r = (m[tuanCua(ngay)] ??= { hop: 0, don: 0 }); r.hop += hop; r.don += 1;
  }
  const tuan = Object.entries(m).sort(([a], [b]) => a.localeCompare(b)).map(([tuan, v]) => ({ tuan, ...v }));
  const tuanNay = tuanCua(ymd(Date.now()));
  const du = tuan.filter((t) => t.tuan < tuanNay).slice(-4);
  const tbTuan4 = du.length ? du.reduce((s, t) => s + t.hop, 0) / du.length : 0;

  const thanhToanNcc = giaoDich
    .filter((g) => g.chieu === "chi" && /RV NUTRI|TVG PRO|CONG TY CO PHAN RV|TIEN HANG RV|HADU/.test(bo(g.noiDung)) && g.tien >= 20_000_000)
    .map((g) => ({ ngay: g.ngay, tien: g.tien, noiDung: g.noiDung }));

  const mocTon: MocTonDam[] = [];
  try {
    const { SO_TON_EXCEL_ANH, TIN_DAM_0810 } = await import("@/lib/kho-ton-ky");
    for (const ky of SO_TON_EXCEL_ANH.ky) {
      const d = ky.items.find((i) => i.sku.toUpperCase() === "SẢN PHẨM A");
      if (d?.qty != null) mocTon.push({ ngay: ky.asOf, hop: d.qty, nguon: `Excel kho (${ky.sheet})` });
    }
    mocTon.push({ ngay: TIN_DAM_0810.ngay, hop: TIN_DAM_0810.qty, nguon: "Tin báo kho 08/10" });
  } catch {  }
  mocTon.sort((a, b) => a.ngay.localeCompare(b.ngay));
  const moi = mocTon[mocTon.length - 1];
  let uocTonNay: TheoDoiDam["uocTonNay"] = null;
  if (moi) {
    const daGuiSauMoc = theoNgay.filter((x) => x.ngay > moi.ngay).reduce((s, x) => s + x.hop, 0);
    uocTonNay = { tuMoc: moi, daGuiSauMoc, con: moi.hop - daGuiSauMoc };
  }

  return {
    tuan, thanhToanNcc, mocTon, uocTonNay, tbTuan4,
    soTuanConLai: uocTonNay && tbTuan4 > 0 ? Math.max(0, uocTonNay.con) / tbTuan4 : null,
    vanDonTu: wb[0]?.order_create_time ? String(wb[0].order_create_time).slice(0, 10) : null,
  };
}
