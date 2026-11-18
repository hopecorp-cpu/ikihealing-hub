export type ParsedOrder = {
  order_code: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  product_sku?: string;
  product_name?: string;
  quantity: number;
  unit_price: number;
  gross_revenue: number;
  discount_value: number;
  shipping_cost: number;
  final_revenue: number;
  channel: string;
  sub_channel?: string;
  status: string;
  order_date: string;
  raw_line: number;
  errors: string[];
};

export type ParseResult = {
  format: string;
  totalLines: number;
  parsed: ParsedOrder[];
  invalidLines: { line: number; raw: string; reason: string }[];
  headers: string[];
};

function detectFormat(headers: string[]): string {
  const h = headers.map(x => x.toLowerCase()).join("|");
  if (/mã đơn hàng pancake|đơn hàng pancake|page.+pancake/i.test(h)) return "pancake";
  if (/mã đơn hàng shopee|shopee\s*order/i.test(h)) return "shopee";
  if (/tiktok|tt\s*shop/i.test(h)) return "tiktok";
  if (/misa|eshop|so_chung_tu/i.test(h)) return "misa";
  if (/mã đơn hàng|order.code|order.no/i.test(h)) return "pancake_vn";
  return "generic";
}

function parseLine(line: string, delim: string): string[] {
  const result: string[] = [];
  let cur = "", inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
    else if (c === '"') { inQuote = !inQuote; }
    else if (c === delim && !inQuote) { result.push(cur); cur = ""; }
    else cur += c;
  }
  result.push(cur);
  return result.map(s => s.trim());
}

function parseAmount(s: string | undefined): number {
  if (!s) return 0;
  const clean = String(s).replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(/,/g, ".");
  const v = parseFloat(clean);
  return isNaN(v) ? 0 : v;
}

function parseInt2(s: string | undefined): number {
  if (!s) return 0;
  const clean = String(s).replace(/[^\d-]/g, "");
  return parseInt(clean) || 0;
}

function parseDate(s: string | undefined): string {
  if (!s) return new Date().toISOString().slice(0, 10);
  const trimmed = s.trim();

  const ddmm = trimmed.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
  if (ddmm) {
    const y = ddmm[3].length === 2 ? `20${ddmm[3]}` : ddmm[3];
    return `${y}-${ddmm[2].padStart(2,"0")}-${ddmm[1].padStart(2,"0")}`;
  }

  const yymm = trimmed.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})/);
  if (yymm) return `${yymm[1]}-${yymm[2].padStart(2,"0")}-${yymm[3].padStart(2,"0")}`;
  return new Date().toISOString().slice(0, 10);
}

function mapStatus(s: string | undefined): string {
  if (!s) return "pending";
  const lower = s.toLowerCase();
  if (/đã giao|hoàn thành|delivered|complete|thành công|success/i.test(s)) return "delivered";
  if (/đang giao|shipping|in transit/i.test(s)) return "shipping";
  if (/xác nhận|confirm/i.test(s)) return "confirmed";
  if (/huỷ|cancel|hủy/i.test(s)) return "cancelled";
  if (/hoàn tiền|refund|trả hàng|return/i.test(s)) return "refunded";
  return "pending";
}

function findIdx(headers: string[], ...keys: string[]): number {
  const lower = headers.map(h => h.toLowerCase());
  for (const k of keys) {
    const idx = lower.findIndex(h => h.includes(k.toLowerCase()));
    if (idx >= 0) return idx;
  }
  return -1;
}

