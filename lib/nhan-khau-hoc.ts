import { getServiceClient } from "@/lib/supabase-server";
import { detectProvince, mienCua, boDau } from "@/lib/vn-provinces";

const TEN_NU = new Set([
  "huong", "lan", "mai", "hoa", "thuy", "trang", "hang", "nga", "yen", "linh", "ngoc", "hien",
  "hanh", "thao", "nhung", "phuong", "tuyet", "loan", "oanh", "kim", "my", "ha", "chi", "nhi",
  "uyen", "vy", "thu", "xuan", "diep", "hue", "lieu", "ly", "nguyet", "suong", "trinh", "truc",
  "tuyen", "bich", "cuc", "dao", "hong", "lien", "ngan", "quynh", "sen", "tuoi", "nhan", "thom",
  "duyen", "dieu", "giang", "huyen", "hoai", "khuyen", "lam anh", "le", "nhu", "phuong anh", "tham",
  "san pham b", "thuong", "tien", "tuong vi", "van anh", "vui", "xuyen",
]);

const TEN_NAM = new Set([
  "duc", "hung", "tuan", "nam", "son", "cuong", "hai", "hoang", "long", "phong", "quan", "quang",
  "thang", "trung", "tung", "viet", "vu", "bao", "binh", "chien", "cong", "dai", "dat", "hieu",
  "huy", "kien", "loc", "manh", "nghia", "nhat", "phat", "phu", "sang", "tai", "the", "tin",
  "toan", "trieu", "truong", "vinh", "khoa", "lap", "luan", "nguyen", "tho", "thuan", "tri",
]);

export type GioiTinh = "nu" | "nam" | "khong-ro";

export function doanGioiTinh(hoTen: string): GioiTinh {
  const t = boDau(String(hoTen || "").trim());
  if (!t) return "khong-ro";
  const tu = t.split(/\s+/).filter(Boolean);
  if (tu.length < 2) return "khong-ro";
  const dem = ` ${t} `;
  if (dem.includes(" thi ")) return "nu";
  if (dem.includes(" van ") && tu.length >= 3) return "nam";
  const cuoi = tu[tu.length - 1];
  const hai = tu.slice(-2).join(" ");
  if (TEN_NU.has(hai) || TEN_NU.has(cuoi)) return "nu";
  if (TEN_NAM.has(hai) || TEN_NAM.has(cuoi)) return "nam";
  return "khong-ro";
}

export type OGioi = { nu: number; nam: number; khongRo: number; tienNu: number; tienNam: number };
export type OTinh = { tinh: string; mien: "Bắc" | "Trung" | "Nam"; khach: number; don: number; tien: number; share: number };
export type ODoTuoiQc = { tuoi: string; hienThi: number; share: number; chi: number; lienHe: number };
export type OGioiQc = { gioi: string; hienThi: number; share: number; chi: number; lienHe: number; giaMoiLienHe: number | null };

export type NhanKhauHoc = {
  tu: string; den: string; soNgay: number;
  khachCoTen: number;
  gioi: OGioi;
  phuSongGioi: number;
  tinhs: OTinh[];
  mienTong: Array<{ mien: string; khach: number; don: number; share: number }>;
  phuSongTinh: number;
  qc: { tuoi: ODoTuoiQc[]; gioi: OGioiQc[]; tongHienThi: number; tongChi: number } | null;
  canhBao: string[];
};

type MetaRow = { age?: string; gender?: string; spend?: string; impressions?: string; actions?: Array<{ action_type: string; value: string }> };

