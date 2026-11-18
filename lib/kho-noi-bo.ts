import { layKhoVanDong, khoaKhopTen } from "@/lib/kho-van-dong";
import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { vnDateStr } from "@/lib/payroll";

export type MocTon = { tuNgay: string; nguon: string; items: { name: string; qty: number }[] };
export type DotNhap = { ngay: string; ghiChu?: string; items: { name: string; qty: number }[] };

export type TonNoiBo = {
  moc: MocTon | null;
  items: { name: string; moc: number; nhap: number; guiDi: number; hoanVe: number; ton: number }[];
  tongNhap: number; soDotNhap: number;
  khongKhop: string[];
  ghiChu: string[];
};

async function docJson<T = any>(key: string): Promise<T | null> {
  try { const raw = await getConfigValue(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export async function layMocTon(sb: any): Promise<MocTon | null> {
  const moc = await docJson<MocTon>("kho_ton_moc");
  if (moc?.items?.length) return moc;
  const misa = await docJson<any>("misa_stock");
  if (!misa?.items?.length) return null;
  const seed: MocTon = {
    tuNgay: (misa.generatedAt || new Date().toISOString()).slice(0, 10),
    nguon: `số MISA cào lần cuối ${misa.generatedAt ? new Date(misa.generatedAt).toLocaleString("vi-VN") : "?"} — thay bằng kiểm kho thật khi có`,
    items: misa.items.filter((x: any) => Number(x.closing) > 0).map((x: any) => ({ name: x.name, qty: Number(x.closing) || 0 })),
  };
  await setConfigValue("kho_ton_moc", JSON.stringify(seed), "Mốc tồn kho nội bộ (seed từ misa_stock lần cuối)");
  return seed;
}

export async function ghiDotNhap(sb: any, dot: DotNhap): Promise<void> {
  const ds = (await docJson<DotNhap[]>("kho_nhap")) || [];
  ds.unshift({ ...dot, ngay: dot.ngay || vnDateStr() });
  await setConfigValue("kho_nhap", JSON.stringify(ds.slice(0, 200)), "Các đợt nhập kho ghi tay (sổ tồn nội bộ)");
}

export async function khaiMocTon(sb: any, items: { name: string; qty: number }[], nguon: string): Promise<void> {
  const moc: MocTon = { tuNgay: vnDateStr(), nguon, items };
  await setConfigValue("kho_ton_moc", JSON.stringify(moc), "Mốc tồn kho nội bộ (kiểm kho khai tay)");
}

export async function layTonNoiBo(sb: any, den?: string): Promise<TonNoiBo> {
  const ghiChu: string[] = [];
  const moc = await layMocTon(sb);
  if (!moc) {
    return { moc: null, items: [], tongNhap: 0, soDotNhap: 0, khongKhop: [], ghiChu: ["Chưa có mốc tồn (config kho_ton_moc trống và không còn số MISA cũ) — kho kiểm thật rồi khai mốc trên /kho thì sổ bắt đầu chạy."] };
  }
  const denNgay = den || vnDateStr();
  const khopTay = (await docJson<Record<string, string>>("kho_khop_ten")) || {};
  const chuan = (s: string) => khoaKhopTen(khopTay[s] || s);

  const so = new Map<string, { name: string; moc: number; nhap: number; guiDi: number; hoanVe: number }>();
  for (const it of moc.items) so.set(chuan(it.name), { name: it.name, moc: it.qty, nhap: 0, guiDi: 0, hoanVe: 0 });

  const nhaps = ((await docJson<DotNhap[]>("kho_nhap")) || []).filter(d => d.ngay >= moc.tuNgay && d.ngay <= denNgay);
  let tongNhap = 0;
  for (const d of nhaps) for (const it of d.items || []) {
    const k = chuan(it.name);
    const r = so.get(k) || so.set(k, { name: it.name, moc: 0, nhap: 0, guiDi: 0, hoanVe: 0 }).get(k)!;
    r.nhap += Number(it.qty) || 0; tongNhap += Number(it.qty) || 0;
  }

  const vd = await layKhoVanDong(sb, moc.tuNgay, denNgay);
  const khongKhop: string[] = [];
  for (const p of vd.products) {
    const r = so.get(chuan(p.name));
    if (!r) { khongKhop.push(p.name); continue; }
    r.guiDi += p.shipped; r.hoanVe += p.returned;
  }
  if (khongKhop.length) ghiChu.push(`${khongKhop.length} tên hàng trên vận đơn không có trong sổ (quà tặng/combo hoặc tên lệch) — thêm cặp tên vào config kho_khop_ten nếu là hàng kho.`);
  if (!nhaps.length) ghiChu.push("Chưa ghi đợt nhập kho nào từ mốc — nếu có hàng về mà không ghi, tồn tính sẽ thấp hơn thật.");

  const items = [...so.values()]
    .map(r => ({ ...r, ton: r.moc + r.nhap - r.guiDi + r.hoanVe }))
    .sort((a, b) => a.ton - b.ton);
  return { moc, items, tongNhap, soDotNhap: nhaps.length, khongKhop, ghiChu };
}
