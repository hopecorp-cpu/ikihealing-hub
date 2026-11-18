import { getConfigValue, setConfigValue } from "@/lib/app-config";
import { findBanned } from "@/lib/banned-words";

const KEY = "flash_deal";

export type FlashDeal = {
  enabled: boolean;
  title: string;
  gift: string;
  note: string;
  endsAt: string;
  slots: number;
  claimed: number;
  ctaUrl: string;
};

export const EMPTY_DEAL: FlashDeal = {
  enabled: false,
  title: "Tuần lễ quà tặng NOVA",
  gift: "Tặng bình lắc ACME + cẩm nang thực đơn 21 ngày",
  note: "Quà gửi kèm đơn hàng. Không áp dụng cùng chương trình quà khác.",
  endsAt: "",
  slots: 50,
  claimed: 0,
  ctaUrl: "https://example.com/shop",
};

const CAM_GIAM_GIA = /gi[aả]m\s*gi[aá]|chi[eế]t\s*kh[aấ]u|sale\s*off|gi[aả]m\s*\d+\s*%|\d+\s*%\s*off|x[aả]\s*kho|ph[aá]\s*gi[aá]/i;

export async function getFlashDeal(): Promise<FlashDeal> {
  try {
    const raw = await getConfigValue(KEY);
    if (!raw) return EMPTY_DEAL;
    const j = JSON.parse(raw);
    return {
      enabled: !!j.enabled,
      title: String(j.title || EMPTY_DEAL.title),
      gift: String(j.gift || EMPTY_DEAL.gift),
      note: String(j.note || ""),
      endsAt: String(j.endsAt || ""),
      slots: Number(j.slots) >= 0 ? Number(j.slots) : 0,
      claimed: Number(j.claimed) >= 0 ? Number(j.claimed) : 0,
      ctaUrl: String(j.ctaUrl || EMPTY_DEAL.ctaUrl),
    };
  } catch {
    return EMPTY_DEAL;
  }
}

export async function saveFlashDeal(d: FlashDeal): Promise<void> {
  const all = `${d.title} ${d.gift} ${d.note}`;
  if (CAM_GIAM_GIA.test(all)) {
    throw new Error(
      "Ưu đãi có chữ giảm giá / chiết khấu / xả kho. Luật ACME: khuyến mãi = TẶNG QUÀ, không hạ giá niêm yết " +
      "(hạ giá là phá thang giá đại lý và dạy khách chờ đợt sau). Viết lại phần quà tặng.",
    );
  }
  const bad = findBanned(all);
  if (bad.length) throw new Error(`Ưu đãi dính từ cấm (${bad.join(", ")}) — luật thực phẩm bổ sung.`);
  if (d.enabled && !d.endsAt) throw new Error("Bật ưu đãi thì phải có thời hạn kết thúc — đồng hồ không có đích là đồng hồ giả.");
  if (d.enabled && new Date(d.endsAt).getTime() <= Date.now()) throw new Error("Thời hạn kết thúc đã ở quá khứ.");
  await setConfigValue(KEY, JSON.stringify(d), "Ưu đãi quà tặng có hạn trên example.com");
}

export type PublicDeal = {
  active: boolean;
  title: string;
  gift: string;
  note: string;
  endsAt: string;
  remaining: number | null;
  ctaUrl: string;
  serverNow: string;
};

export function toPublic(d: FlashDeal): PublicDeal {
  const ends = d.endsAt ? new Date(d.endsAt).getTime() : 0;
  const remaining = d.slots > 0 ? Math.max(0, d.slots - d.claimed) : null;
  const active = d.enabled && ends > Date.now() && (remaining === null || remaining > 0);
  return {
    active,
    title: d.title,
    gift: d.gift,
    note: d.note,
    endsAt: d.endsAt,
    remaining,
    ctaUrl: d.ctaUrl,
    serverNow: new Date().toISOString(),
  };
}

export async function claimSlot(): Promise<{ ok: boolean; remaining: number | null }> {
  const d = await getFlashDeal();
  const pub = toPublic(d);
  if (!pub.active) return { ok: false, remaining: pub.remaining };
  if (d.slots > 0) {
    d.claimed = Math.min(d.slots, d.claimed + 1);
    await setConfigValue(KEY, JSON.stringify(d), "Ưu đãi quà tặng có hạn trên example.com");
    return { ok: true, remaining: Math.max(0, d.slots - d.claimed) };
  }
  return { ok: true, remaining: null };
}
