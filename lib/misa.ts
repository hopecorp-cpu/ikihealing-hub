export type MisaOrder = {
  id: string;
  order_no: string;
  order_date: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  channel?: string;
  status: string;
  total_amount: number;
  discount_amount: number;
  shipping_amount: number;
  final_amount: number;
  items: MisaOrderItem[];
};

export type MisaOrderItem = {
  product_id: string;
  product_name: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

export type MisaProduct = {
  id: string;
  sku: string;
  name: string;
  category?: string;
  price: number;
  cost?: number;
};

export type MisaCustomer = {
  id: string;
  full_name: string;
  phone?: string;
  email?: string;
};

const MISA_BASE = "https://api.misa.vn/eshop/v2";

export class MisaClient {
  private appId: string;
  private appSecret: string;
  private shopId: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.appId = process.env.MISA_APP_ID || "";
    this.appSecret = process.env.MISA_APP_SECRET || "";
    this.shopId = process.env.MISA_SHOP_ID || "";
  }

  isConfigured(): boolean {
    return !!(this.appId && this.appSecret && this.shopId);
  }

  private async getToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) return this.accessToken;

    const res = await fetch(`${MISA_BASE}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: this.appId, app_secret: this.appSecret, shop_id: this.shopId })
    });
    if (!res.ok) throw new Error(`MISA auth failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + 50 * 60 * 1000;
    return this.accessToken!;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getToken();
    const res = await fetch(`${MISA_BASE}${path}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
        "X-Shop-Id": this.shopId,
        "Content-Type": "application/json"
      }
    });
    if (!res.ok) throw new Error(`MISA ${path} failed: ${res.status} ${await res.text()}`);
    return res.json();
  }

  async getOrders(fromDate: string, toDate: string, page: number = 1, limit: number = 100): Promise<{ data: MisaOrder[]; total: number }> {
    const data = await this.request<any>(`/orders?from_date=${fromDate}&to_date=${toDate}&page=${page}&limit=${limit}`);
    return { data: data.items || [], total: data.total || 0 };
  }

  async getAllOrders(fromDate: string, toDate: string): Promise<MisaOrder[]> {
    const all: MisaOrder[] = [];
    let page = 1;
    const limit = 100;
    while (true) {
      const { data, total } = await this.getOrders(fromDate, toDate, page, limit);
      all.push(...data);
      if (all.length >= total || data.length < limit) break;
      page++;
      if (page > 100) break;
    }
    return all;
  }

  async getProducts(): Promise<MisaProduct[]> {
    const data = await this.request<any>(`/products?limit=1000`);
    return data.items || [];
  }

  async getCustomers(): Promise<MisaCustomer[]> {
    const data = await this.request<any>(`/customers?limit=1000`);
    return data.items || [];
  }
}

export function mapMisaToAcmeOrder(m: MisaOrder): any {
  const status = mapMisaStatus(m.status);
  return {
    order_code: `MISA-${m.order_no}`,
    misa_id: m.id,
    source_platform: "misa",
    channel: m.channel || "misa_eshop",
    channel_code: "misa_eshop",
    gross_revenue: m.total_amount,
    discount_value: m.discount_amount || 0,
    shipping_cost: m.shipping_amount || 0,
    quantity: m.items.reduce((s, it) => s + it.quantity, 0),
    status,
    order_date: m.order_date.slice(0, 10),
    notes: `Sync từ MISA — ${m.customer_name || ""} ${m.customer_phone || ""}`
  };
}

function mapMisaStatus(s: string): string {
  const lower = s.toLowerCase();
  if (/pending|new|chờ/i.test(s)) return "pending";
  if (/confirm|xác nhận/i.test(s)) return "confirmed";
  if (/shipping|đang giao/i.test(s)) return "shipping";
  if (/delivered|hoàn thành|complete/i.test(s)) return "delivered";
  if (/cancel|huỷ/i.test(s)) return "cancelled";
  if (/refund|hoàn tiền/i.test(s)) return "refunded";
  return "pending";
}
