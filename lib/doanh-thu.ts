import { VAT_RATE } from "@/lib/money";
import { vnDateStr } from "@/lib/payroll";

const VAT_MUL = 1 + VAT_RATE;

export type DongDoanhThu = {
  net_amount: number;
  order_code: string;
  order_date: string;
  product_name: string | null;
  quantity: number | null;
  sale_channel: string | null;
  kieu_ship: string | null;
  sale_name: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  nguon: "tele" | "misa";

  laSi: boolean;
};

const NHOM_SI = new Set(["-1000000000008"]);

async function donDaLoai(sb: any): Promise<Set<string>> {
  try {
    const { data } = await sb.from("config").select("value").eq("key", "sale_excluded_orders").maybeSingle();
    return new Set(Object.keys(JSON.parse(data?.value || "{}")));
  } catch { return new Set(); }
}

export async function sdtDaiLy(sb: any): Promise<Set<string>> {
  try {
    const { data } = await sb.from("config").select("value").eq("key", "dealers").maybeSingle();
    const j = JSON.parse(data?.value || "[]");
    const ds: any[] = Array.isArray(j) ? j : j.dealers || [];
    return new Set(ds.flatMap((d) => [d?.dien_thoai, ...(d?.dien_thoai_khac || [])]).map(sdtChuan).filter((p) => p.length >= 9));
  } catch { return new Set(); }
}

export type SucKhoeNguon = {
  ngayTele: string[];
  ngayMisa: string[];
  ngayNgo: string[];

  thieuUoc: number;
  teleToi: string | null;
  misaToi: string | null;
  canhBao: string[];
};

export const MOC_BO_MISA = "2026-07-01";

const NGUONG_NGO = 0.6;

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

function bungDon(o: any, laSi = false): DongDoanhThu[] {
  const ma = `TG-${o.chat_id}-${o.message_id}`;
  const chung = {
    laSi,
    order_code: ma, order_date: String(o.ngay),

    sale_channel: null, kieu_ship: o.kieu_ship || null, sale_name: o.sale || null,
    customer_name: o.khach || null, customer_phone: o.sdt || null,
    nguon: "tele" as const,
  };
  const sp: any[] = Array.isArray(o.san_pham) ? o.san_pham : [];
  const tongTra = Number(o.khach_tra) || 0;
  const tongSP = sp.reduce((s, x) => s + (Number(x?.thanh_tien) || 0), 0);

  if (!sp.length || tongSP <= 0) {
    return [{ ...chung, net_amount: Math.round(tongTra / VAT_MUL), product_name: null, quantity: null }];
  }
  const tiLe = tongTra > 0 ? tongTra / tongSP : 1;
  return sp.map((x) => ({
    ...chung,
    net_amount: Math.round(((Number(x?.thanh_tien) || 0) * tiLe) / VAT_MUL),
    product_name: x?.ten ? String(x.ten) : null,
    quantity: Number(x?.sl) || null,
  }));
}

