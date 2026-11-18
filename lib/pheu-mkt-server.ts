import { getServiceClient } from "@/lib/supabase-server";
import { getConfigValue } from "@/lib/app-config";
import { layDoanhThu, layDoanhThuNhieuThang } from "@/lib/doanh-thu";
import { docLeadKhoang } from "@/lib/nguon-lead-server";
import { getHistory } from "@/lib/google-ads";
import { bocNguonDon, chuanNguonDon, TEN_NGUON_DON, type NguonDon } from "@/lib/nguon-don";

const sdtChuan = (p: unknown) => String(p ?? "").replace(/\D/g, "").replace(/^84/, "0");
const sdtHopLe = (p: string) => /^0\d{9,10}$/.test(p);

export const KENH_KHONG_RO = "KHÔNG RÕ NGUỒN";
export const KENH_KHACH_CU = "Khách cũ mua lại";
export const KENH_KHONG_SDT = "Đơn không có SĐT";
const KENH_META = "Facebook / Instagram";
const KENH_GOOGLE = "Google";

export const MOC_LICH_SU = "2025-01-01";
const CUA_SO_LEAD_NGAY = 90;

const kenhGoc = (k: string) => k.replace(/ \(trả tiền\)$/, "");
const ngayVN = (t: number) => new Date(t + 7 * 3600e3).toISOString().slice(0, 10);

export type CachQuy = "khach-cu" | "sale-ghi" | "lead-do" | "lead-doan" | "khong-ro" | "khong-sdt";

export type DongKenh = {
  kenh: string;
  chi: number | null;
  lead: number; leadDoan: number; leadCoDon: number;
  donMoi: number; khachMoi: number; dtMoi: number;
  donCu: number; dtCu: number;
  donKhongSdt: number; dtKhongSdt: number;
  donSaleGhi: number; donKhopLead: number; donKhopLeadDoan: number;
};
export type DongCua = { cua: string; lead: number; leadCoDon: number };
export type DongNgay = {
  ngay: string; chiGoogle: number | null; chiMeta: number | null;
  lead: number; don: number; donMoi: number; donMoiKhongRo: number; dt: number;
};

export type PheuMkt = {
  thang: string; tu: string; den: string;
  chi: { meta: number | null; google: number; googleNgayCo: number; googleNgayThieu: number; tong: number };
  tong: {
    lead: number; leadDoan: number; leadCoSdt: number; leadCoDon: number;
    don: number; dt: number;
    donMoi: number; dtMoi: number; khachMoi: number;
    donCu: number; dtCu: number; khachCu: number;
    donKhongSdt: number; dtKhongSdt: number;
    donMoiKhongRo: number; dtMoiKhongRo: number;
    theoCach: Record<CachQuy, number>;
    donCoNguonSaleGhi: number;
  };
  kenh: DongKenh[];
  cua: DongCua[];
  ngay: DongNgay[];
  canhBao: string[];
  giay: number;
};

async function nguonTheoDon(sb: any, tu: string, den: string): Promise<Map<string, NguonDon>> {
  const out = new Map<string, NguonDon>();

  const a = new Date(Date.parse(`${tu}T00:00:00+07:00`) - 864e5).toISOString();
  const b = new Date(Date.parse(`${den}T23:59:59+07:00`) + 864e5).toISOString();
  for (let f = 0; f < 20000; f += 1000) {
    const { data, error } = await sb.from("tg_messages").select("chat_id,message_id,noi_dung")
      .gte("sent_at", a).lte("sent_at", b).order("sent_at").range(f, f + 999);
    if (error || !data?.length) break;
    for (const m of data) {
      const ng = bocNguonDon(m.noi_dung);
      if (ng) out.set(`TG-${m.chat_id}-${m.message_id}`, ng);
    }
    if (data.length < 1000) break;
  }

  try {
    const { data, error } = await sb.from("tg_orders").select("chat_id,message_id,nguon")
      .gte("ngay", tu).lte("ngay", den).not("nguon", "is", null).limit(5000);
    if (!error) for (const r of data || []) {
      const ng = chuanNguonDon(r.nguon);
      if (ng) out.set(`TG-${r.chat_id}-${r.message_id}`, ng);
    }
  } catch {  }
  return out;
}

