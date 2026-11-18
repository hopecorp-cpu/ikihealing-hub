import { TTS_VERSION } from "./config";
import { laLoiToken, ttsCall, type TtsCallOpts } from "./client";
import { lamMoiToken, layShopCipher, layTokenHopLe } from "./token-store";

export async function ttsRequest<T = any>(o: Omit<TtsCallOpts, "accessToken" | "shopCipher"> & { khongCanShop?: boolean }): Promise<T> {
  let row = await layTokenHopLe();
  const goi = async () => {
    const shop = o.khongCanShop ? null : await layShopCipher(row);
    return ttsCall<T>({ ...o, accessToken: row.access_token, shopCipher: shop?.cipher });
  };
  try {
    return await goi();
  } catch (e) {
    if (!laLoiToken(e)) throw e;
    row = await lamMoiToken(row);
    return goi();
  }
}

export type TtsLineItem = {
  id?: string; product_id?: string; product_name?: string; sku_id?: string; sku_name?: string;
  seller_sku?: string; sku_image?: string; sale_price?: string; original_price?: string; currency?: string;
  package_id?: string; display_status?: string; quantity?: number;
};
export type TtsAddress = {
  name?: string; phone_number?: string; full_address?: string; address_detail?: string; address_line1?: string;
  postal_code?: string; region_code?: string;
  district_info?: Array<{ address_level_name?: string; address_name?: string; address_level?: string }>;
};
export type TtsOrder = {
  id: string; status?: string; create_time?: number; update_time?: number; paid_time?: number;
  buyer_message?: string; user_id?: string; buyer_email?: string;
  recipient_address?: TtsAddress;
  line_items?: TtsLineItem[];
  payment?: { currency?: string; total_amount?: string; sub_total?: string; shipping_fee?: string; original_total_product_price?: string };
  packages?: Array<{ id: string }>;
  tracking_number?: string; shipping_provider?: string; shipping_provider_id?: string;
  is_on_hold_order?: boolean; cancel_reason?: string; cancellation_initiator?: string;
  fulfillment_type?: string; delivery_option_name?: string; is_sample_order?: boolean;
  has_updated_recipient_address?: boolean; is_replacement_order?: boolean;
  [k: string]: unknown;
};

export type SearchOrdersBody = {
  order_status?: string;
  create_time_ge?: number; create_time_lt?: number;
  update_time_ge?: number; update_time_lt?: number;
  shipping_type?: string; buyer_user_id?: string;
};

export async function searchOrders(body: SearchOrdersBody, o?: { pageSize?: number; pageToken?: string; sortField?: string; sortOrder?: "ASC" | "DESC" }) {
  return ttsRequest<{ orders?: Array<{ id: string; status?: string; update_time?: number; create_time?: number }>; next_page_token?: string; total_count?: number }>({
    method: "POST",
    path: `/order/${TTS_VERSION.orderSearch}/orders/search`,
    query: { page_size: o?.pageSize ?? 50, page_token: o?.pageToken || undefined, sort_field: o?.sortField || "update_time", sort_order: o?.sortOrder || "DESC" },
    body,
  });
}

export async function getOrderDetail(ids: string[]): Promise<TtsOrder[]> {
  const out: TtsOrder[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const d = await ttsRequest<{ orders?: TtsOrder[] }>({
      method: "GET",
      path: `/order/${TTS_VERSION.orderDetail}/orders`,
      query: { ids: ids.slice(i, i + 50).join(",") },
    });
    out.push(...(d?.orders || []));
  }
  return out;
}

export type HandoverSlot = { start_time: number; end_time: number; avaliable?: boolean; available?: boolean };
export type HandoverSlots = { can_pickup?: boolean; can_drop_off?: boolean; pickup_time_slots?: HandoverSlot[]; drop_off_time_slots?: HandoverSlot[] };

export async function getHandoverTimeSlots(packageId: string) {
  return ttsRequest<HandoverSlots>({ method: "GET", path: `/fulfillment/${TTS_VERSION.fulfillment}/packages/${encodeURIComponent(packageId)}/handover_time_slots` });
}

export async function shipPackage(packageId: string, body: { handover_method: "PICKUP" | "DROP_OFF"; pickup_slot?: { start_time: number; end_time: number } }) {
  return ttsRequest<Record<string, unknown>>({ method: "POST", path: `/fulfillment/${TTS_VERSION.fulfillment}/packages/${encodeURIComponent(packageId)}/ship`, body });
}

export async function getShippingDocument(packageId: string, o?: { documentType?: string; documentSize?: "A6" | "A5" }) {
  return ttsRequest<{ doc_url?: string; tracking_number?: string }>({
    method: "GET",
    path: `/fulfillment/${TTS_VERSION.fulfillment}/packages/${encodeURIComponent(packageId)}/shipping_documents`,
    query: { document_type: o?.documentType || "SHIPPING_LABEL", document_size: o?.documentSize || "A6" },
  });
}

export async function taiNhanPdf(docUrl: string): Promise<Buffer> {
  const res = await fetch(docUrl, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Tải nhãn thất bại HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error("Nhãn tải về rỗng");
  if (buf.length > 8 * 1024 * 1024) throw new Error(`Nhãn quá lớn (${buf.length} byte)`);
  return buf;
}

export type TtsConversation = { id: string; unread_count?: number; create_time?: number; latest_message?: { id?: string; type?: string; content?: string; create_time?: number; sender?: { role?: string } }; participants?: Array<{ role?: string; nickname?: string; im_user_id?: string }>; can_send_message?: boolean };
export type TtsMessage = { id: string; type?: string; content?: string; create_time?: number; is_visible?: boolean; sender?: { role?: string; im_user_id?: string; nickname?: string } };

export async function listConversations(o?: { pageSize?: number; pageToken?: string }) {
  return ttsRequest<{ conversations?: TtsConversation[]; next_page_token?: string }>({
    method: "GET", path: `/customer_service/${TTS_VERSION.customerService}/conversations`,
    query: { page_size: o?.pageSize ?? 20, page_token: o?.pageToken || undefined, locale: "vi-VN" },
  });
}

export async function getMessages(conversationId: string, o?: { pageSize?: number; pageToken?: string }) {
  return ttsRequest<{ messages?: TtsMessage[]; next_page_token?: string }>({
    method: "GET", path: `/customer_service/${TTS_VERSION.customerService}/conversations/${encodeURIComponent(conversationId)}/messages`,
    query: { page_size: o?.pageSize ?? 20, page_token: o?.pageToken || undefined, locale: "vi-VN" },
  });
}

export async function sendMessage(conversationId: string, text: string) {
  return ttsRequest<{ message_id?: string }>({
    method: "POST", path: `/customer_service/${TTS_VERSION.customerService}/conversations/${encodeURIComponent(conversationId)}/messages`,
    body: { type: "TEXT", content: JSON.stringify({ content: text }) },
  });
}

export function bocNoiDungTin(content?: string): string {
  if (!content) return "";
  try { const j = JSON.parse(content); return String(j?.content ?? j?.text ?? content); } catch { return content; }
}
