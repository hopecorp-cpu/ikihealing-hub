import { gopTenSaleTuSo } from "@/lib/doanh-thu";

export type SuKien = { at: string | null; type: string | null; note: string | null; code?: number | string | null; call?: boolean };
export type DonJt = {
  waybill: string;
  ngayTao: string | null;
  trangThai: string;
  nhom: "delivered" | "returned" | "cancelled" | "transit" | "other" | string;
  khach: string | null; sdtKhach: string | null; diaChi: string | null;
  hang: string | null; cod: number;
  sale: string | null;
  soDon: string | null;
  shipper: string | null; sdtShipper: string | null;
  suKienCuoi: string | null; suKienLuc: string | null;
  suKien: SuKien[];
  canXuLy: boolean; lyDo: string | null;
  ngayDi: number;
};

export const NHOM_TEN: Record<string, string> = {
  delivered: "Đã giao", returned: "Hoàn / đang hoàn", cancelled: "Đã huỷ", transit: "Đang giao", other: "Đơn vấn đề",
};

const GIAO_THAT_BAI = /không thành công|thất bại|không liên lạc|không nghe|không gặp|hẹn giao|từ chối|派件失败|拒收|失败/i;
const NGAY_TREO = 5;

export function chuanSdt(p: any): string {
  let s = String(p || "").replace(/\D/g, "");
  if (s.startsWith("84")) s = "0" + s.slice(2);
  if (s.length === 9 && !s.startsWith("0")) s = "0" + s;
  return s;
}
const ms = (v: any) => { const t = Date.parse(String(v || "").replace(" ", "T")); return Number.isFinite(t) ? t : 0; };

export function danhGiaCanXuLy(x: { nhom: string; suKienCuoi: string | null; ngayTao: string | null; ngayDi?: number; trangThai?: string | null }): { canXuLy: boolean; lyDo: string | null } {
  if (x.nhom === "returned") return { canXuLy: true, lyDo: "J&T báo hoàn / đang chuyển hoàn" };

  if (x.nhom === "other" && !/待取件|待揽收|chờ lấy/i.test(x.trangThai || "")) return { canXuLy: true, lyDo: "J&T gắn cờ đơn vấn đề" };
  if (x.nhom === "cancelled") return { canXuLy: true, lyDo: "Đơn đã huỷ trên J&T" };
  if (x.nhom === "delivered") return { canXuLy: false, lyDo: null };
  if (x.suKienCuoi && GIAO_THAT_BAI.test(x.suKienCuoi)) return { canXuLy: true, lyDo: "Giao không thành công: " + x.suKienCuoi };
  const ngayDi = x.ngayDi ?? (x.ngayTao ? Math.floor((Date.now() - ms(x.ngayTao)) / 864e5) : 0);
  if (ngayDi >= NGAY_TREO) return { canXuLy: true, lyDo: `Đang đi ${ngayDi} ngày chưa giao` };
  return { canXuLy: false, lyDo: null };
}

export function ghepSoDon<T extends { sdt: any; ngay: string; ma: string; sale: string | null; khach: string | null }>(
  sdt: string, ngayTao: string | null, soDon: Map<string, T[]>,
): T | null {
  const ds = soDon.get(sdt); if (!ds?.length) return null;
  const t = ms(ngayTao);
  let best: T | null = null, bestD = Infinity;
  for (const d of ds) {
    const dd = t ? Math.abs(ms(d.ngay) - t) : 0;
    if (dd <= 10 * 864e5 && dd < bestD) { best = d; bestD = dd; }
  }
  return best;
}

export type TuyChon = { ngay?: number; sale?: string | null; chiCanXuLy?: boolean };

