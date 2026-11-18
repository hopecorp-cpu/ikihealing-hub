export type Funnel = "TOFU" | "MOFU" | "BOFU";
export type Pillar = { name: string; funnel: Funnel };
export type ContentPlan = { funnelRatio: Record<Funnel, number>; pillars: Pillar[]; updatedAt?: string; updatedBy?: string };

export const CONTENT_PLAN_KEY = "content_pillars";
export const FUNNELS: Funnel[] = ["TOFU", "MOFU", "BOFU"];
export const FUNNEL_LABEL: Record<Funnel, string> = {
  TOFU: "TOFU · Thu hút", MOFU: "MOFU · Nuôi dưỡng", BOFU: "BOFU · Chốt bán",
};
export const FUNNEL_GOAL: Record<Funnel, string> = {
  TOFU: "thu hút người lạ — chạm nỗi đau lối sống + cho kiến thức hữu ích, KHÔNG bán",
  MOFU: "nuôi dưỡng niềm tin — kể chuyện, hậu trường, cảm nhận khách (bằng chứng nhẹ nhàng)",
  BOFU: "chốt — giới thiệu giải pháp/sản phẩm + ưu đãi TẶNG QUÀ (KHÔNG chiết khấu %)",
};

export const DEFAULT_PLAN: ContentPlan = {
  funnelRatio: { TOFU: 45, MOFU: 30, BOFU: 25 },
  pillars: [

    { name: "Kiến thức dưỡng sinh Đông y", funnel: "TOFU" },
    { name: "Thói quen nhỏ mỗi ngày", funnel: "TOFU" },
    { name: "Hiểu cơ thể theo Minh Triết Phương Đông", funnel: "TOFU" },
    { name: "Ăn lành - Sống nhẹ", funnel: "TOFU" },
    { name: "Giải toả nỗi mệt mỏi lối sống hiện đại", funnel: "TOFU" },

    { name: "App NOVA cá nhân hoá theo thể tạng", funnel: "TOFU" },

    { name: "Câu chuyện & cảm nhận khách hàng", funnel: "MOFU" },
    { name: "Hậu trường & niềm tin thương hiệu", funnel: "MOFU" },
    { name: "Hành trình thay đổi lối sống", funnel: "MOFU" },

    { name: "Tri thức nền & nguồn cảm hứng", funnel: "MOFU" },
    { name: "Sinh hoạt cộng đồng NOVA", funnel: "MOFU" },
    { name: "Học Viện NOVA — 3 Ngày Reset 0đ", funnel: "MOFU" },

    { name: "Giải pháp sản phẩm NOVA", funnel: "BOFU" },
    { name: "Combo tiết kiệm & quà tặng", funnel: "BOFU" },
    { name: "Ưu đãi có hạn (tặng quà)", funnel: "BOFU" },
    { name: "Vì sao chọn ACME / NOVA", funnel: "BOFU" },
  ],
};

export type Slot = { pillar: string; funnel: Funnel; funnelLabel: string; goal: string };

export function buildSlotsForFunnel(plan: ContentPlan, n: number, funnel: Funnel, seed = 0): Slot[] {
  const list = plan.pillars.filter((p) => p.funnel === funnel).map((p) => p.name);
  const pool = list.length ? list : [FUNNEL_LABEL[funnel]];
  const slots: Slot[] = [];
  for (let k = 0; k < n; k++) {
    slots.push({ pillar: pool[(seed + k) % pool.length], funnel, funnelLabel: FUNNEL_LABEL[funnel], goal: FUNNEL_GOAL[funnel] });
  }
  return slots;
}

export function buildSlots(plan: ContentPlan, n: number, seed = 0): Slot[] {
  const total = FUNNELS.reduce((s, f) => s + (plan.funnelRatio[f] || 0), 0) || 1;
  const counts = FUNNELS.map((f) => Math.round(n * (plan.funnelRatio[f] || 0) / total));
  let sum = counts.reduce((a, b) => a + b, 0);
  while (sum < n) { counts[0]++; sum++; }
  while (sum > n) { const i = counts.findIndex((c) => c > 0); counts[i]--; sum--; }

  const byFunnel: Record<Funnel, string[]> = { TOFU: [], MOFU: [], BOFU: [] };
  for (const p of plan.pillars) byFunnel[p.funnel].push(p.name);
  const cursor: Record<Funnel, number> = { TOFU: seed, MOFU: seed, BOFU: seed };

  const slots: Slot[] = [];
  FUNNELS.forEach((f, i) => {
    for (let k = 0; k < counts[i]; k++) {
      const list = byFunnel[f].length ? byFunnel[f] : [FUNNEL_LABEL[f]];
      const pillar = list[cursor[f] % list.length]; cursor[f]++;
      slots.push({ pillar, funnel: f, funnelLabel: FUNNEL_LABEL[f], goal: FUNNEL_GOAL[f] });
    }
  });
  return slots;
}