export function thangMacDinh(now = Date.now()): string {
  const d = new Date(now + 7 * 3600e3);
  if (d.getUTCDate() <= 3) d.setUTCDate(0);
  return d.toISOString().slice(0, 7);
}

export async function tinhPheuMkt(thang: string): Promise<PheuMkt> {
  const t0 = Date.now();
  if (!/^\d{4}-\d{2}$/.test(thang)) throw new Error("tháng phải dạng YYYY-MM");
  const sb = getServiceClient();
  const canhBao: string[] = [];

  const tu = `${thang}-01`;
  const cuoiThang = new Date(Date.UTC(+thang.slice(0, 4), +thang.slice(5, 7), 0)).toISOString().slice(0, 10);
  const homNay = ngayVN(Date.now());
  const den = cuoiThang < homNay ? cuoiThang : homNay;
  const truocKy = new Date(Date.parse(`${tu}T00:00:00Z`) - 864e5).toISOString().slice(0, 10);
  const tuIso = new Date(`${tu}T00:00:00+07:00`).toISOString();
  const denIso = new Date(Date.parse(`${den}T00:00:00+07:00`) + 864e5).toISOString();
  const leadTuIso = new Date(Date.parse(tuIso) - CUA_SO_LEAD_NGAY * 864e5).toISOString();

  const [dt, lichSu, leads, nguonDon, gHist, metaRaw] = await Promise.all([
    layDoanhThu(sb, tu, den),
    layDoanhThuNhieuThang(sb, MOC_LICH_SU, truocKy),
    docLeadKhoang(leadTuIso, denIso),
    nguonTheoDon(sb, tu, den),
    getHistory().catch(() => []),
    getConfigValue(`mkt_spend_${thang}`).catch(() => null),
  ]);
  canhBao.push(...dt.canhBao, ...lichSu.canhBao.filter((c) => !/TÁCH .* đơn sỉ/.test(c)));
  if (leads.loi) canhBao.push(`Đọc bảng lead lỗi: ${leads.loi} — số lead THIẾU.`);

  const metaSo = metaRaw == null || metaRaw === "" ? null : Math.round(Number(metaRaw));
  const meta = metaSo != null && Number.isFinite(metaSo) ? metaSo : null;
  if (meta == null) canhBao.push(`Chưa có số chi Meta tháng ${thang} (config mkt_spend_${thang} trống) — cột chi Meta để trống, KHÔNG coi là 0đ.`);
  const gNgay = new Map<string, number>();
  for (const d of gHist) if (String(d?.date || "").startsWith(thang)) gNgay.set(d.date, Number(d?.totals?.cost) || 0);
  const google = [...gNgay.values()].reduce((s, v) => s + v, 0);
  const soNgayKy = Math.round((Date.parse(den) - Date.parse(tu)) / 864e5) + 1;

  const googleNgayThieu = Math.max(0, soNgayKy - gNgay.size - (den === homNay && !gNgay.has(homNay) ? 1 : 0));
  if (googleNgayThieu > 0) canhBao.push(`Sổ Google Ads thiếu ${googleNgayThieu}/${soNgayKy} ngày trong kỳ — chi Google THẤP HƠN thật (sổ cào giao diện, giữ 90 ngày).`);
  const chiTong = (meta || 0) + google;

  const daMua = new Set<string>();
  for (const r of lichSu.rows) { const p = sdtChuan(r.customer_phone); if (sdtHopLe(p)) daMua.add(p); }

  const don = new Map<string, { ngay: string; sdt: string; net: number }>();
  for (const r of dt.rows) {
    const d = don.get(r.order_code) || { ngay: r.order_date, sdt: sdtChuan(r.customer_phone), net: 0 };
    d.net += r.net_amount;
    don.set(r.order_code, d);
  }

  const leadTheoSdt = new Map<string, { t: number; kenh: string; doan: boolean }[]>();
  for (const l of leads.dong) {
    const p = sdtChuan(l.phone);
    if (!sdtHopLe(p)) continue;
    const ds = leadTheoSdt.get(p) || [];
    ds.push({ t: l.t, kenh: kenhGoc(l.kenh), doan: l.doan });
    leadTheoSdt.set(p, ds);
  }
  for (const ds of leadTheoSdt.values()) ds.sort((a, b) => a.t - b.t);
  const tuMs = Date.parse(tuIso);
  const leadTrongKy = leads.dong.filter((l) => l.t >= tuMs);

  const donTheoSdt = new Map<string, string[]>();
  for (const d of don.values()) if (sdtHopLe(d.sdt)) (donTheoSdt.get(d.sdt) || donTheoSdt.set(d.sdt, []).get(d.sdt)!).push(d.ngay);

  const kenhMap = new Map<string, DongKenh>();
  const lay = (k: string) => {
    let v = kenhMap.get(k);
    if (!v) {
      v = { kenh: k, chi: null, lead: 0, leadDoan: 0, leadCoDon: 0, donMoi: 0, khachMoi: 0, dtMoi: 0, donCu: 0, dtCu: 0, donKhongSdt: 0, dtKhongSdt: 0, donSaleGhi: 0, donKhopLead: 0, donKhopLeadDoan: 0 };
      kenhMap.set(k, v);
    }
    return v;
  };
  lay(KENH_META).chi = meta;
  lay(KENH_GOOGLE).chi = google;

  const cuaMap = new Map<string, DongCua>();
  const ngayMap = new Map<string, DongNgay>();
  const layNgay = (n: string) => {
    let v = ngayMap.get(n);
    if (!v) { v = { ngay: n, chiGoogle: gNgay.has(n) ? gNgay.get(n)! : null, chiMeta: meta === 0 ? 0 : null, lead: 0, don: 0, donMoi: 0, donMoiKhongRo: 0, dt: 0 }; ngayMap.set(n, v); }
    return v;
  };
  for (let t = Date.parse(`${tu}T00:00:00Z`); t <= Date.parse(`${den}T00:00:00Z`); t += 864e5) layNgay(new Date(t).toISOString().slice(0, 10));

  let leadCoSdt = 0, leadCoDon = 0, leadDoan = 0;
  for (const l of leadTrongKy) {
    const k = lay(kenhGoc(l.kenh));
    k.lead++; if (l.doan) { k.leadDoan++; leadDoan++; }
    const c = cuaMap.get(l.cua) || { cua: l.cua, lead: 0, leadCoDon: 0 };
    c.lead++;
    const p = sdtChuan(l.phone);
    const nLead = ngayVN(l.t);
    if (sdtHopLe(p)) {
      leadCoSdt++;
      if ((donTheoSdt.get(p) || []).some((n) => n >= nLead)) { k.leadCoDon++; c.leadCoDon++; leadCoDon++; }
    }
    cuaMap.set(l.cua, c);
    layNgay(nLead).lead++;
  }

  const theoCach: Record<CachQuy, number> = { "khach-cu": 0, "sale-ghi": 0, "lead-do": 0, "lead-doan": 0, "khong-ro": 0, "khong-sdt": 0 };
  const khachMoi = new Map<string, Set<string>>();
  const tatCaMoi = new Set<string>(), tatCaCu = new Set<string>();
  let dtTong = 0, donMoi = 0, dtMoi = 0, donCu = 0, dtCu = 0, donKhongSdt = 0, dtKhongSdt = 0, donMoiKhongRo = 0, dtMoiKhongRo = 0, donCoNguon = 0;

  for (const [ma, d] of don) {
    dtTong += d.net;
    const n = layNgay(d.ngay);
    n.don++; n.dt += d.net;
    const tag = nguonDon.get(ma) || null;
    if (tag) donCoNguon++;
    if (!sdtHopLe(d.sdt)) {
      theoCach["khong-sdt"]++; donKhongSdt++; dtKhongSdt += d.net;

      const k = lay(tag && tag !== "khach-cu" ? TEN_NGUON_DON[tag] : KENH_KHONG_SDT);
      k.donKhongSdt++; k.dtKhongSdt += d.net;
      if (tag && tag !== "khach-cu") k.donSaleGhi++;
      continue;
    }
    if (daMua.has(d.sdt) || tag === "khach-cu") {
      theoCach["khach-cu"]++; donCu++; dtCu += d.net; tatCaCu.add(d.sdt);
      const k = lay(KENH_KHACH_CU); k.donCu++; k.dtCu += d.net;
      continue;
    }

    donMoi++; dtMoi += d.net; tatCaMoi.add(d.sdt); n.donMoi++;
    let kenh: string;
    if (tag) { kenh = TEN_NGUON_DON[tag]; theoCach["sale-ghi"]++; }
    else {
      const cuoiNgay = Date.parse(`${d.ngay}T23:59:59+07:00`);
      const ds = (leadTheoSdt.get(d.sdt) || []).filter((l) => l.t <= cuoiNgay && l.t >= cuoiNgay - CUA_SO_LEAD_NGAY * 864e5);
      const l = ds[ds.length - 1];
      if (l) { kenh = l.kenh; theoCach[l.doan ? "lead-doan" : "lead-do"]++; }
      else { kenh = KENH_KHONG_RO; theoCach["khong-ro"]++; donMoiKhongRo++; dtMoiKhongRo += d.net; n.donMoiKhongRo++; }
      const k = lay(kenh);
      if (l) { k.donKhopLead++; if (l.doan) k.donKhopLeadDoan++; }
    }
    const k = lay(kenh);
    k.donMoi++; k.dtMoi += d.net;
    if (tag) k.donSaleGhi++;
    (khachMoi.get(kenh) || khachMoi.set(kenh, new Set()).get(kenh)!).add(d.sdt);
  }
  for (const [kenh, s] of khachMoi) lay(kenh).khachMoi = s.size;

  const thuTu = (k: DongKenh) => (k.kenh === KENH_KHONG_RO ? -1 : k.kenh === KENH_KHACH_CU ? -2 : k.kenh === KENH_KHONG_SDT ? -3 : 0);
  const kenh = [...kenhMap.values()]
    .filter((k) => k.lead || k.donMoi || k.donCu || k.donKhongSdt || (k.chi ?? 0) > 0 || k.kenh === KENH_META || k.kenh === KENH_GOOGLE)
    .sort((a, b) => thuTu(b) - thuTu(a) || (b.chi ?? 0) - (a.chi ?? 0) || b.dtMoi - a.dtMoi || b.lead - a.lead);

  return {
    thang, tu, den,
    chi: { meta, google, googleNgayCo: gNgay.size, googleNgayThieu, tong: chiTong },
    tong: {
      lead: leadTrongKy.length, leadDoan, leadCoSdt, leadCoDon,
      don: don.size, dt: dtTong,
      donMoi, dtMoi, khachMoi: tatCaMoi.size,
      donCu, dtCu, khachCu: tatCaCu.size,
      donKhongSdt, dtKhongSdt, donMoiKhongRo, dtMoiKhongRo,
      theoCach, donCoNguonSaleGhi: donCoNguon,
    },
    kenh,
    cua: [...cuaMap.values()].sort((a, b) => b.lead - a.lead),
    ngay: [...ngayMap.values()].sort((a, b) => a.ngay.localeCompare(b.ngay)),
    canhBao,
    giay: Math.round((Date.now() - t0) / 100) / 10,
  };
}
