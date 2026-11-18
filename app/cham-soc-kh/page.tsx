import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { vnDateStr } from "@/lib/payroll";
import { isManagerOrAbove, isSalePosition } from "@/lib/auth";
import CareClient from "./CareClient";
import seedingPlan from "@/data/seeding-plan.json";
import { getT } from "@/lib/i18n-server";
import { layDoanhThuNhieuThang, gopTenSaleTuSo } from "@/lib/doanh-thu";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Chăm sóc khách | IKIHEALING Hub") };
}

const norm = (s: string) => (s || "").toLowerCase().trim().replace(/\s+/g, " ");

export default async function ChamSocPage() {
  const { t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const manager = user.role === "admin" || user.role === "ceo" || isManagerOrAbove(user.role);
  const isSale = isSalePosition((user as any).position);
  if (!manager && !isSale) redirect("/");

  const sb = getServiceClient();

  const since = (() => { const d = new Date(); d.setDate(d.getDate() - 120); return d.toISOString().slice(0, 10); })();
  const [{ rows }, gopTen] = await Promise.all([
    layDoanhThuNhieuThang(sb, since, vnDateStr()),
    gopTenSaleTuSo(sb),
  ]);

  const myName = norm(user.full_name || "");
  const mineOnly = isSale && !manager;
  const custMap: Record<string, any> = {};
  for (const r of rows) {
    const ph = (r.customer_phone || "").trim(); if (!ph) continue;
    const saleDay = gopTen(r.sale_name);
    if (mineOnly && norm(saleDay) !== myName) continue;
    const c = (custMap[ph] ??= { phone: ph, name: r.customer_name || ph, sale: saleDay || "", lastDate: "", lastProduct: "", spent: 0, orders: new Set() });
    if ((r.order_date || "") > c.lastDate) { c.lastDate = r.order_date || ""; c.lastProduct = r.product_name || ""; if (r.customer_name) c.name = r.customer_name; }
    c.spent += r.net_amount || 0;
  }
  const phones = Object.keys(custMap);

  const careByPhone: Record<string, any> = {};
  for (let i = 0; i < phones.length; i += 300) {
    const { data } = await sb.from("customer_care_log").select("*").in("customer_phone", phones.slice(i, i + 300));
    for (const c of data || []) careByPhone[c.customer_phone] = c;
  }

  const today = vnDateStr();
  const daysBetween = (d: string) => d ? Math.floor((new Date(today).getTime() - new Date(d).getTime()) / 86400000) : 9999;
  const customers = Object.values(custMap).map((c: any) => {
    const log = careByPhone[c.phone] || null;
    const stopped = log?.status === "stopped";
    const due = stopped ? false : (log?.next_due ? log.next_due <= today : true);
    const daysSince = daysBetween(c.lastDate);

    const reorder = stopped ? false : (daysSince >= 25 && daysSince <= 90);
    return {
      phone: c.phone, name: c.name, sale: c.sale, lastDate: c.lastDate, lastProduct: c.lastProduct, spent: Math.round(c.spent),
      daysSince, reorder, stopped,
      flow_type: log?.flow_type || "bought", current_day: log?.current_day ?? null,
      last_contact: log?.last_contact || null, next_due: log?.next_due || null, status: log?.status || "new", note: log?.note || "",
      due: log?.status === "done" ? false : due,
    };
  }).sort((a, b) => (Number(b.due) - Number(a.due)) || (Number(b.reorder) - Number(a.reorder)) || (b.lastDate < a.lastDate ? -1 : 1));

  const dueCount = customers.filter(c => c.due).length;
  const reorderCount = customers.filter(c => c.reorder).length;
  const caredCount = customers.filter(c => c.last_contact === today).length;

  let fbq: any = null;
  try { fbq = JSON.parse((await sb.from("config").select("value").eq("key", "fb_unreplied").maybeSingle()).data?.value || "null"); } catch { }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">{t("Chăm sóc khách")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {mineOnly ? t("Khách của bạn") : t("Toàn bộ khách")} ({t("120 ngày")}). <b className="text-red-600">{dueCount} {t("khách cần chăm hôm nay")}</b> · <b className="text-orange-600">{reorderCount} {t("khách nên nhắc tái mua")}</b> · <b className="text-emerald-600">{caredCount} {t("đã chăm hôm nay")}</b> ({t("mua ≥25 ngày, sắp hết hộp")}).
        </p>
      </div>
      {fbq && fbq.total > 0 && (
        <details className="rounded-xl border-2 border-blue-300 bg-blue-50 overflow-hidden" open>
          <summary className="cursor-pointer select-none px-4 py-2.5 bg-blue-600 text-white font-bold text-sm flex items-center gap-2">
            {t("Facebook cần trả lời (hàng chung)")}: {fbq.total} — {fbq.inbox} {t("tin nhắn")} + {fbq.comment} {t("bình luận")}
            {fbq.oldestHours >= 24 && <span className="font-normal text-blue-100">· {t("cũ nhất")} {Math.round(fbq.oldestHours / 24)} {t("ngày")}</span>}
          </summary>
          <div className="p-3 space-y-2">
            <p className="text-[12px] text-blue-700">{t("Khách FB nhắn/bình luận mà chưa ai trả lời. Ai rảnh nhận xử lý — bấm để mở Pancake.")} {fbq.generatedAt ? `(${t("cập nhật")} ${new Date(fbq.generatedAt).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })})` : ""}</p>
            {(fbq.byPage || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {fbq.byPage.map((p: any, i: number) => (
                  <span key={i} className="text-[11px] bg-white border border-blue-200 rounded-full px-2 py-0.5 text-blue-800">{p.name}: {p.inbox + p.comment}</span>
                ))}
              </div>
            )}
            <div className="space-y-1 max-h-[420px] overflow-auto">
              {(fbq.items || []).map((it: any, i: number) => (
                <a key={i} href={it.link} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-white border border-blue-100 rounded-lg px-2.5 py-1.5 text-sm hover:bg-blue-100">
                  <span className="text-[10px] shrink-0 px-1.5 py-0.5 rounded-full border font-medium" style={{ background: it.type === "comment" ? "#FEF3C7" : "#DBEAFE", borderColor: it.type === "comment" ? "#FCD34D" : "#93C5FD", color: it.type === "comment" ? "#92400E" : "#1E40AF" }}>{it.type === "comment" ? t("cmt") : t("tin")}</span>
                  <span className="font-medium text-gray-800 shrink-0 max-w-[120px] truncate">{it.name}</span>
                  <span className="text-gray-500 flex-1 truncate">{it.snippet}</span>
                  {it.phone && <span className="text-[10px] text-emerald-600 shrink-0"></span>}
                  <span className="text-[11px] text-gray-400 shrink-0">{it.hours >= 24 ? `${Math.round(it.hours / 24)}d` : `${Math.round(it.hours)}h`}</span>
                  <span className="text-[11px] text-blue-500 shrink-0">{t("mở")} ↗</span>
                </a>
              ))}
            </div>
            <p className="text-[11px] text-blue-400">{t("Theo dõi qua Pancake — chỉ những page đã kết nối Pancake. Cập nhật 5 lần/ngày.")}</p>
          </div>
        </details>
      )}

      <CareClient customers={customers} canSeeSale={!mineOnly} defaultSale={mineOnly ? (user.full_name || "") : ""} meName={user.full_name || ""} today={today} flows={(seedingPlan as any).careFlows || { bought: [], notBought: [] }} />
    </div>
  );
}