export async function layDoanhThu(sb: any, tu: string, den: string, opts?: {

  che?: "tu-dong" | "chi-tele" | "chi-misa";

  si?: "loai" | "chi" | "gop";
}): Promise<{ rows: DongDoanhThu[]; netSi: number; donSi: number } & SucKhoeNguon> {
  const che = opts?.che || "tu-dong";
  const locSi = opts?.si || "loai";
  const [sdtSi, daLoai] = await Promise.all([sdtDaiLy(sb), donDaLoai(sb)]);
  const [teleRaw, misaRaw] = await Promise.all([
    che === "chi-misa" ? Promise.resolve([]) : layHet(() => sb.from("tg_orders")
      .select("chat_id, message_id, ngay, sale, khach, sdt, san_pham, khach_tra, kieu_ship")
      .gte("ngay", tu).lte("ngay", den).order("ngay")).catch(() => []),
    che === "chi-tele" || (che === "tu-dong" && tu >= MOC_BO_MISA) ? Promise.resolve([]) : layHet(() => sb.from("mshopkeeper_line_items")
      .select("net_amount, order_code, order_date, product_name, quantity, sale_channel, sale_name, customer_name, customer_phone")
      .gte("order_date", tu).lte("order_date", den).order("order_date")).catch(() => []),
  ]);

  const teleRows = (teleRaw || []).flatMap((o: any) =>
    bungDon(o, NHOM_SI.has(String(o.chat_id)) || sdtSi.has(sdtChuan(o.sdt)))).filter((r) => !daLoai.has(r.order_code));
  const misaAll: DongDoanhThu[] = (misaRaw || []).filter((r: any) => !daLoai.has(String(r.order_code || ""))).map((r: any) => ({
    laSi: sdtSi.has(sdtChuan(r.customer_phone)),
    net_amount: Number(r.net_amount) || 0, order_code: String(r.order_code || ""),
    order_date: String(r.order_date), product_name: r.product_name ?? null, quantity: r.quantity ?? null,
    sale_channel: r.sale_channel ?? null, kieu_ship: null, sale_name: r.sale_name ?? null,
    customer_name: r.customer_name ?? null, customer_phone: r.customer_phone ?? null,
    nguon: "misa" as const,
  }));

  const demDon = (rows: DongDoanhThu[]) => {
    const m: Record<string, Set<string>> = {};
    for (const r of rows) (m[r.order_date] ||= new Set()).add(r.order_code);
    return m;
  };
  const donTele = demDon(teleRows);
  const donMisa = demDon(misaAll);

  const coTele = teleRows.length > 0;
  const tatCa = (coTele ? teleRows : misaAll).sort((a, b) => a.order_date.localeCompare(b.order_date));

  const rowsSi = tatCa.filter((r) => r.laSi);
  const rows = locSi === "gop" ? tatCa : locSi === "chi" ? rowsSi : tatCa.filter((r) => !r.laSi);
  const netSi = rowsSi.reduce((s, r) => s + r.net_amount, 0);
  const donSi = new Set(rowsSi.map((r) => r.order_code)).size;

  const ngayTele = Object.keys(donTele).sort();
  const ngayMisa = Object.keys(donMisa).sort();
  const ngayNgo: string[] = [];
  let thieuUoc = 0;
  if (coTele) {
    for (const d of ngayMisa) {
      const nT = donTele[d]?.size || 0, nM = donMisa[d]?.size || 0;
      if (nM > 0 && nT / nM < NGUONG_NGO) {
        ngayNgo.push(d);
        thieuUoc += misaAll.filter((r) => r.order_date === d).reduce((s, r) => s + r.net_amount, 0);
      }
    }
  }

  const canhBao: string[] = [];
  if (ngayNgo.length) {
    canhBao.push(`${ngayNgo.length} ngày sổ Telegram bóc được dưới ${Math.round(NGUONG_NGO * 100)}% số đơn MISA cùng ngày ` +
      `(${ngayNgo.slice(0, 5).join(", ")}${ngayNgo.length > 5 ? "…" : ""}). MISA ghi thêm khoảng ` +
      `${Math.round(thieuUoc / 1e6)} triệu trên những ngày đó — CHƯA cộng vào số này. ` +
      `Nhiều khả năng máy bóc đơn sót lô: kiểm cron tg-boc-don trước khi dùng làm căn cứ.`);
  }
  if (che === "tu-dong" && tu >= MOC_BO_MISA && !coTele) {
    canhBao.push(`Sổ đơn Telegram TRỐNG cho kỳ ${tu} → ${den}. Từ ${MOC_BO_MISA} không còn rơi về MISA — ` +
      `kiểm cron tg-boc-don và bot trong nhóm Đơn Hàng trước khi tin con số 0 này.`);
  }
  if (che !== "tu-dong") canhBao.push(`ĐANG ÉP MỘT NGUỒN (${che}) — chỉ dùng để đối chiếu, không phải số chốt.`);

  const moiNhat = (rows: DongDoanhThu[]) =>
    rows.length ? rows.reduce((a, b) => (a.order_date > b.order_date ? a : b)).order_date : null;

  if (donSi && locSi === "loai") {
    canhBao.push(`Đã TÁCH ${donSi} đơn sỉ/đại lý (${Math.round(netSi / 1e6)} triệu net) ra khỏi số bán lẻ này — ` +
      `giá sỉ đã chiết khấu 30-32% nên không tính vào KPI/hoa hồng. Muốn xem tổng thì gọi kèm si:"gop".`);
  }

  return {
    rows, netSi, donSi,
    ngayTele, ngayMisa, ngayNgo: ngayNgo.sort(), thieuUoc,
    teleToi: moiNhat(teleRows), misaToi: moiNhat(misaAll), canhBao,
  };
}

