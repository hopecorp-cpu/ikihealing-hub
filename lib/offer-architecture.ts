import { getServiceClient } from "@/lib/supabase-server";
import { getConfigValue, setConfigValue } from "@/lib/app-config";

export type OfferKind = "combo" | "the" | "membership" | "prepay" | "autoship" | "flash" | "flow";

export type Offer = {
  code: string;
  ten: string;
  loai: OfferKind;
  ruot: { sku: string; qty: number }[];
  gia_niem_yet: number;
  qua_tang: string[];
  dieu_kien?: string;
  kenh?: string;
  status: "draft" | "chot";
  ghi_chu?: string;
  updatedAt?: string;
};

export const OFFER_KEY = "offer_architecture";

export const DEFAULT_OFFERS: Offer[] = [
  {
    code: "S1-COMBO-MAU", ten: "S1 — Combo mẫu", loai: "combo",
    ruot: [{ sku: "SP-A-001", qty: 1 }, { sku: "SP-B-001", qty: 1 }],
    gia_niem_yet: 500_000,
    qua_tang: ["Quà tặng mẫu A"],
    kenh: "Facebook, Zalo, Website", status: "draft",
    ghi_chu: "Ghi chú mẫu",
  },
  {
    code: "THE-THANH-VIEN", ten: "Thẻ thành viên (mẫu)", loai: "the",
    ruot: [], gia_niem_yet: 0,
    qua_tang: ["Quyền lợi mẫu A", "Quyền lợi mẫu B"],
    dieu_kien: "Điều kiện mẫu. KHÔNG bán riêng.",
    status: "draft",
    ghi_chu: "Ghi chú mẫu",
  },
  {
    code: "FLASH-NGAY-DOI", ten: "Khung Flash ngày đôi (mẫu)", loai: "flash",
    ruot: [], gia_niem_yet: 0,
    qua_tang: ["Quà giới hạn số suất (mẫu)", "Đếm ngược 24 giờ"],
    dieu_kien: "CHỈ chạy đúng ngày đôi mỗi tháng. Không giảm giá — chỉ quà giới hạn số lượng + thời gian.",
    status: "draft",
    ghi_chu: "Ghi chú mẫu",
  },
];

export async function getOffers(): Promise<{ offers: Offer[]; fromConfig: boolean }> {
  try {
    const raw = await getConfigValue(OFFER_KEY);
    if (raw) {
      const j = JSON.parse(raw);
      const offers: Offer[] = Array.isArray(j) ? j : j.offers || [];
      if (offers.length) return { offers, fromConfig: true };
    }
  } catch { }
  return { offers: DEFAULT_OFFERS, fromConfig: false };
}

export async function saveOffers(offers: Offer[], by?: string): Promise<void> {
  const stamped = offers.map(o => ({ ...o, updatedAt: new Date().toISOString() }));
  await setConfigValue(OFFER_KEY, JSON.stringify({ offers: stamped, updatedBy: by || "" }), "Kết cấu bán hàng (combo/thẻ/quà)");
}

export type OfferEconomics = {
  code: string;
  tongGiaLe: number;
  chenhLech: number;
  bienGopPct: number | null;
  thieuSku: string[];
};

export async function computeOfferEconomics(offers: Offer[]): Promise<Record<string, OfferEconomics>> {
  const sb = getServiceClient();
  const { data } = await sb.from("products").select("sku,unit_price,cost_price");
  const bySku: Record<string, { price: number; cost: number }> = {};
  for (const p of data || []) if (p.sku) bySku[String(p.sku).trim().toUpperCase()] = { price: Number(p.unit_price) || 0, cost: Number(p.cost_price) || 0 };

  const out: Record<string, OfferEconomics> = {};
  for (const o of offers) {
    let tongLe = 0, tongCost = 0, coCost = true;
    const thieu: string[] = [];
    for (const r of o.ruot || []) {
      const p = bySku[String(r.sku).trim().toUpperCase()];
      if (!p) { thieu.push(r.sku); coCost = false; continue; }
      tongLe += p.price * r.qty;
      if (p.cost > 0) tongCost += p.cost * r.qty; else coCost = false;
    }
    const gia = o.gia_niem_yet || 0;
    const bien = o.ruot?.length && coCost && gia > 0 ? Math.round(((gia - tongCost) / gia) * 100) : null;
    out[o.code] = { code: o.code, tongGiaLe: tongLe, chenhLech: tongLe - gia, bienGopPct: bien, thieuSku: thieu };
  }
  return out;
}

const fmtM = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n || 0)) + "đ";

export async function buildOfferBlock(): Promise<string> {
  try {
    const { offers, fromConfig } = await getOffers();
    if (!offers.length) return "";
    const eco = await computeOfferEconomics(offers);
    const lines = offers.map(o => {
      const e = eco[o.code];
      const gia = o.gia_niem_yet > 0 ? fmtM(o.gia_niem_yet) : "(tặng kèm/khung)";
      const bien = e?.bienGopPct != null ? ` · biên gộp ~${e.bienGopPct}%` : "";
      const qua = o.qua_tang?.length ? ` · quà: ${o.qua_tang.join(", ")}` : "";
      const dk = o.dieu_kien ? ` · điều kiện: ${o.dieu_kien}` : "";
      const st = o.status === "chot" ? "" : " [DRAFT - CHỜ CEO DUYỆT]";
      return `- ${o.code} "${o.ten}": ${gia}${bien}${qua}${dk}${st}`;
    });
    const note = fromConfig ? "" : "\n(Toàn bộ đang là BẢN ĐỀ XUẤT của Trợ lý AI, chưa lưu chính thức — nhắc CEO vào /ket-cau-ban-hang duyệt.)";
    return `===== KẾT CẤU BÁN HÀNG (combo/thẻ/quà — trả lời khi hỏi "bán gì/combo nào/tặng gì") =====
Luật cứng: khuyến mãi = TẶNG QUÀ, tuyệt đối không giảm giá %; một giá niêm yết mọi kênh.
${lines.join("\n")}${note}`;
  } catch { return ""; }
}