export async function layDonJt(sb: any, opt: TuyChon = {}): Promise<{ rows: DonJt[]; tuoiKho: string | null; tuoiTheoDoi: string | null; soiTheoDoi: number }> {
  const ngay = opt.ngay ?? 45;
  const tu = new Date(Date.now() - ngay * 864e5).toISOString().slice(0, 10);

  let wb: any[] = [], off = 0;
  while (true) {
    const { data } = await sb.from("jt_waybills")
      .select("waybill_no,status_name,status_group,receiver_name,receiver_phone,receiver_address,goods_name,cod_value,order_create_time,updated_at,is_void")
      .gte("order_create_time", tu + " 00:00:00").eq("is_void", false)
      .order("order_create_time", { ascending: false }).range(off, off + 999);
    if (!data?.length) break; wb = wb.concat(data); if (data.length < 1000) break; off += 1000;
  }
  const tuoiKho = wb.reduce((m: string | null, r: any) => (!m || String(r.updated_at) > m ? String(r.updated_at) : m), null);

  let theoDoi: Record<string, any> = {}, tuoiTheoDoi: string | null = null, soiTheoDoi = 0;
  try {
    const raw = (await sb.from("config").select("value").eq("key", "jt_theo_doi").maybeSingle()).data?.value;
    const j = raw ? JSON.parse(raw) : null;
    theoDoi = j?.items || {}; tuoiTheoDoi = j?.at || null; soiTheoDoi = Number(j?.soi) || 0;
  } catch {  }

  const tuSo = new Date(Date.now() - (ngay + 10) * 864e5).toISOString().slice(0, 10);
  let so: any[] = []; off = 0;
  while (true) {
    const { data } = await sb.from("tg_orders").select("chat_id,message_id,ngay,sale,khach,sdt,san_pham")
      .gte("ngay", tuSo).order("ngay", { ascending: false }).range(off, off + 999);
    if (!data?.length) break; so = so.concat(data); if (data.length < 1000) break; off += 1000;
  }
  const gop = await gopTenSaleTuSo(sb);
  const soDon = new Map<string, Array<{ sdt: string; ngay: string; ma: string; sale: string | null; khach: string | null; hang: string | null }>>();
  for (const o of so) {
    const p = chuanSdt(o.sdt); if (!p) continue;
    const sp = Array.isArray(o.san_pham) ? o.san_pham.map((x: any) => x?.ten ? `${x.ten}${x.sl ? ` x${x.sl}` : ""}` : null).filter(Boolean).join(", ") : "";
    (soDon.get(p) || soDon.set(p, []).get(p)!).push({ sdt: p, ngay: o.ngay, ma: `TG-${o.chat_id}-${o.message_id}`, sale: o.sale ? gop(o.sale) : null, khach: o.khach || null, hang: sp || null });
  }

  const rows: DonJt[] = [];
  for (const w of wb) {
    const sdt = chuanSdt(w.receiver_phone);
    const d = sdt ? ghepSoDon(sdt, w.order_create_time, soDon) : null;
    const td = theoDoi[w.waybill_no] || {};
    const ngayDi = w.order_create_time ? Math.floor((Date.now() - ms(w.order_create_time)) / 864e5) : 0;
    const base = { nhom: w.status_group, trangThai: w.status_name, suKienCuoi: td.last || null, ngayTao: w.order_create_time, ngayDi };
    const { canXuLy, lyDo } = danhGiaCanXuLy(base);
    const row: DonJt = {
      waybill: w.waybill_no, ngayTao: w.order_create_time, trangThai: w.status_name || "—", nhom: w.status_group,
      khach: w.receiver_name || d?.khach || null, sdtKhach: sdt || null, diaChi: w.receiver_address || null,
      hang: d?.hang || w.goods_name || null, cod: Number(w.cod_value) || 0,
      sale: d?.sale || null, soDon: d?.ma || null,
      shipper: td.shipperName || null, sdtShipper: td.shipperPhone || null,
      suKienCuoi: td.last || null, suKienLuc: td.lastAt || null, suKien: Array.isArray(td.events) ? td.events : [],
      canXuLy, lyDo, ngayDi,
    };
    if (opt.sale && row.sale !== opt.sale) continue;
    if (opt.chiCanXuLy && !row.canXuLy) continue;
    rows.push(row);
  }
  return { rows, tuoiKho, tuoiTheoDoi, soiTheoDoi };
}

const money = (n: number) => Math.round(n || 0).toLocaleString("vi-VN") + "đ";
const dmy = (iso: string | null) => { if (!iso) return "?"; const s = String(iso); return `${s.slice(8, 10)}/${s.slice(5, 7)}`; };

export function dungBanTinDonCanXuLy(rows: DonJt[], daNhac: Set<string>, opt: { link: string; tuoiKho: string | null }): { text: string; khoa: string[]; soMoi: number } {
  const moi = rows.filter(r => r.canXuLy && !daNhac.has(`${r.waybill}|${r.lyDo}`));
  const khoa = moi.map(r => `${r.waybill}|${r.lyDo}`);
  if (!moi.length) return { text: "", khoa, soMoi: 0 };
  const nhom: Record<string, DonJt[]> = {};
  for (const r of moi) (nhom[r.sale || "CHƯA RÕ SALE (SĐT không khớp sổ đơn)"] ||= []).push(r);
  const out: string[] = [`ĐƠN J&T CẦN SALE XỬ LÝ — ${moi.length} đơn mới${rows.filter(r => r.canXuLy).length > moi.length ? ` (tổng đang treo ${rows.filter(r => r.canXuLy).length})` : ""}`];
  for (const [sale, ds] of Object.entries(nhom).sort((a, b) => b[1].length - a[1].length)) {
    out.push(``, `>> ${sale}: ${ds.length} đơn`);
    for (const r of ds) {
      out.push(`- ${r.khach || "?"} · ${r.sdtKhach || "?"} · ${r.hang || "?"} · COD ${money(r.cod)} · tạo ${dmy(r.ngayTao)}`);
      out.push(`  J&T: ${r.trangThai}${r.lyDo ? ` — ${r.lyDo}` : ""}`);
      if (r.suKienCuoi && !(r.lyDo || "").includes(r.suKienCuoi)) out.push(`  Sự kiện cuối: ${r.suKienCuoi}${r.suKienLuc ? ` (${dmy(r.suKienLuc)})` : ""}`);
      out.push(`  Shipper: ${r.shipper || "chưa rõ"}${r.sdtShipper ? ` · ${r.sdtShipper}` : ""} · vận đơn ${r.waybill}`);
    }
  }
  out.push(``, `Việc của sale: gọi khách xác nhận còn nhận không, gọi shipper nếu khách nói chưa ai liên hệ; đơn hoàn thì báo lại nhóm để lên đơn mới hoặc đóng.`);
  out.push(`Chi tiết + tra theo SĐT: ${opt.link}`);
  if (opt.tuoiKho) out.push(`Số J&T cập nhật lúc ${new Date(opt.tuoiKho).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`);
  return { text: out.join("\n"), khoa, soMoi: moi.length };
}