export async function layDoanhThuNhieuThang(sb: any, tu: string, den: string): Promise<{ rows: DongDoanhThu[]; canhBao: string[] }> {
  const thangs: Array<[string, string]> = [];
  let d = new Date(`${tu.slice(0, 7)}-01T00:00:00Z`);
  const cuoi = new Date(`${den}T00:00:00Z`);
  while (d <= cuoi) {
    const ym = d.toISOString().slice(0, 7);
    const dau = ym === tu.slice(0, 7) ? tu : `${ym}-01`;
    const next = new Date(d); next.setUTCMonth(next.getUTCMonth() + 1);
    const cuoiThang = new Date(next.getTime() - 86400000).toISOString().slice(0, 10);
    thangs.push([dau, cuoiThang < den ? cuoiThang : den]);
    d = next;
  }
  const ket = await Promise.all(thangs.map(([a, b]) => layDoanhThu(sb, a, b)));
  const rows = ket.flatMap((k) => k.rows).sort((a, b) => a.order_date.localeCompare(b.order_date));
  const canhBao = ket.flatMap((k, i) => k.canhBao.map((c) => `[${thangs[i][0].slice(0, 7)}] ${c}`));
  return { rows, canhBao };
}

export async function layDonTheoSdt(sb: any, sdt: string, gioiHan = 60): Promise<DongDoanhThu[]> {
  const chuan = sdtChuan(sdt);
  if (chuan.length < 9) return [];
  const bienThe = Array.from(new Set([sdt, chuan, "84" + chuan.replace(/^0/, ""), "+84" + chuan.replace(/^0/, "")]));
  const [teleRaw, misaRaw] = await Promise.all([
    sb.from("tg_orders").select("chat_id, message_id, ngay, sale, khach, sdt, san_pham, khach_tra, kieu_ship")
      .in("sdt", bienThe).order("ngay", { ascending: false }).limit(gioiHan).then((r: any) => r?.data || []).catch(() => []),
    sb.from("mshopkeeper_line_items")
      .select("net_amount, order_code, order_date, product_name, quantity, sale_channel, sale_name, customer_name, customer_phone")
      .in("customer_phone", bienThe).order("order_date", { ascending: false }).limit(gioiHan * 3).then((r: any) => r?.data || []).catch(() => []),
  ]);
  const sdtSi = await sdtDaiLy(sb);
  const laSi = sdtSi.has(chuan);
  const tele: DongDoanhThu[] = (teleRaw as any[]).flatMap((o) => bungDon(o, laSi));
  const ngayTele = new Set(tele.map((r) => r.order_date));
  const misa: DongDoanhThu[] = (misaRaw as any[]).filter((r) => !ngayTele.has(String(r.order_date))).map((r) => ({
    laSi,
    net_amount: Number(r.net_amount) || 0, order_code: String(r.order_code || ""), order_date: String(r.order_date),
    product_name: r.product_name ?? null, quantity: r.quantity ?? null, sale_channel: r.sale_channel ?? null, kieu_ship: null,
    sale_name: r.sale_name ?? null, customer_name: r.customer_name ?? null, customer_phone: r.customer_phone ?? null, nguon: "misa" as const,
  }));
  return [...tele, ...misa].sort((a, b) => b.order_date.localeCompare(a.order_date));
}

export async function layDonTheoMa(sb: any, ma: string): Promise<DongDoanhThu[]> {
  const sdtSi = await sdtDaiLy(sb);
  const m = /^TG-(-?\d+)-(\d+)$/i.exec(ma.trim());
  if (m) {
    const { data } = await sb.from("tg_orders").select("chat_id, message_id, ngay, sale, khach, sdt, san_pham, khach_tra, kieu_ship")
      .eq("chat_id", Number(m[1])).eq("message_id", Number(m[2])).limit(1);
    return ((data || []) as any[]).flatMap((o) =>
      bungDon(o, NHOM_SI.has(String(o.chat_id)) || sdtSi.has(sdtChuan(o.sdt))));
  }
  const { data } = await sb.from("mshopkeeper_line_items")
    .select("net_amount, order_code, order_date, product_name, quantity, sale_channel, sale_name, customer_name, customer_phone")
    .ilike("order_code", ma.trim()).limit(10);
  return ((data || []) as any[]).map((r) => ({
    laSi: sdtSi.has(sdtChuan(r.customer_phone)),
    net_amount: Number(r.net_amount) || 0, order_code: String(r.order_code || ""), order_date: String(r.order_date),
    product_name: r.product_name ?? null, quantity: r.quantity ?? null, sale_channel: r.sale_channel ?? null, kieu_ship: null,
    sale_name: r.sale_name ?? null, customer_name: r.customer_name ?? null, customer_phone: r.customer_phone ?? null, nguon: "misa" as const,
  }));
}

