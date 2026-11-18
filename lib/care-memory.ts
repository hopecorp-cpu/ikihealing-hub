import { getServiceClient } from "@/lib/supabase-server";
import { layDonTheoSdt } from "@/lib/doanh-thu";
import { askGemini, geminiConfigured } from "@/lib/gemini";
import { sanitizeContent, findBanned } from "@/lib/banned-words";
import { COACH_PERSONA } from "@/lib/coach-persona";
import { normalizePhone } from "@/lib/zalo";
import { vnDateStr } from "@/lib/payroll";

export type CareEvent = {
  created_at: string; kind: string; channel: string | null; content: string | null;
  outcome: string | null; sale_name: string | null; day_index: number | null;
};

export type CustomerBrief = {
  phone: string;
  name: string | null;
  saleName: string | null;
  orders: number;
  totalSpent: number;
  lastOrderDate: string | null;
  daysSinceLastOrder: number | null;
  products: string[];
  events: CareEvent[];
  touches: number;
};

const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 864e5);

export async function getCareHistory(phone: string, limit = 12): Promise<CareEvent[]> {
  const sb = getServiceClient();
  const nph = normalizePhone(phone) || phone;
  try {
    const { data, error } = await sb.from("care_events")
      .select("created_at,kind,channel,content,outcome,sale_name,day_index")
      .eq("customer_phone", nph).order("created_at", { ascending: false }).limit(limit);
    if (error) return [];
    return (data || []) as CareEvent[];
  } catch { return []; }
}

export async function buildCustomerBrief(phone: string): Promise<CustomerBrief | null> {
  const sb = getServiceClient();
  const nph = normalizePhone(phone) || phone;

  const rows = await layDonTheoSdt(sb, nph, 200).catch(() => [] as any[]);
  const orderCodes = new Set(rows.map((r: any) => r.order_code));
  const totalSpent = rows.reduce((s: number, r: any) => s + (Number(r.net_amount) || 0), 0);
  const lastOrderDate = rows[0]?.order_date || null;
  const products = Array.from(new Set(rows.map((r: any) => r.product_name).filter(Boolean))).slice(0, 8) as string[];

  const events = await getCareHistory(nph);
  if (!rows.length && !events.length) return null;

  return {
    phone: nph,
    name: rows[0]?.customer_name || null,
    saleName: rows[0]?.sale_name || events[0]?.sale_name || null,
    orders: orderCodes.size,
    totalSpent,
    lastOrderDate,
    daysSinceLastOrder: lastOrderDate ? daysBetween(String(lastOrderDate).slice(0, 10), vnDateStr()) : null,
    products,
    events,
    touches: events.length,
  };
}

const vnd = (n: number) => Math.round(n).toLocaleString("vi") + "đ";

export function briefToText(b: CustomerBrief): string {
  const L: string[] = [];
  L.push(`Tên: ${b.name || "(chưa rõ)"} · SĐT ${b.phone}${b.saleName ? ` · sale phụ trách: ${b.saleName}` : ""}`);
  if (b.orders) {
    L.push(`Đã mua ${b.orders} đơn, tổng ${vnd(b.totalSpent)}. Đơn gần nhất ${String(b.lastOrderDate).slice(0, 10)} (${b.daysSinceLastOrder} ngày trước).`);
    L.push(`Sản phẩm từng mua: ${b.products.join(" · ")}`);
  } else {
    L.push(`CHƯA từng mua đơn nào.`);
  }
  if (b.events.length) {
    L.push(`\nLỊCH SỬ ${b.events.length} LẦN CHẠM GẦN NHẤT (mới nhất trước):`);
    for (const e of b.events) {
      const d = String(e.created_at).slice(0, 10);
      const what = e.content ? `"${e.content.replace(/\s+/g, " ").slice(0, 130)}"` : "(không ghi nội dung)";
      L.push(`- ${d} · ${e.kind}${e.channel ? `/${e.channel}` : ""}${e.outcome ? ` · kết quả: ${e.outcome}` : ""} · ${what}`);
    }
  } else {
    L.push(`\nCHƯA có lịch sử chạm nào được ghi.`);
  }
  return L.join("\n");
}

export async function draftCareMessage(phone: string, opts?: { intent?: string }): Promise<{ ok: boolean; text?: string; brief?: CustomerBrief; error?: string; flagged?: string[] }> {
  if (!geminiConfigured()) return { ok: false, error: "chưa có GEMINI_API_KEY_BRAIN" };
  const b = await buildCustomerBrief(phone);
  if (!b) return { ok: false, error: "Chưa có dữ liệu gì về khách này (không có đơn, không có lịch sử chạm)." };

  const system = `Bạn là người đồng hành chăm sóc khách của ACME Corp — viết tiếng Việt tự nhiên, ấm, như người thật nhắn Zalo. KHÔNG dùng emoji.

${COACH_PERSONA}

LUẬT THÊM KHI NHẮN CHĂM SÓC:
- KHÔNG "Mua ngay", KHÔNG "giảm giá sốc", KHÔNG hối thúc mua.
- Khuyến mãi (nếu có) là TẶNG QUÀ, không phải chiết khấu.
- Nếu lịch sử cho thấy khách từng nhắc tới bệnh lý: TUYỆT ĐỐI không bàn về bệnh đó. Chỉ hỏi thăm và
  đồng hành phần ăn uống/sinh hoạt, đúng tư cách huấn luyện viên.

HỒ SƠ KHÁCH:
${briefToText(b)}

CÁCH VIẾT:
- Xưng "em", gọi khách theo tên nếu biết (chị/anh + tên). Khách lớn tuổi thì "cô/chú".
- BÁM VÀO lịch sử ở trên: nhắc đúng thứ khách đã mua, đúng điều lần trước đã nói. TUYỆT ĐỐI KHÔNG bịa ra chuyện chưa từng xảy ra.
- Hỏi thăm thật lòng trước, đừng vào là bán. Nếu khách chưa tới kỳ cần mua lại thì đừng gợi mua.
- Ngắn: 3-5 câu, đọc trên điện thoại là hết.
- Nếu lịch sử quá mỏng, viết tin làm quen tự nhiên — đừng giả vờ thân quen.

CHỈ trả về nội dung tin nhắn. Không giải thích, không tiêu đề, không dấu ngoặc kép bao ngoài.`;

  const r = await askGemini(system, [], opts?.intent?.trim() || "Soạn tin chăm sóc phù hợp nhất cho khách này hôm nay.", { maxOutputTokens: 700, temperature: 0.85 });
  if (!r.ok) return { ok: false, error: (r as any).error || "AI lỗi", brief: b };

  const text = sanitizeContent(String(r.text).trim().replace(/^["'`]+|["'`]+$/g, ""));
  const flagged = findBanned(text);
  return { ok: true, text, brief: b, flagged };
}
