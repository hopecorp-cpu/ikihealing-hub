import { createHmac } from "crypto";
import { chuanSdt } from "@/lib/don-hang-jt";

export const NGAY_GIU_KHACH = 180;
export const CHAT_DAI_LY = "-1000000000008";

export function laSkuTinh(ten: string): boolean {
  const t = String(ten || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
  if (/ca ?phe|caf+e|cof+ee/.test(t)) return false;

  return /dam|vegan|protein|tue\w{0,2} ?minh|thanh ?h\w{0,3}ng/.test(t);
}

export function chuanMa(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "D")
    .toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
}

export function bamSdt(sdt: string, key: string): string {
  return createHmac("sha256", key).update(chuanSdt(sdt)).digest("hex").slice(0, 32);
}

export const NGAY_LEAD_CTV = 30;
const RE_CTV = /(?:^|\| )CTV: ([A-Z0-9]+)/;

export function ghiChuCoCtv(note: string | null | undefined, maThuong: unknown, max = 300): string | null {
  const ma = chuanMa(maThuong);
  const n = String(note || "");
  if (!ma || ma.length < 3 || RE_CTV.test(n)) return n || null;
  return (`CTV: ${ma} | lên đơn nhớ ghi "mã: ${ma}"` + (n ? " | " + n : "")).slice(0, max);
}

export function maCtvTuGhiChu(note: string | null | undefined): string {
  return (String(note || "").match(RE_CTV) || [])[1] || "";
}

export async function ganMaCtvLeadCu(sb: any, id: string | number | undefined, ma: unknown): Promise<void> {
  if (!id || !chuanMa(ma)) return;
  try {
    const { data } = await sb.from("leads").select("note").eq("id", id).maybeSingle();
    const moi = ghiChuCoCtv(data?.note, ma);
    if (data && moi !== (data.note || null)) await sb.from("leads").update({ note: moi }).eq("id", id);
  } catch {  }
}

export type LeadCtv = { phone: string | null; created_at: string; note: string | null };

export function ganMaTuLead<T extends { sdt: string | null; ngay: string; ma_ctv: string | null }>(don: T[], leads: LeadCtv[]): T[] {
  const theoSdt = new Map<string, { ma: string; ngay: string }[]>();
  for (const l of leads) {
    const s = chuanSdt(l.phone), ma = maCtvTuGhiChu(l.note);
    if (s.length !== 10 || !ma) continue;
    const ngay = new Date(Date.parse(l.created_at) + 7 * 3600e3).toISOString().slice(0, 10);
    (theoSdt.get(s) || theoSdt.set(s, []).get(s)!).push({ ma, ngay });
  }
  if (!theoSdt.size) return don;
  return don.map((o) => {
    if (o.ma_ctv && String(o.ma_ctv).trim()) return o;
    const ds = theoSdt.get(chuanSdt(o.sdt));
    if (!ds) return o;
    const hop = ds.filter((l) => l.ngay <= o.ngay && (Date.parse(o.ngay) - Date.parse(l.ngay)) / 864e5 <= NGAY_LEAD_CTV)
      .sort((a, b) => (a.ngay < b.ngay ? 1 : -1))[0];
    return hop ? { ...o, ma_ctv: hop.ma } : o;
  });
}

export type DonSo = {
  id: number; chat_id: string; message_id: string | number; ngay: string; sdt: string | null;
  khach_tra: number | null; san_pham: { ten?: string; sl?: number; thanh_tien?: number }[] | null; ma_ctv: string | null;
};
export type VanDon = {
  receiver_phone: string | null; status_group: string; order_create_time: string | null; updated_at: string | null; is_void: boolean | null;
};
export type DonDay = {
  khoa: string; ma_ctv: string; loai: "dau" | "lai"; ngay: string; net_tinh: number; san_pham: string;
  sdt_che: string; sdt_bam: string; trang_thai_giao: "cho_giao" | "da_giao" | "hoan" | "huy";
  ngay_giao: string | null; loai_tru: string | null;
};

export function netTinh(o: Pick<DonSo, "khach_tra" | "san_pham">): { net: number; ten: string } {
  const sp = Array.isArray(o.san_pham) ? o.san_pham : [];
  const tong = sp.reduce((s, x) => s + (Number(x.thanh_tien) || 0), 0);
  const trong = sp.filter((x) => laSkuTinh(x.ten || ""));
  const tien = trong.reduce((s, x) => s + (Number(x.thanh_tien) || 0), 0);
  const ten = trong.map((x) => `${x.ten}${x.sl && x.sl > 1 ? " x" + x.sl : ""}`).join(", ").slice(0, 120);
  const khach = Number(o.khach_tra) || 0;
  let gop: number;
  if (tong > 0) gop = tien * Math.min(1, khach > 0 ? khach / tong : 1);
  else gop = trong.length && trong.length === sp.length ? khach : 0;
  return { net: Math.round(gop / 1.08), ten };
}

