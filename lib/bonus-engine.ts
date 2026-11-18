import { LAW_2026, calcSaleCommissionNet, calcSaleGroupBonusNet, calcManagerBonusNet, saleKpiTarget, SALE_KPI_TARGET_NET, SALE_GROUP_TARGET_NET } from "./payroll";

export type BonusRule = {
  id: string;
  name: string;
  scope: "individual" | "team_lead" | "group";
  product_category: string | null;
  revenue_min: number;
  revenue_max: number | null;
  bonus_rate: number;
  fixed_bonus: number;
  applies_to_contract: string[];
  contract_modifier: Record<string, number>;
  trigger_condition: string | null;
  priority: number;
  active: boolean;
};

export type RevenueBreakdown = {
  channel: string;
  gross_revenue: number;
  net_revenue: number;
  order_count: number;
  attributable_to_sale: boolean;
};

export type UserBonusCalc = {
  user_id: string;
  full_name: string;
  position: string;
  contract_type: string;
  is_sale: boolean;
  total_revenue_net: number;
  product_revenue_net: number;
  course_revenue_net: number;
  product_commission: number;
  course_commission: number;
  revenue_breakdown: RevenueBreakdown[];
  applied_rule: BonusRule | null;
  applied_rate: number;
  contract_modifier: number;
  individual_bonus: number;
  group_bonus_share: number;
  auto_total_bonus: number;
  bonus_explanation: string;
};

export function aggregateRevenue(
  rawRevenue: { user_id: string; channel: string; gross_revenue: number; net_revenue: number; order_count: number }[],
  manualAttributions: { user_id: string; revenue_amount: number; attribution_type: string; source_platform: string }[],
  channels: { code: string; attributable_to_sale: boolean; vat_rate: number }[]
): Map<string, RevenueBreakdown[]> {
  const result = new Map<string, RevenueBreakdown[]>();
  const channelLookup = new Map(channels.map(c => [c.code, c]));

  for (const r of rawRevenue) {
    const ch = channelLookup.get(r.channel) || { code: r.channel, attributable_to_sale: true, vat_rate: 0.08 };
    if (!result.has(r.user_id)) result.set(r.user_id, []);
    result.get(r.user_id)!.push({
      channel: ch.code,
      gross_revenue: r.gross_revenue,
      net_revenue: r.net_revenue,
      order_count: r.order_count,
      attributable_to_sale: ch.attributable_to_sale
    });
  }

  for (const m of manualAttributions) {
    if (!result.has(m.user_id)) result.set(m.user_id, []);
    result.get(m.user_id)!.push({
      channel: `manual_${m.source_platform || m.attribution_type}`,
      gross_revenue: m.revenue_amount,
      net_revenue: m.revenue_amount,
      order_count: 0,
      attributable_to_sale: true
    });
  }

  return result;
}

export function findApplicableRule(
  userRevenue: number,
  contractType: string,
  rules: BonusRule[]
): BonusRule | null {
  const candidates = rules
    .filter(r => r.scope === "individual" && r.active)
    .filter(r => !r.applies_to_contract?.length || r.applies_to_contract.includes(contractType))
    .filter(r => userRevenue >= r.revenue_min && (r.revenue_max === null || userRevenue < r.revenue_max))
    .sort((a, b) => b.priority - a.priority);
  return candidates[0] || null;
}

