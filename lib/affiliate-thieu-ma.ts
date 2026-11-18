import { chuanSdt } from "@/lib/don-hang-jt";
import { maCtvTuGhiChu, NGAY_LEAD_CTV, type LeadCtv } from "@/lib/affiliate-don";

export type DonMoi = { id: number; chat_id: string; message_id: string | number; ngay: string; sdt: string | null; ma_ctv: string | null; sale?: string | null };
export type DonCu = { id: number; sdt: string | null; ngay: string };
export type DonThieuMa = { khoa: string; ngay: string; sdtChe: string; ma: string; sale: string };

export function cheSdtBaoCao(sdt: unknown): string {
  const s = chuanSdt(sdt);
  return s.length === 10 ? s.slice(0, 2) + "xx***" + s.slice(-3) : "";
}

const ngayVN = (iso: string) => new Date(Date.parse(iso) + 7 * 3600e3).toISOString().slice(0, 10);

/**
 * @param donMoi  đơn trong cửa sổ 24h (sổ đơn tg_orders)
 * @param donCu   mọi đơn của các SĐT đó (kể cả chính đơn mới) — để biết đơn mới có phải đơn ĐẦU của SĐT không
 * @param leads   lead có "CTV: MA" trong ghi chú (phone, created_at, note)
 */
export function donThieuMa(donMoi: DonMoi[], donCu: DonCu[], leads: LeadCtv[]): DonThieuMa[] {
  const leadTheoSdt = new Map<string, { ma: string; ngay: string }[]>();
  for (const l of leads) {
    const s = chuanSdt(l.phone), ma = maCtvTuGhiChu(l.note);
    if (s.length !== 10 || !ma) continue;
    (leadTheoSdt.get(s) || leadTheoSdt.set(s, []).get(s)!).push({ ma, ngay: ngayVN(l.created_at) });
  }
  const ra: DonThieuMa[] = [];
  for (const o of donMoi) {
    if (o.ma_ctv && String(o.ma_ctv).trim()) continue;
    const s = chuanSdt(o.sdt);
    if (s.length !== 10) continue;

    const coTruoc = donCu.some((c) => chuanSdt(c.sdt) === s && c.id !== o.id && (c.ngay < o.ngay || (c.ngay === o.ngay && c.id < o.id)));
    if (coTruoc) continue;
    const ds = (leadTheoSdt.get(s) || [])
      .filter((l) => l.ngay <= o.ngay && (Date.parse(o.ngay) - Date.parse(l.ngay)) / 864e5 <= NGAY_LEAD_CTV)
      .sort((a, b) => (a.ngay < b.ngay ? 1 : -1));
    if (!ds.length) continue;
    ra.push({ khoa: `${o.chat_id}:${o.message_id}`, ngay: o.ngay, sdtChe: cheSdtBaoCao(s), ma: ds[0].ma, sale: String(o.sale || "").trim() });
  }
  return ra;
}

const esc = (s: string) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const ngayDu = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

export function dungTinThieuMa(ds: DonThieuMa[], toiDa = 10): string {
  if (!ds.length) return "";
  const dong = ds.slice(0, toiDa).map((d) => `• ${ngayDu(d.ngay)} · ${esc(d.sdtChe)} · lead có mã <b>${esc(d.ma)}</b>${d.sale ? " · " + esc(d.sale) : ""}`);
  if (ds.length > toiDa) dong.push(`… và ${ds.length - toiDa} đơn nữa`);
  return [
    `<b>Đơn khách mới THIẾU MÃ CTV</b> (24h): ${ds.length}`,
    ...dong,
    `Sale trả lời tin đơn trong nhóm Đơn Hàng bằng <code>mã: MÃ</code> để CTV được tính đúng.`,
  ].join("\n");
}

export async function baoCaoDonThieuMa(sb: any, nay = Date.now()): Promise<{ text: string; so: number; loi?: string }> {
  try {
    const homNay = new Date(nay + 7 * 3600e3).toISOString().slice(0, 10);
    const homQua = new Date(nay + 7 * 3600e3 - 864e5).toISOString().slice(0, 10);
    const { data: donMoi, error: e1 } = await sb.from("tg_orders").select("id, chat_id, message_id, ngay, sdt, ma_ctv, sale")
      .gte("ngay", homQua).lte("ngay", homNay).order("id").limit(1000);
    if (e1) throw new Error(e1.message);
    const sdts = [...new Set((donMoi || []).map((o: DonMoi) => chuanSdt(o.sdt)).filter((s: string) => s.length === 10))] as string[];
    if (!sdts.length) return { text: "", so: 0 };
    const [{ data: donCu, error: e2 }, { data: leads, error: e3 }] = await Promise.all([
      sb.from("tg_orders").select("id, sdt, ngay").in("sdt", sdts).limit(1000),
      sb.from("leads").select("phone, created_at, note").ilike("note", "%CTV: %").in("phone", sdts).limit(1000),
    ]);
    if (e2 || e3) throw new Error((e2 || e3).message);
    const ds = donThieuMa(donMoi || [], donCu || [], leads || []);
    return { text: dungTinThieuMa(ds), so: ds.length };
  } catch (e: any) {
    return { text: "", so: 0, loi: String(e?.message || e) };
  }
}
