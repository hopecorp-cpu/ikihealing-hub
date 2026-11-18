import { khoaKhopTen } from "@/lib/kho-van-dong";
import type { TtsOrder } from "./api";

export type TonKhoItem = { name: string; ton: number };
export type KetQuaLuat = { dat: boolean; lyDo: string[] };

const GHI_CHU_NGHI = /(^|[^\p{L}\p{M}])(test|thử|thu nghiem|đừng giao|dung giao|không nhận|khong nhan|huỷ|hủy|huy đơn|cancel|bom|fake|giả|đùa|cho tôi hỏi|gọi trước|goi truoc|hẹn giờ|hen gio)(?![\p{L}\p{M}])/iu;

export function kiemDiaChi(o: TtsOrder): string[] {
  const a = o.recipient_address || {};
  const loi: string[] = [];
  if (!(a.name || "").trim() || (a.name || "").trim().length < 2) loi.push("thiếu tên người nhận");
  const sdt = (a.phone_number || "").replace(/[^\d]/g, "");
  if (sdt.length < 9) loi.push("SĐT người nhận không hợp lệ");
  const capCoTen = (a.district_info || []).filter((d) => (d.address_name || "").trim());
  if (capCoTen.length < 3) {
    const full = (a.full_address || "").trim();

    if ((full.match(/,/g) || []).length < 3) loi.push("địa chỉ thiếu cấp quận/phường");
  }
  const chiTiet = (a.address_detail || a.address_line1 || a.full_address || "").trim();
  if (chiTiet.length < 8) loi.push("địa chỉ chi tiết quá ngắn");
  if (o.has_updated_recipient_address) loi.push("khách vừa đổi địa chỉ — người xem lại");
  const ghiChu = (o.buyer_message || "").trim();
  if (ghiChu && GHI_CHU_NGHI.test(ghiChu)) loi.push(`ghi chú khách đáng ngờ: "${ghiChu.slice(0, 80)}"`);
  return loi;
}

export function gomMon(o: TtsOrder): Array<{ ten: string; sku: string; sl: number }> {
  const m = new Map<string, { ten: string; sku: string; sl: number }>();
  for (const li of o.line_items || []) {
    const ten = (li.product_name || li.sku_name || "").trim();
    const sku = (li.seller_sku || li.sku_id || "").trim();
    const k = `${ten}|${sku}`;
    const cur = m.get(k) || { ten, sku, sl: 0 };
    cur.sl += Number(li.quantity) > 0 ? Number(li.quantity) : 1;
    m.set(k, cur);
  }
  return [...m.values()];
}

export function khopTon(ten: string, sku: string, ton: TonKhoItem[]): TonKhoItem | null {
  const k1 = khoaKhopTen(ten), k2 = khoaKhopTen(sku);
  if (!k1 && !k2) return null;
  const exact = ton.find((t) => { const kt = khoaKhopTen(t.name); return kt && (kt === k1 || (k2 && kt === k2)); });
  if (exact) return exact;
  const chua = ton.filter((t) => { const kt = khoaKhopTen(t.name); return kt.length >= 6 && k1 && (k1.includes(kt) || kt.includes(k1)); });
  return chua.length === 1 ? chua[0] : null;
}

export function kiemTonKho(o: TtsOrder, ton: TonKhoItem[] | null): string[] {
  if (!ton || !ton.length) return ["sổ tồn kho nội bộ chưa có số — không biết còn hàng không"];
  const loi: string[] = [];
  for (const mon of gomMon(o)) {
    const t = khopTon(mon.ten, mon.sku, ton);
    if (!t) { loi.push(`không khớp tồn kho: "${mon.ten || mon.sku}"`); continue; }
    if (t.ton < mon.sl) loi.push(`thiếu hàng: "${t.name}" tồn ${t.ton} < cần ${mon.sl}`);
  }
  return loi;
}

export function kiemLuatGiao(o: TtsOrder, ton: TonKhoItem[] | null): KetQuaLuat {
  const lyDo: string[] = [];
  if ((o.status || "") !== "AWAITING_SHIPMENT") lyDo.push(`trạng thái ${o.status || "?"} không phải AWAITING_SHIPMENT`);
  if (o.is_on_hold_order) lyDo.push("đơn đang ON_HOLD");
  if (o.cancel_reason || o.cancellation_initiator) lyDo.push("đơn có yêu cầu huỷ");
  if (o.is_sample_order) lyDo.push("đơn mẫu (sample) — người xem");
  const goi = (o.packages || []).map((p) => p.id).filter(Boolean);
  if (!goi.length) lyDo.push("đơn chưa có package_id");
  if (goi.length > 1) lyDo.push(`đơn tách ${goi.length} gói — người xem`);
  if (!(o.line_items || []).length) lyDo.push("đơn không có dòng hàng");
  lyDo.push(...kiemDiaChi(o));
  lyDo.push(...kiemTonKho(o, ton));
  return { dat: lyDo.length === 0, lyDo };
}

export function chonSlot(slots: Array<{ start_time: number; end_time: number; avaliable?: boolean; available?: boolean }> | undefined, nowSec = Math.floor(Date.now() / 1000)) {
  const ok = (slots || []).filter((s) => (s.avaliable ?? s.available ?? true) && Number(s.end_time) > nowSec).sort((a, b) => Number(a.start_time) - Number(b.start_time));
  return ok[0] ? { start_time: Number(ok[0].start_time), end_time: Number(ok[0].end_time) } : null;
}
