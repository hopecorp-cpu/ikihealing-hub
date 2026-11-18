import { getServiceClient } from "@/lib/supabase-server";
import { TTS_WEBHOOK_TYPE } from "./config";
import { dongBoDon, linkDon } from "./order-flow";
import { xuLyTinKhach } from "./cs";
import { guiNhomTts, tgEscape } from "./telegram";

export type TtsEventRow = {
  id: number; tts_notification_id: string; type: string; type_code: number | null; shop_id: string | null;
  payload: any; status: "pending" | "done" | "error"; attempts: number; error: string | null;
  received_at: string; processed_at: string | null;
};

export type WebhookPayload = { type?: number | string; tts_notification_id?: string; shop_id?: string; timestamp?: number; data?: any };

export function tenSuKien(p: WebhookPayload): string {
  if (typeof p.type === "string" && p.type && !/^\d+$/.test(p.type)) return p.type.toUpperCase();
  const n = Number(p.type);
  if (TTS_WEBHOOK_TYPE[n]) return TTS_WEBHOOK_TYPE[n];

  const d = p.data || {};
  if (d.cancel_status) return "CANCELLATION_STATUS_CHANGE";
  if (d.return_status) return "RETURN_STATUS_CHANGE";
  if (d.order_status && d.order_id) return "ORDER_STATUS_CHANGE";
  if (Array.isArray(d.package_list) || (d.package_id && d.order_id)) return "PACKAGE_UPDATE";
  if (d.message_id) return "NEW_MESSAGE";
  if (d.conversation_id) return "NEW_CONVERSATION";
  if (d.product_id) return "PRODUCT_STATUS_CHANGE";
  return `UNKNOWN_${Number.isFinite(n) ? n : "?"}`;
}

export function laSuKienQuyen(ten: string, p: WebhookPayload): "thu_hoi" | "sap_het_han" | null {
  if (ten !== "SELLER_DEAUTHORIZATION" && ten !== "UPCOMING_AUTHORIZATION_EXPIRATION") return null;
  const d = p.data || {};
  if (d.product_id || d.order_id || d.package_list || d.conversation_id || d.message_id) return null;
  return ten === "SELLER_DEAUTHORIZATION" ? "thu_hoi" : "sap_het_han";
}

export function donTuSuKien(d: any): string[] {
  const ids: string[] = [];
  if (d?.order_id) ids.push(String(d.order_id));
  for (const o of d?.orders || d?.order_ids || []) ids.push(String(typeof o === "string" || typeof o === "number" ? o : o?.order_id || o?.id || ""));
  for (const pk of Array.isArray(d?.package_list) ? d.package_list : []) for (const o of pk?.order_id_list || []) ids.push(String(o));
  return [...new Set(ids.filter(Boolean))];
}

export function nhanHuy(status: string): string | null {
  const s = String(status || "").toUpperCase();
  if (/PENDING/.test(s)) return "KHÁCH XIN HUỶ — cần duyệt";
  if (/SUCCESS/.test(s)) return "ĐƠN ĐÃ HUỶ";
  if (/CANCELLED$/.test(s)) return "Khách rút yêu cầu huỷ — đơn giao tiếp";
  return null;
}

export function nhanTraHang(status: string): string | null {
  const s = String(status || "").toUpperCase();
  if (/REQUEST_PENDING/.test(s)) return "KHÁCH XIN TRẢ HÀNG/HOÀN TIỀN — cần xử lý";
  return null;
}

export async function ghiSuKien(p: WebhookPayload, rawBody: string): Promise<{ moi: boolean; id?: number }> {
  const sb = getServiceClient();
  const nid = String(p.tts_notification_id || "").trim() || `no-id:${Buffer.from(rawBody).toString("base64").slice(0, 60)}:${p.timestamp || Date.now()}`;
  const row = {
    tts_notification_id: nid,
    type: tenSuKien(p),
    type_code: Number.isFinite(Number(p.type)) ? Number(p.type) : null,
    shop_id: p.shop_id ? String(p.shop_id) : null,
    payload: p,
    status: "pending",
    attempts: 0,
    received_at: new Date().toISOString(),
  };
  const { data, error } = await sb.from("tts_events").insert(row).select("id").maybeSingle();
  if (error) {
    if (/duplicate|unique|23505/i.test(error.message || "")) return { moi: false };
    throw new Error(`Ghi tts_events: ${error.message}`);
  }
  return { moi: true, id: data?.id };
}