const sdtChuan = (p: any) => String(p || "").replace(/\D/g, "").replace(/^84/, "0");

const tenChuan = (s: any) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

const KHONG_RO = new Set(["", "chưa rõ", "chua ro", "không rõ", "khong ro", "n/a", "null"]);
const laChuaRo = (s: any) => KHONG_RO.has(tenChuan(s));

export function gopTenSale(dsSale: Array<{ ten: string }>): (raw: any) => string {
  const theoDay = new Map<string, string>();
  const theoGoi = new Map<string, string[]>();
  for (const s of dsSale) {
    const day = tenChuan(s.ten);
    if (!day) continue;
    theoDay.set(day, s.ten);
    const goi = day.split(" ").pop() || "";
    if (goi) theoGoi.set(goi, [...(theoGoi.get(goi) || []), s.ten]);
  }
  return (raw: any) => {
    const c = tenChuan(raw);
    if (theoDay.has(c)) return theoDay.get(c)!;
    const trung = theoGoi.get(c);
    return trung?.length === 1 ? trung[0] : String(raw ?? "").trim();
  };
}

export async function gopTenSaleTuSo(sb: any): Promise<(raw: any) => string> {
  let data: any[] = [];
  try { data = (await sb.from("users").select("full_name").not("full_name", "is", null)).data || []; } catch {  }
  return gopTenSale(data.map((u: any) => ({ ten: u.full_name })));
}

export async function tongDoanhThu(sb: any, tu: string, den: string): Promise<{
  net: number; soDong: number; soDon: number; soKhach: number;
  theoNgay: Array<{ ngay: string; net: number; don: number }>;
  suc: SucKhoeNguon;
}> {
  const { rows, ...suc } = await layDoanhThu(sb, tu, den);
  const ngay: Record<string, { net: number; don: Set<string> }> = {};
  const don = new Set<string>(), khach = new Set<string>();
  let net = 0;
  for (const r of rows) {
    net += r.net_amount;
    don.add(r.order_code);
    const p = sdtChuan(r.customer_phone);
    if (p) khach.add(p);
    const o = (ngay[r.order_date] ||= { net: 0, don: new Set() });
    o.net += r.net_amount;
    o.don.add(r.order_code);
  }
  return {
    net, soDong: rows.length, soDon: don.size, soKhach: khach.size,
    theoNgay: Object.keys(ngay).sort().map((d) => ({ ngay: d, net: ngay[d].net, don: ngay[d].don.size })),
    suc,
  };
}

export async function doanhThuTheoSale(sb: any, tu: string, den: string, opts?: {
  ov?: { excluded: Set<string>; reassign: Record<string, string> };

  dsSale?: Array<{ ten: string }>;
}): Promise<{
  theoSale: Array<{ khoa: string; ten: string; net: number; don: number; khach: number; netTele: number; netMisa: number }>;

  chuaRo: { net: number; don: number; ngay: string[] };
  suc: SucKhoeNguon;
}> {
  const { rows, ...suc } = await layDoanhThu(sb, tu, den);
  const ov = opts?.ov;

  const gop = gopTenSale(opts?.dsSale || []);
  const chuanTen = (raw: any) => {
    const ten = gop(raw);
    return { khoa: tenChuan(ten), ten };
  };

  const gom: Record<string, { ten: string; net: number; don: Set<string>; khach: Set<string>; netTele: number; netMisa: number }> = {};
  const chuaRo = { net: 0, don: new Set<string>(), ngay: new Set<string>() };

  for (const r of rows) {
    if (ov?.excluded.has(r.order_code)) continue;
    const ten = ov?.reassign[r.order_code] ?? r.sale_name;
    if (laChuaRo(ten)) {
      chuaRo.net += r.net_amount;
      chuaRo.don.add(r.order_code);
      chuaRo.ngay.add(r.order_date);
      continue;
    }
    const { khoa: k, ten: tenHien } = chuanTen(ten);
    const g = (gom[k] ||= { ten: tenHien, net: 0, don: new Set(), khach: new Set(), netTele: 0, netMisa: 0 });
    g.net += r.net_amount;
    g.don.add(r.order_code);
    const p = sdtChuan(r.customer_phone);
    if (p) g.khach.add(p);
    if (r.nguon === "tele") g.netTele += r.net_amount; else g.netMisa += r.net_amount;
  }

  return {
    theoSale: Object.entries(gom)
      .map(([khoa, g]) => ({ khoa, ten: g.ten, net: g.net, don: g.don.size, khach: g.khach.size, netTele: g.netTele, netMisa: g.netMisa }))
      .sort((a, b) => b.net - a.net),
    chuaRo: { net: chuaRo.net, don: chuaRo.don.size, ngay: [...chuaRo.ngay].sort() },
    suc,
  };
}

