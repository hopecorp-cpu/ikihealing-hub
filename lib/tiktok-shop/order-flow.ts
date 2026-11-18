import { getServiceClient } from "@/lib/supabase-server";
import { layTonNoiBo } from "@/lib/kho-noi-bo";
import { TTS_SELLER_CENTER, ttsConfig } from "./config";
import { getHandoverTimeSlots, getOrderDetail, getShippingDocument, shipPackage, taiNhanPdf, type TtsOrder } from "./api";
import { chonSlot, gomMon, kiemLuatGiao, type TonKhoItem } from "./luat-giao";
import { guiFileTts, guiNhomTts, tgEscape } from "./telegram";

export type TtsOrderRow = {
  order_id: string; shop_id: string | null; status: string | null;
  buyer_name: string | null; buyer_message: string | null; recipient: any; line_items: any; item_count: number | null;
  total_amount: number | null; currency: string | null;
  paid_at: string | null; create_time: string | null; update_time: string | null;
  package_ids: string[] | null; tracking_number: string | null; shipping_provider: string | null;
  notified_at: string | null; label_sent_at: string | null;
  ship_status: string | null; ship_attempted_at: string | null; ship_note: string | null;
  flags: Record<string, any> | null; raw: any;
};

const fmtVnd = (n: number | null | undefined) => (n == null ? "?" : Math.round(n).toLocaleString("vi-VN") + "đ");
const isoTuGiay = (s?: number | null) => (s ? new Date(Number(s) * 1000).toISOString() : null);
const gioVN = (iso?: string | null) => (iso ? new Date(new Date(iso).getTime() + 7 * 3600e3).toISOString().slice(0, 16).replace("T", " ") : "?");
export const linkDon = (id: string) => `${TTS_SELLER_CENTER}/order/detail?order_no=${encodeURIComponent(id)}`;

function khuVuc(o: TtsOrder): string {
  const cap = (o.recipient_address?.district_info || []).map((d) => (d.address_name || "").trim()).filter(Boolean);
  return cap.length ? cap.slice(-2).reverse().join(", ") : (o.recipient_address?.region_code || "?");
}

export function dongTuDon(o: TtsOrder, shopId: string | null): Omit<TtsOrderRow, "notified_at" | "label_sent_at" | "ship_status" | "ship_attempted_at" | "ship_note" | "flags"> {
  const mon = gomMon(o);
  const a = o.recipient_address || {};
  return {
    order_id: o.id, shop_id: shopId, status: o.status || null,
    buyer_name: (a.name || "").trim() || null,
    buyer_message: (o.buyer_message || "").trim() || null,
    recipient: { name: a.name, phone: a.phone_number, full_address: a.full_address, detail: a.address_detail || a.address_line1, district_info: a.district_info, region_code: a.region_code },
    line_items: mon,
    item_count: mon.reduce((s, m) => s + m.sl, 0),
    total_amount: o.payment?.total_amount != null ? Number(o.payment.total_amount) : null,
    currency: o.payment?.currency || "VND",
    paid_at: isoTuGiay(o.paid_time), create_time: isoTuGiay(o.create_time), update_time: isoTuGiay(o.update_time),
    package_ids: (o.packages || []).map((p) => p.id).filter(Boolean),
    tracking_number: o.tracking_number || null, shipping_provider: o.shipping_provider || null,
    raw: o,
  };
}

async function docRow(orderId: string): Promise<TtsOrderRow | null> {
  const { data, error } = await getServiceClient().from("tts_orders").select("*").eq("order_id", orderId).maybeSingle();
  if (error) throw new Error(`Đọc tts_orders ${orderId}: ${error.message}`);
  return (data as TtsOrderRow) || null;
}

async function capNhat(orderId: string, patch: Partial<TtsOrderRow>) {
  const { error } = await getServiceClient().from("tts_orders").update({ ...patch, updated_at: new Date().toISOString() } as any).eq("order_id", orderId);
  if (error) throw new Error(`Cập nhật tts_orders ${orderId}: ${error.message}`);
}