export function parseOrdersCsv(text: string, forceFormat?: string): ParseResult {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) {
    return { format: "unknown", totalLines: 0, parsed: [], invalidLines: [], headers: [] };
  }

  const headerLine = lines[0];
  const delim = headerLine.includes("\t") ? "\t" : headerLine.includes(";") ? ";" : ",";
  const headers = parseLine(headerLine, delim).map(h => h.replace(/^["']|["']$/g, ""));
  const format = forceFormat || detectFormat(headers);

  const idxOrderCode = findIdx(headers, "mã đơn hàng", "order_code", "order code", "order no", "so_chung_tu", "đơn hàng", "ma_don");
  const idxCustomerName = findIdx(headers, "tên khách hàng", "customer name", "khách hàng", "ten_kh", "tên người mua", "buyer");
  const idxCustomerPhone = findIdx(headers, "số điện thoại", "phone", "sdt", "đt", "phone number");
  const idxCustomerAddress = findIdx(headers, "địa chỉ", "address", "shipping address", "dia chi");
  const idxProductSku = findIdx(headers, "mã sản phẩm", "sku", "ma_sp", "product code");
  const idxProductName = findIdx(headers, "tên sản phẩm", "product name", "ten_sp", "mặt hàng", "product");
  const idxQty = findIdx(headers, "số lượng", "quantity", "qty", "so_luong");
  const idxUnitPrice = findIdx(headers, "đơn giá", "unit price", "gia_ban", "price", "giá");
  const idxGross = findIdx(headers, "tổng tiền", "total", "thanh tien", "thành tiền", "doanh thu gốc", "doanh số", "gross");
  const idxDiscount = findIdx(headers, "chiết khấu", "giảm giá", "discount", "khuyen mai", "khuyến mãi");
  const idxShipping = findIdx(headers, "phí vận chuyển", "shipping", "phi ship", "ship cost");
  const idxFinal = findIdx(headers, "tổng thanh toán", "final amount", "final revenue", "tổng tiền cuối", "total payment", "khách trả");
  const idxChannel = findIdx(headers, "kênh", "channel", "nguồn", "source");
  const idxSubChannel = findIdx(headers, "kênh con", "sub channel", "sub_channel", "phương thức thanh toán", "payment method");
  const idxStatus = findIdx(headers, "trạng thái", "status", "tinh trang", "tình trạng");
  const idxDate = findIdx(headers, "ngày tạo", "order date", "ngay", "thời gian đặt", "created at", "ngày đặt");

  const parsed: ParsedOrder[] = [];
  const invalidLines: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i], delim);
    if (cols.length < 2 || cols.every(c => !c)) continue;

    const errors: string[] = [];
    const get = (idx: number) => idx >= 0 && cols[idx] ? cols[idx] : "";

    const orderCode = get(idxOrderCode) || `IMPORT-${Date.now()}-${i}`;
    const qty = parseInt2(get(idxQty)) || 1;
    const unitPrice = parseAmount(get(idxUnitPrice));
    const gross = parseAmount(get(idxGross)) || (qty * unitPrice);
    const discount = parseAmount(get(idxDiscount));
    const shipping = parseAmount(get(idxShipping));
    const final = parseAmount(get(idxFinal)) || (gross - discount);

    if (gross <= 0 && final <= 0) errors.push("Không có doanh thu");
    if (!get(idxOrderCode)) errors.push("Thiếu mã đơn — auto gen");

    parsed.push({
      order_code: orderCode,
      customer_name: get(idxCustomerName) || undefined,
      customer_phone: get(idxCustomerPhone) || undefined,
      customer_address: get(idxCustomerAddress) || undefined,
      product_sku: get(idxProductSku) || undefined,
      product_name: get(idxProductName) || undefined,
      quantity: qty,
      unit_price: unitPrice || (qty > 0 ? gross / qty : 0),
      gross_revenue: gross,
      discount_value: discount,
      shipping_cost: shipping,
      final_revenue: final,
      channel: get(idxChannel) || (format === "pancake" ? "Pancake" : format === "shopee" ? "Shopee" : format === "tiktok" ? "TikTok Shop" : format === "misa" ? "MISA" : "Manual"),
      sub_channel: get(idxSubChannel) || undefined,
      status: mapStatus(get(idxStatus)),
      order_date: parseDate(get(idxDate)),
      raw_line: i + 1,
      errors: errors.filter(e => !e.includes("auto gen"))
    });
  }

  return { format, totalLines: lines.length - 1, parsed, invalidLines, headers };
}
