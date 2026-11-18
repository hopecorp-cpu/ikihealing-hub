import crypto from "node:crypto";
import { getConfigValue, setConfigValue } from "@/lib/app-config";

const PAYOS_BASE = "https://api-merchant.payos.vn";
const ORDERS_KEY = "quiz_orders";

export function payosConfigured(): boolean {
  return !!(process.env.PAYOS_CLIENT_ID && process.env.PAYOS_API_KEY && process.env.PAYOS_CHECKSUM_KEY);
}

function hmac(data: string, key: string): string {
  return crypto.createHmac("sha256", key).update(data).digest("hex");
}

export function verifyWebhook(body: any): boolean {
  const key = process.env.PAYOS_CHECKSUM_KEY;
  if (!key || !body || !body.data || !body.signature) return false;
  const d = body.data;
  const str = Object.keys(d).sort().map((k) => {
    let v: any = d[k];
    if (v === null || v === undefined) v = "";
    if (typeof v === "object") v = JSON.stringify(v);
    return k + "=" + v;
  }).join("&");
  return hmac(str, key) === body.signature;
}

export type QuizOrder = {
  orderCode: number;
  name: string; phone: string; email?: string;
  pkg?: string; profile?: string;
  amount: number;
  vat?: any | null;
  status: "pending" | "paid" | "cod";
  createdAt: number;
  paidAt?: number;
  reference?: string;
  fulfilled?: boolean;

  address?: string;
  note?: string;
  source?: string;
  product?: string;
  qty?: number;
  maCtv?: string;

  xuLy?: XuLyDon;
  maVanDon?: string;
  ghiChuNoiBo?: string;
  xuLyLog?: { luc: number; ai: string; viec: string }[];
};

export type XuLyDon = "moi" | "da_xac_nhan" | "dang_giao" | "da_giao" | "huy";

async function readOrders(): Promise<Record<string, QuizOrder>> {
  const raw = await getConfigValue(ORDERS_KEY);
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}
async function writeOrders(map: Record<string, QuizOrder>) {

  const entries = Object.values(map).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 5000);
  const out: Record<string, QuizOrder> = {};
  for (const o of entries) out[String(o.orderCode)] = o;
  await setConfigValue(ORDERS_KEY, JSON.stringify(out), "Đơn thanh toán từ quiz (PayOS)");
}

export async function saveQuizOrder(o: QuizOrder) {
  const map = await readOrders();
  map[String(o.orderCode)] = o;
  await writeOrders(map);
}
export async function getQuizOrder(orderCode: string | number): Promise<QuizOrder | null> {
  const map = await readOrders();
  return map[String(orderCode)] || null;
}

export async function listQuizOrders(): Promise<QuizOrder[]> {
  const map = await readOrders();
  return Object.values(map).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function capNhatXuLyDon(orderCode: string | number, patch: { xuLy?: XuLyDon; maVanDon?: string; ghiChuNoiBo?: string }, ai: string) {
  const map = await readOrders();
  const o = map[String(orderCode)];
  if (!o) return null;
  const viec: string[] = [];
  if (patch.xuLy && patch.xuLy !== (o.xuLy || "moi")) { viec.push((o.xuLy || "moi") + " -> " + patch.xuLy); o.xuLy = patch.xuLy; }
  if (patch.maVanDon !== undefined && patch.maVanDon !== (o.maVanDon || "")) { viec.push("vận đơn " + (patch.maVanDon || "(xoá)")); o.maVanDon = patch.maVanDon || undefined; }
  if (patch.ghiChuNoiBo !== undefined && patch.ghiChuNoiBo !== (o.ghiChuNoiBo || "")) { viec.push("sửa ghi chú"); o.ghiChuNoiBo = patch.ghiChuNoiBo || undefined; }
  if (!viec.length) return o;
  o.xuLyLog = [...(o.xuLyLog || []), { luc: Date.now(), ai, viec: viec.join(", ") }].slice(-50);
  await writeOrders(map);
  return o;
}
export async function markQuizOrderPaid(orderCode: string | number, paidAt?: number, reference?: string) {
  const map = await readOrders();
  const o = map[String(orderCode)];
  if (!o) return null;
  o.status = "paid"; o.paidAt = paidAt || Date.now(); if (reference) o.reference = reference;
  await writeOrders(map);
  return o;
}

export async function claimQuizFulfillment(orderCode: string | number): Promise<boolean> {
  const map = await readOrders();
  const o = map[String(orderCode)];
  if (!o || o.fulfilled) return false;
  o.fulfilled = true;
  await writeOrders(map);
  return true;
}

export async function createPayosPayment(args: {
  orderCode: number; amount: number; description: string;
  returnUrl: string; cancelUrl: string; buyerName?: string; buyerPhone?: string;
}): Promise<any> {
  const clientId = process.env.PAYOS_CLIENT_ID!;
  const apiKey = process.env.PAYOS_API_KEY!;
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY!;

  const sigData =
    "amount=" + args.amount +
    "&cancelUrl=" + args.cancelUrl +
    "&description=" + args.description +
    "&orderCode=" + args.orderCode +
    "&returnUrl=" + args.returnUrl;
  const signature = hmac(sigData, checksumKey);

  const payload = {
    orderCode: args.orderCode, amount: args.amount, description: args.description,
    cancelUrl: args.cancelUrl, returnUrl: args.returnUrl, signature,
    buyerName: args.buyerName || "", buyerPhone: args.buyerPhone || "",
  };

  const r = await fetch(PAYOS_BASE + "/v2/payment-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-client-id": clientId, "x-api-key": apiKey },
    body: JSON.stringify(payload),
  });
  const out = await r.json();
  if (out.code !== "00" || !out.data) throw new Error(out.desc || "payOS error " + out.code);
  return out.data;
}

export async function getPayosStatus(orderCode: string | number): Promise<string> {
  const clientId = process.env.PAYOS_CLIENT_ID, apiKey = process.env.PAYOS_API_KEY;
  if (!clientId || !apiKey) return "UNKNOWN";
  try {
    const r = await fetch(PAYOS_BASE + "/v2/payment-requests/" + encodeURIComponent(String(orderCode)), {
      headers: { "x-client-id": clientId, "x-api-key": apiKey },
    });
    const out = await r.json();
    return (out && out.data && out.data.status) ? out.data.status : "UNKNOWN";
  } catch { return "UNKNOWN"; }
}