export async function doanhThuLuyKeThangTheoSale(sb: any, thang?: string): Promise<{
  thang: string; tu: string; den: string;
  tong: { net: number; don: number };
  theoSale: Array<{ ten: string; net: number; don: number; khach: number }>;

  chuaRo: { net: number; don: number; ngay: string[] };
  canhBao: string[];
}> {
  const homNay = vnDateStr();
  const t = /^\d{4}-\d{2}$/.test(thang || "") ? (thang as string) : homNay.slice(0, 7);
  const tu = `${t}-01`;
  const [y, m] = t.split("-").map(Number);
  const cuoiThang = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const dangChay = homNay < cuoiThang && homNay >= tu;
  const den = dangChay ? homNay : cuoiThang;

  let dsSale: Array<{ ten: string }> = [];
  try {
    const { data } = await sb.from("users").select("full_name").not("full_name", "is", null);
    dsSale = (data || []).map((u: any) => ({ ten: u.full_name }));
  } catch {  }

  const { theoSale, chuaRo, suc } = await doanhThuTheoSale(sb, tu, den, { dsSale });
  const canhBao = [...suc.canhBao];
  if (dangChay) canhBao.push(`Tháng ${t} ĐANG CHẠY (mới tới ${den}) — số lũy kế thấp là bình thường, cấm so thẳng với tháng đã chốt.`);
  if (chuaRo.don > 0) canhBao.push(`${chuaRo.don} đơn / ${Math.round(chuaRo.net).toLocaleString("vi-VN")}đ chưa gán được sale — gán ở /gan-don trước khi chốt hoa hồng.`);

  return {
    thang: t, tu, den,
    tong: {
      net: theoSale.reduce((s, x) => s + x.net, 0) + chuaRo.net,
      don: theoSale.reduce((s, x) => s + x.don, 0) + chuaRo.don,
    },
    theoSale: theoSale.map(({ ten, net, don, khach }) => ({ ten, net, don, khach })),
    chuaRo,
    canhBao,
  };
}

export async function tuoiNguonDon(sb: any): Promise<{
  teleToi: string | null; teleTre: number | null;
  misaToi: string | null; misaTre: number | null;
  muSo: boolean; canhBao: string[];
}> {
  const moiNhat = async (bang: string, cot: string) => {
    try {
      const { data } = await sb.from(bang).select(cot).order(cot, { ascending: false }).limit(1);
      return data?.[0]?.[cot] ? String(data[0][cot]).slice(0, 10) : null;
    } catch { return null; }
  };
  const [teleToi, misaToi] = await Promise.all([
    moiNhat("tg_orders", "ngay"),
    moiNhat("mshopkeeper_line_items", "order_date"),
  ]);
  const homNay = new Date().toISOString().slice(0, 10);
  const tre = (d: string | null) => (d ? Math.round((Date.parse(homNay) - Date.parse(d)) / 86400000) : null);
  const teleTre = tre(teleToi), misaTre = tre(misaToi);
  const cu = (n: number | null) => n === null || n > 2;

  const canhBao: string[] = [];
  if (cu(teleTre)) canhBao.push(`Sổ đơn Telegram cũ ${teleTre ?? "?"} ngày — kiểm cron tg-boc-don.`);

  return { teleToi, teleTre, misaToi, misaTre, muSo: cu(teleTre), canhBao };
}