async function keoMetaAds(soNgay: number): Promise<{ rows: MetaRow[] } | { loi: string }> {
  const token = process.env.FB_ADS_TOKEN || process.env.FB_USER_TOKEN;
  if (!token) return { loi: "chưa có token quảng cáo (FB_ADS_TOKEN/FB_USER_TOKEN)" };
  const acct = "act_" + String(process.env.FB_AD_ACCOUNT || "000000000000000").replace(/^act_/, "");

  const preset = soNgay <= 30 ? "last_30d" : soNgay <= 90 ? "last_90d" : "last_90d";
  const url = `https://graph.facebook.com/v21.0/${acct}/insights?fields=spend,impressions,actions&breakdowns=age,gender&date_preset=${preset}&limit=200&access_token=${encodeURIComponent(token)}`;
  try {
    const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20000) });
    const j = await r.json();
    if (j?.error) return { loi: `Meta: ${j.error.message}` };
    return { rows: Array.isArray(j?.data) ? j.data : [] };
  } catch (e: any) {
    return { loi: `không gọi được Meta: ${e?.message || e}` };
  }
}

function demLienHe(r: MetaRow): number {
  let n = 0;
  for (const a of r.actions || []) {
    const k = a.action_type || "";
    if (k.includes("messaging_conversation_started") || k.endsWith("lead")) n += Number(a.value) || 0;
  }
  return n;
}

