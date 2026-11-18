import { chuanSdt } from "@/lib/don-hang-jt";

export const NGAY_TRUNG = 3;

export type CoSoat = { loai: "tung-hoan" | "trung-don"; lyDo: string };
export type LichSuSdt = {
  hoan: Map<string, { waybill: string; ngay: string | null }[]>;
  so: Map<string, { ma: string; ngay: string }[]>;
};

const ngayMs = (s: string | null | undefined) => { const t = Date.parse(String(s || "").slice(0, 10)); return Number.isFinite(t) ? t : NaN; };
const dm = (s: string | null) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : "?");

export function xetDonSoat(don: { sdt: any; ngay: string; ma: string }, ls: LichSuSdt): CoSoat[] {
  const sdt = chuanSdt(don.sdt);
  if (sdt.length < 9) return [];
  const ra: CoSoat[] = [];
  const hoan = ls.hoan.get(sdt) || [];
  if (hoan.length) {
    const moi = [...hoan].sort((a, b) => String(b.ngay).localeCompare(String(a.ngay)))[0];
    ra.push({ loai: "tung-hoan", lyDo: `khách từng hoàn ${hoan.length} đơn J&T (gần nhất ${dm(moi.ngay)}, vận đơn ${moi.waybill})` });
  }
  const t = ngayMs(don.ngay);
  const trung = (ls.so.get(sdt) || []).filter((d) => d.ma !== don.ma && Math.abs(ngayMs(d.ngay) - t) <= NGAY_TRUNG * 864e5);
  if (trung.length) ra.push({ loai: "trung-don", lyDo: `trùng SĐT với ${trung.length} đơn khác trong ${NGAY_TRUNG} ngày (${trung.map((d) => dm(d.ngay)).join(", ")})` });
  return ra;
}

export async function soatDonMoi(sb: any, rows: any[]): Promise<{ row: any; co: CoSoat[] }[]> {
  const sdts = [...new Set(rows.map((r) => chuanSdt(r.sdt)).filter((s) => s.length >= 9))];
  if (!sdts.length) return [];
  const ls: LichSuSdt = { hoan: new Map(), so: new Map() };
  const tu = new Date(Math.min(...rows.map((r) => ngayMs(r.ngay)).filter(Number.isFinite)) - NGAY_TRUNG * 864e5).toISOString().slice(0, 10);

  const can = new Set(sdts);
  const [{ data: wb, error: e1 }, { data: so, error: e2 }] = await Promise.all([
    sb.from("jt_waybills").select("waybill_no,receiver_phone,order_create_time").eq("status_group", "returned").eq("is_void", false).range(0, 999),
    sb.from("tg_orders").select("chat_id,message_id,sdt,ngay").gte("ngay", tu).range(0, 999),
  ]);
  if (e1 || e2) return [];
  for (const w of wb || []) {
    const p = chuanSdt(w.receiver_phone);
    if (!can.has(p)) continue;
    (ls.hoan.get(p) || ls.hoan.set(p, []).get(p)!).push({ waybill: w.waybill_no, ngay: w.order_create_time ? String(w.order_create_time).slice(0, 10) : null });
  }
  const ma = (r: any) => `TG-${r.chat_id}-${r.message_id}`;
  for (const o of [...(so || []), ...rows]) {
    const p = chuanSdt(o.sdt); if (!can.has(p)) continue;
    const ds = ls.so.get(p) || ls.so.set(p, []).get(p)!;
    if (!ds.some((d) => d.ma === ma(o))) ds.push({ ma: ma(o), ngay: o.ngay });
  }
  const ra: { row: any; co: CoSoat[] }[] = [];
  for (const r of rows) {
    const co = xetDonSoat({ sdt: r.sdt, ngay: r.ngay, ma: ma(r) }, ls);
    if (!co.length) continue;
    r.ghi_chu = [`[SOÁT TRƯỚC KHI GỬI: ${co.map((c) => c.lyDo).join("; ")}]`, r.ghi_chu].filter(Boolean).join(" · ").slice(0, 300);
    ra.push({ row: r, co });
  }
  return ra;
}

export function dungTinSoat(ds: { row: any; co: CoSoat[] }[]): string {
  return [
    `SOÁT TRƯỚC KHI GỬI J&T — ${ds.length} đơn mới cần xem lại (máy chỉ gắn cờ, KHÔNG chặn đơn)`,
    ...ds.slice(0, 15).map(({ row, co }) =>
      `• ${row.ngay} · ${row.sale || "?"} · ${row.khach || "-"} · ${row.sdt ? "*******" + chuanSdt(row.sdt).slice(-3) : "-"} · ${co.map((c) => c.lyDo).join("; ")}`),
    ds.length > 15 ? `… và ${ds.length - 15} đơn nữa (đã gắn cờ trong ghi chú đơn).` : null,
    "Kho: gọi sale xác nhận trước khi tạo vận đơn. Khách từng hoàn thì sale gọi chốt lại hoặc xin chuyển khoản trước; trùng đơn thì hỏi sale có phải gõ hai lần không.",
  ].filter(Boolean).join("\n");
}