export async function soiNguocJT(sb: any, tu: string, den: string): Promise<{
  donTrongSo: number; coVanDon: number; thieuVanDon: number;
  vanDon: number; vanDonKhongCoDon: number; tienVanDonLac: number;
  chiTietThieu: Array<{ ngay: string; sale: string | null; khach: string | null; sdt: string | null; tien: number }>;
  chiTietLac: Array<{ ngay: string; waybill: string; ten: string | null; sdt: string; cod: number; trangThai: string | null }>;
}> {
  const [don, wb] = await Promise.all([
    layHet(() => sb.from("tg_orders").select("ngay, sale, khach, sdt, khach_tra").gte("ngay", tu).lte("ngay", den).order("ngay")).catch(() => []),
    layHet(() => sb.from("jt_waybills").select("waybill_no, receiver_phone, receiver_name, cod_value, status_name, order_create_time")
      .gte("order_create_time", tu).lt("order_create_time", `${den}T23:59:59`).order("order_create_time")).catch(() => []),
  ]);
  const sdtVanDon = new Set((wb || []).map((w: any) => sdtChuan(w.receiver_phone)).filter(Boolean));
  const sdtDon = new Set((don || []).map((d: any) => sdtChuan(d.sdt)).filter(Boolean));

  const thieu = (don || []).filter((d: any) => { const p = sdtChuan(d.sdt); return !p || !sdtVanDon.has(p); });
  const lac = (wb || []).filter((w: any) => !sdtDon.has(sdtChuan(w.receiver_phone)));

  return {
    donTrongSo: (don || []).length,
    coVanDon: (don || []).length - thieu.length,
    thieuVanDon: thieu.length,
    vanDon: (wb || []).length,
    vanDonKhongCoDon: lac.length,
    tienVanDonLac: lac.reduce((s: number, w: any) => s + (Number(w.cod_value) || 0), 0),
    chiTietThieu: thieu.slice(0, 50).map((d: any) => ({ ngay: String(d.ngay), sale: d.sale, khach: d.khach, sdt: d.sdt, tien: Number(d.khach_tra) || 0 })),
    chiTietLac: lac.slice(0, 50).map((w: any) => ({
      ngay: String(w.order_create_time).slice(0, 10), waybill: String(w.waybill_no),
      ten: w.receiver_name, sdt: String(w.receiver_phone || ""), cod: Number(w.cod_value) || 0, trangThai: w.status_name,
    })),
  };
}

export type DonTele = {
  ma: string;
  ngay: string;
  sale: string | null;
  khach: string | null;
  sdt: string;
  khachTra: number;
  giamGia: number;
  giaGoc: number;
  qua: Array<{ ten: string; sl: number }>;
  kieuShip: string | null;
  phiShip: number;
  ghiChu: string | null;
  laSi: boolean;
};

export async function layDonTele(sb: any, tu: string, den: string): Promise<DonTele[]> {
  const sdtSi = await sdtDaiLy(sb);
  const raw = await layHet(() => sb.from("tg_orders")
    .select("chat_id, message_id, ngay, sale, khach, sdt, qua, gia_goc, giam_gia, khach_tra, kieu_ship, phi_ship, ghi_chu")
    .gte("ngay", tu).lte("ngay", den).order("ngay")).catch(() => []);
  return (raw || []).map((o: any) => {
    const qua = (Array.isArray(o.qua) ? o.qua : []).map((q: any) =>
      typeof q === "string" ? { ten: q, sl: 1 } : { ten: String(q?.ten || ""), sl: Number(q?.sl) || 1 })
      .filter((q: any) => q.ten);
    return {
      ma: `TG-${o.chat_id}-${o.message_id}`,
      ngay: String(o.ngay),
      sale: o.sale ?? null,
      khach: o.khach ?? null,
      sdt: sdtChuan(o.sdt),
      khachTra: Number(o.khach_tra) || 0,
      giamGia: Number(o.giam_gia) || 0,
      giaGoc: Number(o.gia_goc) || 0,
      qua,
      kieuShip: o.kieu_ship || null,
      phiShip: Number(o.phi_ship) || 0,
      ghiChu: o.ghi_chu ?? null,
      laSi: NHOM_SI.has(String(o.chat_id)) || sdtSi.has(sdtChuan(o.sdt)),
    };
  });
}

export function laSaleChuaRo(s: any): boolean { return laChuaRo(s); }