export async function buildNhanKhauHoc(soNgay = 90): Promise<NhanKhauHoc> {
  const sb = getServiceClient();
  const den = new Date();
  const tu = new Date(den.getTime() - soNgay * 86400e3);
  const ds = (d: Date) => d.toISOString().slice(0, 10);
  const canhBao: string[] = [];

  type Don = { khach: string | null; sdt: string | null; tinh: string | null; dia_chi: string | null; khach_tra: number | null };
  const dons: Don[] = [];
  for (let f = 0; f < 20000; f += 1000) {
    const { data, error } = await sb
      .from("tg_orders")
      .select("khach, sdt, tinh, dia_chi, khach_tra")
      .gte("ngay", ds(tu))
      .lte("ngay", ds(den))
      .range(f, f + 999);
    if (error) throw new Error(`đọc tg_orders hỏng: ${error.message}`);
    const lo = data || [];
    dons.push(...(lo as Don[]));
    if (lo.length < 1000) break;
  }
  if (!dons.length) canhBao.push("Không đọc được đơn nào trong kỳ — số dưới đây không dùng được.");

  const khachs = new Map<string, { ten: string; tien: number; don: number }>();
  for (const d of dons) {
    const sdt = String(d.sdt || "").replace(/\D/g, "").replace(/^84/, "0");
    if (!sdt) continue;
    const cu = khachs.get(sdt);
    const tien = Number(d.khach_tra) || 0;
    if (cu) { cu.tien += tien; cu.don += 1; if (!cu.ten && d.khach) cu.ten = d.khach; }
    else khachs.set(sdt, { ten: String(d.khach || ""), tien, don: 1 });
  }

  const gioi: OGioi = { nu: 0, nam: 0, khongRo: 0, tienNu: 0, tienNam: 0 };
  let coTen = 0;
  for (const k of khachs.values()) {
    if (!k.ten.trim()) continue;
    coTen++;
    const g = doanGioiTinh(k.ten);
    if (g === "nu") { gioi.nu++; gioi.tienNu += k.tien; }
    else if (g === "nam") { gioi.nam++; gioi.tienNam += k.tien; }
    else gioi.khongRo++;
  }
  const doanDuoc = gioi.nu + gioi.nam;
  const phuSongGioi = coTen ? (doanDuoc * 100) / coTen : 0;
  if (phuSongGioi < 70 && coTen) canhBao.push(`Chỉ đoán được giới tính của ${phuSongGioi.toFixed(0)}% khách — phần còn lại là tên trung tính (Thanh, Anh, Dung, Lan... nam nữ dùng chung). Tỉ lệ dưới đây đọc theo hướng, đừng lấy làm con số chốt.`);

  const tinhMap = new Map<string, { khach: Set<string>; don: number; tien: number }>();
  let doDuocTinh = 0;
  for (const d of dons) {
    const tho = String(d.tinh || "").trim();
    const tinh = detectProvince(tho) || detectProvince(String(d.dia_chi || ""));
    if (!tinh) continue;
    doDuocTinh++;
    const sdt = String(d.sdt || "").replace(/\D/g, "");
    const o = tinhMap.get(tinh) || { khach: new Set<string>(), don: 0, tien: 0 };
    if (sdt) o.khach.add(sdt);
    o.don += 1; o.tien += Number(d.khach_tra) || 0;
    tinhMap.set(tinh, o);
  }
  const tongDon = dons.length || 1;
  const tinhs: OTinh[] = [...tinhMap.entries()]
    .map(([tinh, v]) => ({
      tinh, mien: mienCua(tinh), khach: v.khach.size, don: v.don, tien: v.tien,
      share: (v.don * 100) / Math.max(doDuocTinh, 1),
    }))
    .sort((a, b) => b.don - a.don);
  const phuSongTinh = (doDuocTinh * 100) / tongDon;

  const mienMap = new Map<string, { khach: number; don: number }>();
  for (const t of tinhs) {
    const o = mienMap.get(t.mien) || { khach: 0, don: 0 };
    o.khach += t.khach; o.don += t.don;
    mienMap.set(t.mien, o);
  }
  const mienTong = [...mienMap.entries()]
    .map(([mien, v]) => ({ mien, khach: v.khach, don: v.don, share: (v.don * 100) / Math.max(doDuocTinh, 1) }))
    .sort((a, b) => b.don - a.don);

  let qc: NhanKhauHoc["qc"] = null;
  const meta = await keoMetaAds(soNgay);
  if ("loi" in meta) {
    canhBao.push(`Chưa đọc được nhân khẩu học quảng cáo — ${meta.loi}. Phần đối chiếu để trống, KHÔNG phải bằng 0.`);
  } else if (!meta.rows.length) {
    canhBao.push("Meta không trả dòng nhân khẩu học nào trong kỳ (có thể kỳ này không chạy quảng cáo).");
  } else {
    const theoTuoi = new Map<string, { ht: number; chi: number; lh: number }>();
    const theoGioi = new Map<string, { ht: number; chi: number; lh: number }>();
    let tongHt = 0, tongChi = 0;
    for (const r of meta.rows) {
      const ht = Number(r.impressions) || 0;
      const chi = Number(r.spend) || 0;
      const lh = demLienHe(r);
      tongHt += ht; tongChi += chi;
      const a = theoTuoi.get(r.age || "?") || { ht: 0, chi: 0, lh: 0 };
      a.ht += ht; a.chi += chi; a.lh += lh; theoTuoi.set(r.age || "?", a);
      const g = theoGioi.get(r.gender || "?") || { ht: 0, chi: 0, lh: 0 };
      g.ht += ht; g.chi += chi; g.lh += lh; theoGioi.set(r.gender || "?", g);
    }
    const NHAN: Record<string, string> = { female: "Nữ", male: "Nam", unknown: "Không rõ" };
    qc = {
      tongHienThi: tongHt, tongChi,
      tuoi: [...theoTuoi.entries()]
        .filter(([t]) => t !== "Unknown" && t !== "?")
        .map(([tuoi, v]) => ({ tuoi, hienThi: v.ht, share: (v.ht * 100) / Math.max(tongHt, 1), chi: v.chi, lienHe: v.lh }))
        .sort((a, b) => a.tuoi.localeCompare(b.tuoi)),
      gioi: [...theoGioi.entries()]
        .map(([g, v]) => ({
          gioi: NHAN[g] || g, hienThi: v.ht, share: (v.ht * 100) / Math.max(tongHt, 1),
          chi: v.chi, lienHe: v.lh,
          giaMoiLienHe: v.lh > 0 ? v.chi / v.lh : null,
        }))
        .sort((a, b) => b.hienThi - a.hienThi),
    };
  }

  return {
    tu: ds(tu), den: ds(den), soNgay,
    khachCoTen: coTen, gioi, phuSongGioi,
    tinhs, mienTong, phuSongTinh,
    qc, canhBao,
  };
}