async function datCo(row: TtsOrderRow, k: string, v: any) {
  const flags = { ...(row.flags || {}), [k]: v };
  await capNhat(row.order_id, { flags });
  row.flags = flags;
}

export function tinDonMoi(row: TtsOrderRow): string {
  const c = ttsConfig();
  const mon = (row.line_items || []) as Array<{ ten: string; sku: string; sl: number }>;
  const dongMon = mon.map((m) => `• ${tgEscape(m.ten || m.sku)} ×${m.sl}`).join("\n") || "• (không đọc được dòng hàng)";
  const giao = c.autoShip ? `máy tự giao sau ${c.shipDelayMinutes}' nếu qua luật` : "tự giao đang TẮT — sale giao tay trên Seller Center";
  return [
    `<b>ĐƠN TIKTOK SHOP MỚI</b> · <code>${tgEscape(row.order_id)}</code>`,
    dongMon,
    `Tổng: <b>${fmtVnd(row.total_amount)}</b>${row.currency && row.currency !== "VND" ? " " + tgEscape(row.currency) : ""} · ${row.item_count || 0} món`,
    `Khách: ${tgEscape(row.buyer_name || "?")} · ${tgEscape(khuVuc(row.raw || {}))}`,
    `Thanh toán: ${gioVN(row.paid_at)} (giờ VN)`,
    row.buyer_message ? `Ghi chú khách: ${tgEscape(row.buyer_message.slice(0, 200))}` : "",
    `Giao: ${giao}`,
    `Mở đơn: ${linkDon(row.order_id)}`,
  ].filter(Boolean).join("\n");
}

export async function dongBoDon(orderIds: string[], shopId: string | null): Promise<TtsOrderRow[]> {
  const ids = [...new Set(orderIds.filter(Boolean))];
  if (!ids.length) return [];
  const chiTiet = await getOrderDetail(ids);
  const sb = getServiceClient();
  const out: TtsOrderRow[] = [];
  for (const o of chiTiet) {
    if (!o?.id) continue;
    const cu = await docRow(o.id);
    const moi = dongTuDon(o, shopId || cu?.shop_id || null);
    const { data, error } = await sb.from("tts_orders").upsert({ ...moi, updated_at: new Date().toISOString() }, { onConflict: "order_id" }).select("*").single();
    if (error) throw new Error(`Ghi tts_orders ${o.id}: ${error.message}`);
    const row = data as TtsOrderRow;
    await xuLySauDongBo(row, cu);
    out.push(row);
  }
  return out;
}

async function xuLySauDongBo(row: TtsOrderRow, cu: TtsOrderRow | null) {
  const st = row.status || "";
  if (st === "AWAITING_SHIPMENT" && !row.notified_at) {
    const r = await guiNhomTts(tinDonMoi(row));
    if (r.ok) { await capNhat(row.order_id, { notified_at: new Date().toISOString() }); row.notified_at = new Date().toISOString(); }
    else console.error("[tts] báo đơn mới thất bại", row.order_id, r.loi);
  }
  if (st === "CANCEL" && !(row.flags || {}).huy_bao_at) {
    const r = await guiNhomTts(`<b>ĐƠN TIKTOK BỊ HUỶ</b> · <code>${tgEscape(row.order_id)}</code>\nTổng ${fmtVnd(row.total_amount)} · ${tgEscape(row.buyer_name || "?")}\nLý do: ${tgEscape(String((row.raw as any)?.cancel_reason || "không ghi"))} · bên huỷ: ${tgEscape(String((row.raw as any)?.cancellation_initiator || "?"))}\n${row.label_sent_at ? "ĐÃ in nhãn trước đó — KHÔNG giao nữa, kiểm kho." : ""}\nMở đơn: ${linkDon(row.order_id)}`);
    if (r.ok) await datCo(row, "huy_bao_at", new Date().toISOString());
  }

  if ((st === "AWAITING_COLLECTION" || st === "IN_TRANSIT") && !row.label_sent_at && (row.package_ids || []).length) {
    await guiNhanDon(row, cu?.status !== st ? "đơn vừa chuyển sang chờ lấy hàng" : "gửi lại nhãn còn thiếu");
  }
}