export function calcUserBonus(input: {
  user_id: string;
  full_name: string;
  position: string;
  contract_type: string;
  revenueBreakdown: RevenueBreakdown[];
  rules: BonusRule[];
  teamTotalRevenue: number;
  isSale: boolean;
}): UserBonusCalc {
  const attributable = input.revenueBreakdown.filter(r => r.attributable_to_sale);
  const attributableRevenue = attributable.reduce((s, r) => s + r.net_revenue, 0);

  const isCourse = (ch: string) => /course|khoa|khoá/i.test(ch || "");
  const courseRevenueNet = attributable.filter(r => isCourse(r.channel)).reduce((s, r) => s + r.net_revenue, 0);
  const productRevenueNet = attributableRevenue - courseRevenueNet;

  const kpiTarget = saleKpiTarget(input.position);
  const rule = findApplicableRule(attributableRevenue, input.contract_type, input.rules);
  const modifier = 1.0;
  const individualBonus = input.isSale ? calcSaleCommissionNet(attributableRevenue, kpiTarget) : 0;
  const kpiPct = kpiTarget > 0 ? attributableRevenue / kpiTarget * 100 : 0;
  const apptRate = attributableRevenue > 0 ? individualBonus / attributableRevenue : 0;

  const courseCommission = attributableRevenue > 0 ? Math.round(individualBonus * courseRevenueNet / attributableRevenue) : 0;
  const productCommission = individualBonus - courseCommission;

  const groupShare = 0;
  const total = individualBonus;

  let explanation = "";
  if (!input.isSale) {
    explanation = "Không phải Sale → không tính hoa hồng";
  } else if (individualBonus === 0) {
    explanation = `DS net ${fmt(attributableRevenue)} (${kpiPct.toFixed(0)}% KPI) < 50% → chưa xét hoa hồng`;
  } else {
    explanation = `DS net ${fmt(attributableRevenue)} = ${kpiPct.toFixed(0)}% KPI → HH ${fmt(individualBonus)} (≈${(apptRate * 100).toFixed(1)}%)`;
    if (courseRevenueNet > 0) explanation += ` [SP ${fmt(productCommission)} + Khoá ${fmt(courseCommission)}]`;
    if (groupShare > 0) explanation += ` + Thưởng nhóm ${fmt(groupShare)}`;
  }

  return {
    user_id: input.user_id,
    full_name: input.full_name,
    position: input.position,
    contract_type: input.contract_type,
    is_sale: input.isSale,
    total_revenue_net: attributableRevenue,
    product_revenue_net: productRevenueNet,
    course_revenue_net: courseRevenueNet,
    product_commission: productCommission,
    course_commission: courseCommission,
    revenue_breakdown: input.revenueBreakdown,
    applied_rule: rule,
    applied_rate: apptRate,
    contract_modifier: modifier,
    individual_bonus: individualBonus,
    group_bonus_share: groupShare,
    auto_total_bonus: total,
    bonus_explanation: explanation
  };
}

export function runMonthlyCalc(input: {
  users: { id: string; full_name: string; position: string; contract_type: string; is_sale: boolean; manager_id?: string | null }[];
  revenueMap: Map<string, RevenueBreakdown[]>;
  rules: BonusRule[];
}): { calcs: UserBonusCalc[]; teamTotalRevenue: number; teamBonusTriggered: boolean } {

  const dsMap = new Map<string, number>();
  let teamTotalRevenue = 0;
  for (const u of input.users) {
    const ds = (input.revenueMap.get(u.id) || []).filter(r => r.attributable_to_sale).reduce((s, r) => s + r.net_revenue, 0);
    dsMap.set(u.id, ds);
    if (u.is_sale) teamTotalRevenue += ds;
  }

  const triggered = teamTotalRevenue > SALE_GROUP_TARGET_NET;

  const calcs = input.users.map(u =>
    calcUserBonus({
      user_id: u.id, full_name: u.full_name, position: u.position,
      contract_type: u.contract_type, revenueBreakdown: input.revenueMap.get(u.id) || [],
      rules: input.rules, teamTotalRevenue, isSale: u.is_sale
    })
  );

  const leaders = input.users.filter(u => u.is_sale && /leader|team ?lead/i.test(u.position || ""));
  const teamPool = calcSaleGroupBonusNet(teamTotalRevenue);
  const perLeaderTeam = leaders.length ? Math.round(teamPool / leaders.length) : 0;
  for (const c of calcs) {
    const isLeader = leaders.some(l => l.id === c.user_id);
    if (!isLeader) continue;

    const subDs = input.users.filter(s => s.manager_id === c.user_id).reduce((s, x) => s + (dsMap.get(x.id) || 0), 0);
    const mgmtBonus = calcManagerBonusNet(subDs);
    const groupShare = perLeaderTeam + mgmtBonus;
    if (groupShare > 0) {
      c.group_bonus_share = groupShare;
      c.auto_total_bonus += groupShare;
      const parts: string[] = [];
      if (mgmtBonus > 0) parts.push(`QL nhóm 1%×${fmt(subDs)} = ${fmt(mgmtBonus)}`);
      if (perLeaderTeam > 0) parts.push(`Đội nhóm (vượt 500M) ${fmt(perLeaderTeam)}`);
      c.bonus_explanation += ` + Thưởng nhóm: ${parts.join(" + ")}`;
    }
  }

  return { calcs, teamTotalRevenue, teamBonusTriggered: triggered };
}

function fmt(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}
