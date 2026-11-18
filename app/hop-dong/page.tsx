import { redirect } from "next/navigation";
import { FINANCE_WHITELIST, isAdmin } from "@/lib/auth";
import { getCurrentUser, getServiceClient } from "@/lib/supabase-server";
import { tuChoiBod } from "@/lib/auth-server";
import { getT } from "@/lib/i18n-server";
import { getConfigValue } from "@/lib/app-config";
import { vnDateStr } from "@/lib/payroll";
import { AlertTriangle } from "lucide-react";
import HopDongClient from "./HopDongClient";

export const dynamic = "force-dynamic";
export function generateMetadata() {
  const { t } = getT();
  return { title: t("Hồ sơ & Hợp đồng NV | IKIHEALING Hub") };
}

const WHITELIST = FINANCE_WHITELIST;
const DRIVE_FOLDER = "https://drive.google.com/drive/folders/1tvhtBN0-XlFfMqfQ1js2__EXsDSwMZaw";

export default async function HopDongPage() {
  const { t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  tuChoiBod(user);
  const email = (user.email || "").toLowerCase().trim();
  if (!(isAdmin(user.role) || WHITELIST.includes(email))) redirect("/?denied=hopdong");

  const sb = getServiceClient();
  const { data: users } = await sb.from("users").select("id, full_name, position, contract_type, hire_date, cccd, dob, address, terminated_at").order("active", { ascending: false }).order("full_name");
  let links: Record<string, string> = {};
  try { links = JSON.parse((await getConfigValue("contract_links")) || "{}"); } catch { }

  const rows = (users ?? []).map((u: any) => ({
    id: u.id, name: u.full_name, position: u.position || "", type: u.contract_type || "", hire: u.hire_date || "",
    cccd: u.cccd || "", address: u.address || "", contractUrl: links[u.id] || "", terminated: !!u.terminated_at,
    missing: [!u.cccd && "CCCD", !links[u.id] && "HĐ"].filter(Boolean),
  }));
  const noCccd = rows.filter(r => !r.cccd && !r.terminated).length;
  const noContract = rows.filter(r => !r.contractUrl && !r.terminated).length;

  const today = vnDateStr();
  const nameOf = new Map((users ?? []).map((u: any) => [u.id, u.full_name]));
  const { data: contracts } = await sb.from("employment_contracts")
    .select("user_id, contract_number, end_date, probation_end_date, status, terminated_at")
    .is("terminated_at", null);
  const daysTo = (d?: string | null) => d ? Math.round((new Date(d + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000) : null;
  type Alert = { name: string; kind: string; date: string; days: number; code?: string };
  const alerts: Alert[] = [];
  (contracts ?? []).forEach((c: any) => {
    const nm = nameOf.get(c.user_id) || "—";
    const de = daysTo(c.end_date);
    if (de != null && de <= 45) alerts.push({ name: nm, kind: "HĐLĐ hết hạn", date: c.end_date, days: de, code: c.contract_number });
    const dp = daysTo(c.probation_end_date);
    if (dp != null && dp <= 14 && dp >= -30) alerts.push({ name: nm, kind: "Hết thử việc", date: c.probation_end_date, days: dp, code: c.contract_number });
  });
  alerts.sort((a, b) => a.days - b.days);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{t("Hồ sơ & Hợp đồng nhân viên")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("Tối thiểu lưu:")} <b>{t("CCCD")}</b> + <b>{t("link hợp đồng (Drive)")}</b>. {t("Thiếu CCCD:")} <b className="text-red-600">{noCccd}</b> · {t("thiếu HĐ:")} <b className="text-red-600">{noContract}</b>.</p>
        </div>
        <a href={DRIVE_FOLDER} target="_blank" rel="noreferrer" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">{t("Mở thư mục HĐ trên Drive ↗")}</a>
      </div>
      {alerts.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-100 bg-amber-50 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h2 className="font-semibold text-sm text-amber-800">{t("Cảnh báo hết hạn hợp đồng / thử việc")} ({alerts.length})</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {alerts.map((a, i) => (
              <div key={i} className="px-4 py-2.5 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-gray-900 flex-1 min-w-[140px]">{a.name}</span>
                <span className="text-gray-500">{a.kind}{a.code ? ` · ${a.code}` : ""}</span>
                <span className="text-gray-400 text-xs">{a.date}</span>
                <span className={`text-xs px-2 py-0.5 rounded border font-medium ${a.days < 0 ? "bg-red-100 text-red-700 border-red-200" : a.days <= 14 ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-blue-100 text-blue-700 border-blue-200"}`}>
                  {a.days < 0 ? `${t("Quá hạn")} ${-a.days} ${t("ngày")}` : `${t("Còn")} ${a.days} ${t("ngày")}`}
                </span>
              </div>
            ))}
          </div>
          <p className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">{t("HĐ xác định thời hạn chỉ được ký tối đa 2 lần — sau đó phải chuyển HĐ không xác định thời hạn.")}</p>
        </div>
      )}
      <HopDongClient rows={rows} />
      <p className="text-xs text-gray-400">{t("Hợp đồng lưu trên Drive công ty — dán link Doc/PDF vào đây để truy cập nhanh. CCCD lưu trong hệ thống (bảng users, đã bật RLS bảo mật).")}</p>
    </div>
  );
}