const THU_TU: Record<string, number> = { delivered: 4, transit: 3, other: 2, returned: 1, cancelled: 0 };

export function trangThaiJt(sdt: string, ngay: string, theoSdt: Map<string, VanDon[]>): { tt: DonDay["trang_thai_giao"]; ngayGiao: string | null } {
  const tu = Date.parse(ngay + "T00:00:00+07:00") - 864e5, den = tu + 12 * 864e5;
  const ung = (theoSdt.get(sdt) || []).filter((v) => {
    const t = Date.parse(String(v.order_create_time || ""));
    return !v.is_void && t >= tu && t < den;
  });
  if (!ung.length) return { tt: "cho_giao", ngayGiao: null };
  const tot = ung.sort((a, b) => (THU_TU[b.status_group] ?? 2) - (THU_TU[a.status_group] ?? 2))[0];
  if (tot.status_group === "delivered") {

    const u = tot.updated_at ? new Date(Date.parse(tot.updated_at) + 7 * 3600e3).toISOString().slice(0, 10) : ngay;
    return { tt: "da_giao", ngayGiao: u };
  }
  if (tot.status_group === "returned") return { tt: "hoan", ngayGiao: null };
  if (tot.status_group === "cancelled") return { tt: "huy", ngayGiao: null };
  return { tt: "cho_giao", ngayGiao: null };
}

export function tinhDonCtv(don: DonSo[], vanDon: VanDon[], opt: { daiLy: Set<string>; key: string }): DonDay[] {
  const theoSdt = new Map<string, VanDon[]>();
  for (const v of vanDon) {
    const s = chuanSdt(v.receiver_phone);
    if (s.length === 10) (theoSdt.get(s) || theoSdt.set(s, []).get(s)!).push(v);
  }
  const sx = [...don].sort((a, b) => (a.ngay < b.ngay ? -1 : a.ngay > b.ngay ? 1 : a.id - b.id));
  const daThay = new Set<string>();
  const cuaCtv = new Map<string, { ma: string; ngay: string }>();
  const ra: DonDay[] = [];

  for (const o of sx) {
    if (String(o.chat_id) === CHAT_DAI_LY) continue;
    const sdt = chuanSdt(o.sdt);
    const coSdt = sdt.length === 10;
    const ma = chuanMa(o.ma_ctv);
    const goc = coSdt ? cuaCtv.get(sdt) : undefined;
    const trongHan = goc && (Date.parse(o.ngay) - Date.parse(goc.ngay)) / 864e5 <= NGAY_GIU_KHACH;

    let loai: "dau" | "lai" | null = null, maTinh = "", loaiTru: string | null = null;
    if (goc && trongHan) { loai = "lai"; maTinh = goc.ma; }
    else if (ma) {
      loai = "dau"; maTinh = ma;
      if (goc) loaiTru = "Khách đã mua NOVA trước đó";
      else if (!coSdt) loaiTru = "Đơn không có số điện thoại khách, chưa đối chiếu được";
      else if (opt.daiLy.has(sdt)) loaiTru = "Số điện thoại của đại lý NOVA";
      else if (daThay.has(sdt)) loaiTru = "Khách đã mua NOVA trước đó";
      else cuaCtv.set(sdt, { ma, ngay: o.ngay });
    }
    if (coSdt) daThay.add(sdt);
    if (!loai) continue;

    const { net, ten } = netTinh(o);
    if (!loaiTru && net <= 0) loaiTru = "Đơn không có sản phẩm trong danh mục tính hoa hồng";
    const { tt, ngayGiao } = coSdt ? trangThaiJt(sdt, o.ngay, theoSdt) : { tt: "cho_giao" as const, ngayGiao: null };
    ra.push({
      khoa: `${o.chat_id}:${o.message_id}`, ma_ctv: maTinh, loai, ngay: o.ngay, net_tinh: net, san_pham: ten,
      sdt_che: coSdt ? "*******" + sdt.slice(-3) : "", sdt_bam: coSdt ? bamSdt(sdt, opt.key) : "",
      trang_thai_giao: tt, ngay_giao: ngayGiao, loai_tru: loaiTru,
    });
  }
  return ra;
}
