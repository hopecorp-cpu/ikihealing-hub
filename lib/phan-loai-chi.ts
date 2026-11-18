import type { Tx } from "@/lib/cashflow";

const NHOM: [string, RegExp][] = [
  ["Trả nợ vay / lãi vay", /TRA NO|TRA GOC|TRA LAI|LAI VAY|THU NO|KHOAN VAY|HOP DONG VAY|TAT TOAN/i],
  ["Thuế / ngân sách", /KHO BAC|NGAN SACH NHA NUOC|TONG CUC THUE|CUC THUE|NOP THUE|THUE GTGT|THUE TNCN|THUE TNDN|MON BAI/i],
  ["Đi lại / công tác", /VE MAY BAY|VE MAY|MAY BAY|\bVMB\b|VIETJET|VIETNAM AIRLINES|BAMBOO|VE TAU|XANG DAU|PETROLIMEX|EPASS|VETC|GRAB(?! ?EXPRESS)|BE GROUP|KHACH SAN|HOTEL/i],
  ["Mặt bằng / điện nước / mạng", /TIEN NHA|THUE NHA|MAT BANG|THUE VAN PHONG|TIEN THUE KY|THUE KY \d|\/HDTN\/|DIEN NUOC|SUA DIEN|\bEVN\b|TIEN DIEN|TIEN NUOC|INTERNET|VNPT|FPT TELECOM|VIETTEL TELECOM|CUOC DIEN THOAI/i],
  ["Lương / BHXH / nhân sự", /\bLUONG\b|TIEN LUONG|TAM UNG|THUONG T\d|HOA HONG|\bBHXH\b|BAO HIEM XA HOI|PHU CAP|CONG TAC PHI/i],
  ["Vận chuyển / ship", /J&T|JT EXPRESS|THUAN PHONG|GHN|GIAO HANG NHANH|GHTK|GIAO HANG TIET KIEM|VIETTEL ?POST|VNPOST|BUU DIEN|AHAMOVE|GRAB EXPRESS|PHI SHIP|CUOC VAN CHUYEN|VAN CHUYEN/i],
  ["Quảng cáo", /FACEBK|FACEBOOK|META PLATFORM|TIKTOK|BYTEDANCE|GOOGLE ?ADS|CHAY ADS|QUANG CAO|\bADS\b|KOL|KOC|BOOKING/i],
  ["Quà tặng khách / khuyến mãi", /QUA TANG|MUA QUA|QUA TRUNG THU|QUA TET/i],
  ["Dịch vụ thuê ngoài / tư vấn", /\bPDV\b|PHI DV|PHI DICH VU|TU VAN|KE TOAN|LUAT SU|THIET KE|DICH VU MARKETING/i],
  ["Nhập hàng / nhà cung cấp", /TIEN HANG|NHAP HANG|\bNHAP\b|DAT HANG|THANH TOAN HD|THANH TOAN HOA DON|TT HD|TT HOA DON|HOA DON SO|BAO BI|IN AN|NGUYEN LIEU|DAT COC/i],
  ["Công cụ / phần mềm / AI", /OPENAI|CHATGPT|ANTHROPIC|CLAUDE|VERCEL|GITHUB|SUPABASE|NOTION|CANVA|CAPCUT|ELEVEN|APPLE\.COM|ITUNES|PANCAKE|MISA|SALEWORK|GOOGLE|ZOOM/i],
  ["Phí ngân hàng", /PHI QUAN LY TK|PHI SMS|PHI THUONG NIEN|PHI DUY TRI|PHI CHUYEN TIEN/i],
  ["Hoàn tiền khách", /\bHOAN TIEN\b|\bHOAN COC\b|TRA LAI KHACH|REFUND/i],
];

const GOP_NHAN_TCB: Record<string, string> = {
  "Facebook / Meta ads": "Quảng cáo",
  "TikTok ads": "Quảng cáo",
  "Google (Cloud/Ads/Play)": "Công cụ / phần mềm / AI",
  "AI / công cụ sáng tạo": "Công cụ / phần mềm / AI",
  "Hạ tầng / SaaS": "Công cụ / phần mềm / AI",
  "Thuế / ngân sách": "Thuế / ngân sách",
  "Thuế trên lãi": "Thuế / ngân sách",
  "Phí ngân hàng": "Phí ngân hàng",
  "Shopee": "Nhập hàng / nhà cung cấp",
};