async function xuLyMot(ev: TtsEventRow): Promise<string> {
  const d = ev.payload?.data || {};
  switch (ev.type) {
    case "ORDER_STATUS_CHANGE":
    case "PACKAGE_UPDATE":
    case "RECIPIENT_ADDRESS_UPDATE":
    case "REVERSE_STATUS_UPDATE": {

      const rows = await dongBoDon(donTuSuKien(d), ev.shop_id);
      return `đồng bộ ${rows.length} đơn`;
    }
    case "CANCELLATION_STATUS_CHANGE": {
      const id = String(d.order_id || "");
      if (id) await dongBoDon([id], ev.shop_id);
      const st = String(d.cancel_status || d.cancellation_status || "?");
      const nhan = nhanHuy(st);
      if (nhan) {
        await guiNhomTts(`<b>${tgEscape(nhan)}</b> · đơn <code>${tgEscape(id)}</code> · ${tgEscape(st)} · bên khởi tạo ${tgEscape(String(d.cancellations_role || d.cancel_user || d.role || "?"))}\nMở đơn: ${linkDon(id)}`);
      }
      return `huỷ ${st}${nhan ? " (đã báo)" : ""}`;
    }
    case "RETURN_STATUS_CHANGE": {
      const id = String(d.order_id || "");
      if (id) await dongBoDon([id], ev.shop_id);
      const st = String(d.return_status || "?");
      const nhan = nhanTraHang(st);
      if (nhan) {
        await guiNhomTts(`<b>${tgEscape(nhan)}</b> · đơn <code>${tgEscape(id)}</code> · loại ${tgEscape(String(d.return_type || "?"))} · ${tgEscape(st)}\nXử lý trên Seller Center: ${linkDon(id)}`);
      }
      return `trả hàng ${st}${nhan ? " (đã báo)" : ""}`;
    }
    case "NEW_MESSAGE":
      return xuLyTinKhach(d, ev);
    case "NEW_CONVERSATION":
      return "bỏ qua (nhân viên CS vào/rời hội thoại — tin khách đi qua NEW_MESSAGE)";
    case "PRODUCT_STATUS_CHANGE":
      return `bỏ qua (sản phẩm ${String(d.product_id || "?")} → ${String(d.status || "?")})`;
    case "SELLER_DEAUTHORIZATION":
    case "UPCOMING_AUTHORIZATION_EXPIRATION":
      return "đã báo ở webhook";
    default:
      return `bỏ qua ${ev.type}`;
  }
}

export async function xuLySuKienCho(gioiHan = 40): Promise<{ xet: number; xong: number; loi: number }> {
  const sb = getServiceClient();
  const { data, error } = await sb.from("tts_events").select("*").eq("status", "pending").lt("attempts", 5).order("received_at", { ascending: true }).limit(gioiHan);
  if (error) throw new Error(`Đọc tts_events: ${error.message}`);
  const kq = { xet: 0, xong: 0, loi: 0 };
  for (const ev of (data || []) as TtsEventRow[]) {
    kq.xet++;
    await sb.from("tts_events").update({ attempts: ev.attempts + 1 }).eq("id", ev.id);
    try {
      const note = await xuLyMot(ev);
      await sb.from("tts_events").update({ status: "done", processed_at: new Date().toISOString(), error: note.slice(0, 300) }).eq("id", ev.id);
      kq.xong++;
    } catch (e: any) {
      kq.loi++;
      const msg = String(e?.message || e).slice(0, 500);
      await sb.from("tts_events").update({ status: ev.attempts + 1 >= 5 ? "error" : "pending", error: msg, processed_at: new Date().toISOString() }).eq("id", ev.id);
      console.error("[tts] sự kiện lỗi", ev.id, ev.type, msg);
    }
  }
  return kq;
}