export async function guiNhanDon(row: TtsOrderRow, ngu: string): Promise<boolean> {
  const pkg = (row.package_ids || [])[0];
  if (!pkg) return false;
  try {
    const doc = await getShippingDocument(pkg, { documentType: "SHIPPING_LABEL", documentSize: "A6" });
    if (!doc?.doc_url) throw new Error("TikTok chưa trả doc_url (nhãn có thể chưa sẵn sàng)");
    const pdf = await taiNhanPdf(doc.doc_url);
    const tracking = doc.tracking_number || row.tracking_number || "?";
    const caption = `Nhãn A6 đơn ${row.order_id} · mã vận đơn ${tracking} · ${(row.line_items || []).map((m: any) => `${m.ten} ×${m.sl}`).join(", ").slice(0, 300)} · ${fmtVnd(row.total_amount)} (${ngu})`;
    const r = await guiFileTts({ ten: `tts-${row.order_id}-A6.pdf`, noiDung: pdf, kieu: "application/pdf" }, caption);
    if (!r.nhom && !r.tien) throw new Error(`gửi Telegram thất bại: ${r.loi.join("; ")}`);
    await capNhat(row.order_id, { label_sent_at: new Date().toISOString(), tracking_number: doc.tracking_number || row.tracking_number, flags: { ...(row.flags || {}), nhan_loi: null, nhan_gui: { nhom: r.nhom, tien: r.tien } } });
    return true;
  } catch (e: any) {
    const soLan = Number((row.flags || {}).nhan_thu || 0) + 1;
    await datCo(row, "nhan_thu", soLan);
    await datCo(row, "nhan_loi", String(e?.message || e).slice(0, 300));
    if (soLan === 3) await guiNhomTts(`<b>KHÔNG TẢI ĐƯỢC NHÃN</b> đơn <code>${tgEscape(row.order_id)}</code> sau 3 lượt: ${tgEscape(String(e?.message || e)).slice(0, 200)}\nIn tay trên Seller Center: ${linkDon(row.order_id)}`);
    console.error("[tts] gửi nhãn thất bại", row.order_id, e?.message || e);
    return false;
  }
}

async function docTonKho(): Promise<TonKhoItem[] | null> {
  try {
    const t = await layTonNoiBo(getServiceClient());
    if (!t.moc || !t.items.length) return null;
    return t.items.map((i) => ({ name: i.name, ton: i.ton }));
  } catch (e) { console.error("[tts] đọc tồn kho nội bộ hỏng", e); return null; }
}

