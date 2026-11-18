import { getServiceClient } from "@/lib/supabase-server";
import { vnDateStr } from "@/lib/payroll";

export type Cost = {
  id: string;
  name: string;
  category: "AI" | "Hạ tầng" | "Quảng cáo" | "Vận hành" | "Khác";
  what: string;
  monthlyVnd: number | null;
  note?: string;
  auto?: boolean;
};

const KEY = "platform_costs";

const SEED: Cost[] = [
  { id: "anthropic", name: "Anthropic (Claude API)", category: "AI", what: "Chấm chất lượng chat sale, gợi ý bán, viết kịch bản video, phân loại email", monthlyVnd: null },
  { id: "gemini", name: "Google Gemini API", category: "AI", what: "Bộ não trợ lý Telegram, Nhà máy Content, Agent Research", monthlyVnd: null },
  { id: "google_ultra", name: "Google AI Ultra", category: "AI", what: "Dựng video Veo3 cho NOVA", monthlyVnd: null },
  { id: "openai", name: "OpenAI / ChatGPT", category: "AI", what: "Dùng chung", monthlyVnd: null },
  { id: "claude_code", name: "Claude Code", category: "AI", what: "Xây và vận hành toàn bộ hệ thống này", monthlyVnd: null },

  { id: "vercel", name: "Vercel", category: "Hạ tầng", what: "Chạy ikihealing-hub, NOVA app, MKT Studio, các sale page", monthlyVnd: null },
  { id: "supabase", name: "Supabase", category: "Hạ tầng", what: "Cơ sở dữ liệu + đăng nhập của ikihealing-hub", monthlyVnd: null },
  { id: "turso", name: "Turso", category: "Hạ tầng", what: "Cơ sở dữ liệu MKT Studio", monthlyVnd: null },
  { id: "domain", name: "Tên miền (example.vn, example.com)", category: "Hạ tầng", what: "Địa chỉ web", monthlyVnd: null },

  { id: "fb_ads", name: "Quảng cáo Facebook", category: "Quảng cáo", what: "Kéo lead về cho sale", monthlyVnd: null, auto: true, note: "Tự lấy từ Meta Ads" },

  { id: "misa", name: "MISA mShopKeeper", category: "Vận hành", what: "Bán hàng, kho, nguồn doanh thu gốc", monthlyVnd: null },
  { id: "salework", name: "Salework", category: "Vận hành", what: "Quản lý chat Zalo của sale", monthlyVnd: null },
  { id: "payos", name: "payOS", category: "Vận hành", what: "Nhận tiền QR trên sale page", monthlyVnd: null },
  { id: "resend", name: "Resend", category: "Vận hành", what: "Gửi email cho khách", monthlyVnd: null },
  { id: "zalo_zns", name: "Zalo ZNS", category: "Vận hành", what: "Nhắn tin khách ngoài cửa sổ 7 ngày (tính phí mỗi tin)", monthlyVnd: null, note: "Chưa dùng" },
];

const num = (v: any): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return isFinite(n) ? n : null;
};

export async function getCosts(): Promise<Cost[]> {
  const sb = getServiceClient();
  let saved: Cost[] = [];
  try {
    const v = (await sb.from("config").select("value").eq(  "key", KEY).maybeSingle()).data?.value;
    const j = v ? JSON.parse(v) : null;
    saved = Array.isArray(j) ? j : j?.items || [];
  } catch { }

  const byId = new Map(saved.map((c) => [c.id, c]));
  const out: Cost[] = SEED.map((s) => {
    const old = byId.get(s.id);
    return old ? { ...s, monthlyVnd: num(old.monthlyVnd), note: old.note ?? s.note } : s;
  });

  for (const c of saved) if (!SEED.some((s) => s.id === c.id)) out.push({ ...c, monthlyVnd: num(c.monthlyVnd) });

  try {
    const month = vnDateStr().slice(0, 7);
    const v = (await sb.from("config").select("value").eq("key", `mkt_spend_${month}`).maybeSingle()).data?.value;
    const spend = num(v);
    const i = out.findIndex((c) => c.id === "fb_ads");
    if (i >= 0 && spend !== null) out[i] = { ...out[i], monthlyVnd: spend, note: `Số thật tháng ${month}` };
  } catch { }

  return out;
}

export async function saveCosts(items: Cost[]): Promise<void> {
  const sb = getServiceClient();
  const clean = items.map((c) => ({ ...c, monthlyVnd: num(c.monthlyVnd) }));
  await sb.from("config").upsert(
    { key: KEY, value: JSON.stringify({ items: clean, updatedAt: new Date().toISOString() }) },
    { onConflict: "key" }
  );
}

export function summarize(items: Cost[]) {
  const known = items.filter((c) => c.monthlyVnd !== null);
  const unknown = items.filter((c) => c.monthlyVnd === null);
  const total = known.reduce((s, c) => s + (c.monthlyVnd || 0), 0);
  const byCat: Record<string, number> = {};
  for (const c of known) byCat[c.category] = (byCat[c.category] || 0) + (c.monthlyVnd || 0);
  return { total, known: known.length, unknown: unknown.length, unknownNames: unknown.map((c) => c.name), byCat };
}