export const CHUA_PHAN_LOAI = "Chưa phân loại";

const khongDau = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");

const dangSoPhu = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const timNhom = (s: string) => NHOM.find(([, re]) => re.test(s))?.[0];

const DINH_JT = /CHUYEN PHAT NHANH THUAN PHONG TOI \d+ CONG TY|CONG TY THUAN PHONG THANH TOAN COD \S+ \d{4} \d{2} \d{2}/gi;

const lamSach = (t: Tx) => khongDau(t.details || "").replace(/\s+/g, " ").replace(DINH_JT, " ");

function dienGiai(t: Tx): string {
  const s = lamSach(t), so = dangSoPhu(t.amount), i = s.indexOf(so);
  const g = i >= 0 ? s.slice(Math.max(0, i - 110), i).replace(/\d{2}\/\d{2}\/\d{4} \S+ $/, "").slice(-45) + " | " + s.slice(i + so.length, i + so.length + 35) : s;
  return g.replace(/\s+/g, " ").trim().slice(0, 80);
}

export function nhomChi(t: Tx): string {
  if (t.cat && t.cat !== "Chi khác / trong nước" && t.cat !== "Lãi nhập vốn") return GOP_NHAN_TCB[t.cat] || t.cat;
  const s = lamSach(t);

  const so = dangSoPhu(t.amount), i = s.indexOf(so);
  if (i >= 0) {
    const truoc = s.slice(Math.max(0, i - 110), i).replace(/\d{2}\/\d{2}\/\d{4} \S+ $/, "").slice(-70);
    const sau = s.slice(i + so.length, i + so.length + 45);
    const n = timNhom(truoc) || timNhom(sau);
    if (n) return n;
  }
  return timNhom(s) || CHUA_PHAN_LOAI;
}

export type DongTienThang = {
  thang: string;
  vao: number;
  vaoJt: number;
  ra: number;
  noiBo: number;
  theoNhom: Array<{ nhom: string; tien: number; so: number }>;
  chuaPhanLoaiLon: Array<{ ngay: string; tien: number; noiDung: string }>;
};

function capNoiBo(mb: Tx[], tcb: Tx[]): Set<Tx> {
  const da = new Set<Tx>();
  const ngay = (t: Tx) => Date.parse((t.date || "") + "T00:00:00Z");
  for (const [chi, nhan] of [[mb, tcb], [tcb, mb]] as [Tx[], Tx[]][]) {
    for (const d of chi) {
      if (d.type !== "debit" || da.has(d)) continue;
      const c = nhan.find((x) => x.type === "credit" && !da.has(x) && x.amount === d.amount && Math.abs(ngay(x) - ngay(d)) <= 2 * 864e5);
      if (c) { da.add(d); da.add(c); }
    }
  }
  return da;
}

export function dongTienThang(mb: Tx[], tcb: Tx[], thang: string): DongTienThang {
  const noiBoSet = capNoiBo(mb, tcb);
  const trong = [...mb, ...tcb].filter((t) => (t.date || "").startsWith(thang));
  const r: DongTienThang = { thang, vao: 0, vaoJt: 0, ra: 0, noiBo: 0, theoNhom: [], chuaPhanLoaiLon: [] };
  const nhom: Record<string, { tien: number; so: number }> = {};
  const chuaRo: Tx[] = [];
  for (const t of trong) {
    if (noiBoSet.has(t)) { if (t.type === "credit") r.noiBo += t.amount; continue; }
    if (t.type === "credit") {
      r.vao += t.amount;
      if (t.isJt) r.vaoJt += t.amount;
      continue;
    }

    if ((t.type as string) === "fee") { r.vao += t.amount; continue; }
    const n = nhomChi(t);
    r.ra += t.amount;
    (nhom[n] ||= { tien: 0, so: 0 }).tien += t.amount;
    nhom[n].so++;
    if (n === CHUA_PHAN_LOAI) chuaRo.push(t);
  }
  r.theoNhom = Object.entries(nhom).map(([k, v]) => ({ nhom: k, ...v })).sort((a, b) => b.tien - a.tien);
  r.chuaPhanLoaiLon = chuaRo.sort((a, b) => b.amount - a.amount).slice(0, 5)
    .map((t) => ({ ngay: t.date || "?", tien: t.amount, noiDung: dienGiai(t) }));
  return r;
}