export async function chayLichGiao(): Promise<{ xet: number; giao: number; tay: number; loi: number; bo: number }> {
  const c = ttsConfig();
  const sb = getServiceClient();
  const mocCho = new Date(Date.now() - c.shipDelayMinutes * 60e3).toISOString();
  const { data, error } = await sb.from("tts_orders").select("*")
    .eq("status", "AWAITING_SHIPMENT").is("label_sent_at", null)
    .or("ship_status.is.null,ship_status.eq.waiting,ship_status.eq.error")
    .lte("paid_at", mocCho).order("paid_at", { ascending: true }).limit(30);
  if (error) throw new Error(`Đọc đơn chờ giao: ${error.message}`);
  const rows = (data || []) as TtsOrderRow[];
  const kq = { xet: rows.length, giao: 0, tay: 0, loi: 0, bo: 0 };
  if (!rows.length) return kq;

  const moi = await dongBoDon(rows.map((r) => r.order_id), rows[0].shop_id);
  const ton = await docTonKho();
  for (const row of moi) {
    if (row.status !== "AWAITING_SHIPMENT" || row.label_sent_at) { kq.bo++; continue; }
    const luat = kiemLuatGiao(row.raw as TtsOrder, ton);
    if (!c.autoShip) {

      if (!(row.flags || {}).luat_kho) await datCo(row, "luat_kho", { dat: luat.dat, lyDo: luat.lyDo, luc: new Date().toISOString() });
      kq.bo++; continue;
    }
    if (!luat.dat) {
      await capNhat(row.order_id, { ship_status: "manual", ship_note: luat.lyDo.join("; ").slice(0, 500) });
      if (!(row.flags || {}).tay_bao_at) {
        const r = await guiNhomTts(`<b>CẦN XỬ LÝ TAY</b> · đơn <code>${tgEscape(row.order_id)}</code> ${fmtVnd(row.total_amount)}\nMáy KHÔNG tự giao vì:\n${luat.lyDo.map((l) => "• " + tgEscape(l)).join("\n")}\nMở đơn: ${linkDon(row.order_id)}`);
        if (r.ok) await datCo(row, "tay_bao_at", new Date().toISOString());
      }
      kq.tay++; continue;
    }
    const soLan = Number((row.flags || {}).ship_thu || 0);
    if (soLan >= 3) { kq.bo++; continue; }
    try {
      const pkg = (row.package_ids || [])[0];
      const slots = await getHandoverTimeSlots(pkg);
      let body: Parameters<typeof shipPackage>[1];
      if (c.handoverMethod === "PICKUP") {
        if (slots?.can_pickup === false) throw new Error("gói này không hỗ trợ PICKUP (đổi TTS_HANDOVER_METHOD=DROP_OFF hoặc giao tay)");
        const slot = chonSlot(slots?.pickup_time_slots);
        if (!slot) throw new Error("không còn khung giờ lấy hàng trống");
        body = { handover_method: "PICKUP", pickup_slot: slot };
      } else {
        if (slots?.can_drop_off === false) throw new Error("gói này không hỗ trợ DROP_OFF");
        body = { handover_method: "DROP_OFF" };
      }
      await capNhat(row.order_id, { ship_attempted_at: new Date().toISOString(), flags: { ...(row.flags || {}), ship_thu: soLan + 1, ship_body: body } });
      await shipPackage(pkg, body);
      await capNhat(row.order_id, { ship_status: "shipped", ship_note: `máy giao ${body.handover_method}${body.pickup_slot ? ` slot ${gioVN(isoTuGiay(body.pickup_slot.start_time))}` : ""}` });
      row.ship_status = "shipped";
      kq.giao++;

      await guiNhanDon(row, "máy vừa bấm giao");
    } catch (e: any) {
      kq.loi++;
      const msg = String(e?.message || e).slice(0, 300);
      await capNhat(row.order_id, { ship_status: "error", ship_note: msg, flags: { ...(row.flags || {}), ship_thu: soLan + 1 } });
      if (soLan + 1 >= 3) await guiNhomTts(`<b>GIAO TỰ ĐỘNG THẤT BẠI</b> đơn <code>${tgEscape(row.order_id)}</code> (3 lượt): ${tgEscape(msg)}\nGiao tay: ${linkDon(row.order_id)}`);
      console.error("[tts] ship lỗi", row.order_id, msg);
    }
  }
  return kq;
}

export async function guiNhanDonGiaoTay(): Promise<number> {
  const { data, error } = await getServiceClient().from("tts_orders").select("*")
    .in("status", ["AWAITING_COLLECTION", "IN_TRANSIT"]).is("label_sent_at", null)
    .gte("update_time", new Date(Date.now() - 3 * 86400e3).toISOString()).limit(20);
  if (error) throw new Error(`Quét đơn giao tay: ${error.message}`);
  let n = 0;
  for (const row of (data || []) as TtsOrderRow[]) {
    if (Number((row.flags || {}).nhan_thu || 0) >= 3) continue;
    if (await guiNhanDon(row, "đơn giao tay, máy gửi nhãn")) n++;
  }
  return n;
}
