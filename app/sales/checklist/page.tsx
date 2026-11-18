import { redirect } from "next/navigation";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { isManagerOrAbove, isSalePosition } from "@/lib/auth";
import { vnDateStr } from "@/lib/payroll";
import { getConfigValue } from "@/lib/app-config";
import { CHECKLIST, computeAuto, loadWeekBase, roleOf, dayDocKey, type AutoVals } from "@/lib/sales-checklist";
import { getSaleSnapshot } from "@/lib/sale-metrics";
import { getT } from "@/lib/i18n-server";
import ChecklistClient from "./ChecklistClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checklist Sale | IKIHEALING Hub" };

export default async function ChecklistPage() {
  const { t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const manager = isManagerOrAbove(user.role);
  const isSale = isSalePosition((user as any).position);
  if (!manager && !isSale) redirect("/");

  const sb = getServiceClient();
  const today = vnDateStr();

  if (isSale) {
    const role = roleOf((user as any).position);
    const month = today.slice(0, 7);
    const dim = new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate();
    const [auto, weekBase, snap] = await Promise.all([
      computeAuto(sb, user.full_name || "", today, user.id) as Promise<AutoVals>,
      loadWeekBase(sb, user.id, today),
      getSaleSnapshot(user.full_name || "", month).catch(() => ({ me: null } as any)),
    ]);

    const overrides: Record<string, number> = {};
    const myTarget = (snap as any)?.me?.target || 0;
    if (myTarget > 0) overrides.revenue = Math.round(myTarget / dim / 1e5) * 1e5;
    let doc: any = {};
    try { doc = JSON.parse((await getConfigValue(dayDocKey(today, user.id))) || "{}"); } catch { }
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{t("Checklist Sale hằng ngày")}</h1>
          <p className="text-sm text-gray-500 mt-1">{today} · {t("Chấm theo TRỌNG SỐ — lõi doanh thu nặng nhất. Hoàn thành trước")} {CHECKLIST.deadline}. {t("Mục tự lấy từ hệ thống.")}</p>
        </div>
        <ChecklistClient role={role} initialValues={doc.values || {}} initialLinks={doc.links || {}} auto={auto} weekBase={weekBase} overrides={overrides} confirmedAt={doc.confirmedAt || null} today={today} />
      </div>
    );
  }

  const { data: rows } = await sb.from("config").select("key, value").ilike("key", `salecheck_${today}__%`);
  const docs = (rows || []).map(r => { try { return JSON.parse(r.value); } catch { return null; } }).filter(Boolean)
    .sort((a: any, b: any) => (a.pct - b.pct) || (b.done - a.done));

  const { data: saleUsers } = await sb.from("users").select("full_name, position, active").eq("active", true);
  const sales = (saleUsers || []).filter((u: any) => isSalePosition(u.position));
  const updatedNames = new Set(docs.map((d: any) => d.name));
  const notUpdated = sales.filter((u: any) => !updatedNames.has(u.full_name)).map((u: any) => u.full_name);
  const full = docs.filter((d: any) => d.pct >= 100).length;
  const incomplete = docs.filter((d: any) => d.pct < 100).length;
  const labelByKey: Record<string, string> = Object.fromEntries(CHECKLIST.sections.flatMap(s => s.items).map(it => [it.key, it.label]));

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">{t("Checklist Sale — Bảng tổng team")}</h1>
        <p className="text-sm text-gray-500 mt-1">{today} · {t("Sơn độ chấm theo trọng số (lõi doanh thu nặng nhất). Chốt trước")} {CHECKLIST.deadline}.</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-3 text-center"><div className="text-2xl font-bold text-emerald-600">{full}</div><div className="text-[11px] text-gray-500">{t("Đủ 100%")}</div></div>
        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-3 text-center"><div className="text-2xl font-bold text-amber-600">{incomplete}</div><div className="text-[11px] text-gray-500">{t("Còn thiếu tag")}</div></div>
        <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-3 text-center"><div className="text-2xl font-bold text-red-500">{notUpdated.length}</div><div className="text-[11px] text-gray-500">{t("Chưa cập nhật")}</div></div>
      </div>
      {notUpdated.length > 0 && <div className="text-[12px] text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{t("Chưa cập nhật checklist hôm nay")}: <b>{notUpdated.join(", ")}</b></div>}

      <div className="space-y-2">
        {docs.map((d: any, i: number) => (
          <div key={i} className={`bg-white border rounded-xl p-3 ${d.pct >= 100 ? "border-gray-200" : "border-amber-200"}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{d.name || "—"}{d.role === "page" ? <span className="ml-1 text-[10px] text-gray-400">({t("trực page")})</span> : ""}</span>
              <div className="flex items-center gap-2 ml-auto">
                <div className="w-20 sm:w-24 h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${d.pct}%`, background: d.pct >= 100 ? "#10B981" : d.pct >= 70 ? "#F59E0B" : "#EF4444" }} /></div>
                <span className="tabular-nums w-9 text-right font-semibold text-sm">{d.pct}%</span>
                <span className="text-[11px] text-gray-400 w-9 text-right">{d.done}/{d.total}</span>
                {d.confirmedAt ? <span className="text-emerald-600 text-[11px] whitespace-nowrap">✓{d.confirmedAt.slice(11, 16)}</span> : <span className="text-gray-300 text-[11px] whitespace-nowrap">{t("chưa chốt")}</span>}
              </div>
            </div>
            {Array.isArray(d.missing) && d.missing.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                <span className="text-[11px] text-red-500 font-medium">{t("Còn thiếu")}:</span>
                {d.missing.map((m: string, j: number) => <span key={j} className="text-[10px] bg-red-50 text-red-600 border border-red-100 rounded px-1.5 py-0.5">{m}</span>)}
              </div>
            )}
            {d.links && Object.keys(d.links).length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-2 items-center">
                <span className="text-[11px] text-blue-500 font-medium">{t("Bài đăng (bấm kiểm tra)")}:</span>
                {Object.entries(d.links as Record<string, string>).map(([k, url]) => url ? <a key={k} href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 underline">{labelByKey[k] || k} ↗</a> : null)}
              </div>
            )}
          </div>
        ))}
        {!docs.length && <div className="p-8 text-center text-gray-400 bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)]">{t("Chưa sale nào cập nhật checklist hôm nay.")}</div>}
      </div>
    </div>
  );
}
