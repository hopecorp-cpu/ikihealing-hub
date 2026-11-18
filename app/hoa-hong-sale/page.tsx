import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { tuChoiBod } from "@/lib/auth-server";
import { isManagerOrAbove, isAccountantPosition } from "@/lib/auth";
import { vnDateStr } from "@/lib/payroll";
import { getT } from "@/lib/i18n-server";
import { loadOrderOverrides, effectiveSaleName } from "@/lib/order-attribution";
import { toGross } from "@/lib/money";
import { layDoanhThu, gopTenSale } from "@/lib/doanh-thu";
import HoaHongClient from "./HoaHongClient";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("KPI & Hoa hồng Sale | ACME Ops Hub") };
}

const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/\s+/g, " ").trim();

export default async function HoaHongSalePage({ searchParams }: { searchParams: { m?: string } }) {
  const { t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  tuChoiBod(user);
  if (!(isManagerOrAbove(user.role) || isAccountantPosition((user as any).position))) redirect("/?denied=hoahong");

  const sb = getServiceClient();
  const month = (searchParams.m || "").match(/^\d{4}-\d{2}$/) ? searchParams.m! : vnDateStr().slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const from = `${month}-01`;
  const to = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;

  const { data: users } = await sb.from("users").select("full_name, position, base_salary, contract_type, active, departments!users_department_id_fkey(name)").eq("active", true);
  const sales = (users || []).filter((u: any) => u.departments?.name === "Kinh Doanh & Sale");

  const ov = await loadOrderOverrides(sb);

  const denNgay = new Date(Date.parse(to) - 86400000).toISOString().slice(0, 10);
  const { rows: li, canhBao: canhBaoNguon, ngayNgo } = await layDoanhThu(sb, from, denNgay);
  const gopTen = gopTenSale((users || []).filter((u: any) => u.full_name).map((u: any) => ({ ten: u.full_name })));
  const gross: Record<string, number> = {};

  const stat: Record<string, { orders: Set<string>; reassignedIn: Set<string> }> = {};
  const excludedBy: Record<string, Set<string>> = {};
  for (const r of li) {
    if (ov.excluded.has(r.order_code)) {
      const k0 = norm(gopTen(r.sale_name || ""));
      if (k0) (excludedBy[k0] ??= new Set()).add(r.order_code);
      continue;
    }
    const k = norm(gopTen(effectiveSaleName(r.order_code, r.sale_name || "", ov))); if (!k) continue;
    gross[k] = (gross[k] || 0) + (r.net_amount || 0);
    const s = (stat[k] ??= { orders: new Set(), reassignedIn: new Set() });
    s.orders.add(r.order_code);
    if (ov.reassign[r.order_code] && norm(r.sale_name || "") !== k) s.reassignedIn.add(r.order_code);
  }

  const locked: Record<string, { amount: number; explanation: string }> = {};
  try {
    const { data: pr } = await sb.from("payroll").select("bonus_amount, auto_calc_data, users!payroll_user_id_fkey(full_name)").eq("month", month);
    for (const p of pr || []) {
      const k = norm((p as any).users?.full_name || ""); if (!k) continue;
      const acd = (p as any).auto_calc_data || {};
      if ((p.bonus_amount || 0) > 0 || acd.bonus_explanation) locked[k] = { amount: p.bonus_amount || 0, explanation: acd.bonus_explanation || "" };
    }
  } catch { }

  let ship: Record<string, number> = {};
  try { const { data } = await sb.from("config").select("value").eq("key", `sale_ship_${month}`).maybeSingle(); ship = JSON.parse(data?.value || "{}"); } catch { }

  const rows = sales.map((u: any) => {
    const k = norm(u.full_name);
    return {
      name: u.full_name,
      position: u.position || "",
      salary: u.base_salary || 0,
      contract: u.contract_type || "",
      kpi: /leader|team ?lead/i.test(u.position || "") ? 150_000_000 : 100_000_000,

      grossVAT: toGross(gross[k] || 0),
      dsNetVAT: Math.round(gross[k] || 0),
      ship: Math.round(ship[u.full_name] || 0),
      orderCount: stat[k]?.orders.size || 0,
      excludedCount: excludedBy[k]?.size || 0,
      reassignedIn: stat[k]?.reassignedIn.size || 0,
      locked: locked[k] || null,
    };
  }).sort((a: any, b: any) => b.dsNetVAT - a.dsNetVAT);

  const mNav = (delta: number) => { const d = new Date(y, m - 1 + delta, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{t("KPI & Hoa hồng Sale")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("Tháng")} {month} · {t("Doanh số net = doanh thu MISA đã tách VAT − phí ship (kế toán nhập). Hoa hồng theo bậc thang bên dưới.")}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <a href={`/hoa-hong-sale?m=${mNav(-1)}`} className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">◀ {mNav(-1)}</a>
          <span className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium">{month}</span>
          <a href={`/hoa-hong-sale?m=${mNav(1)}`} className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">{mNav(1)} ▶</a>
        </div>
      </div>
      <HoaHongClient rows={rows} month={month} />
    </div>
  );
}
