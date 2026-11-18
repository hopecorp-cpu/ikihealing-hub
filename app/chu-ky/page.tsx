import { redirect } from "next/navigation";

import { getCurrentUser, getServerClient, getServiceClient } from "@/lib/supabase-server";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function ChuKyPage() {
  const { t } = getT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin" && user.role !== "ceo") redirect("/");
  const sb = getServiceClient();
  const { data: cycles } = await sb.from("cycles").select("*").order("start_date", { ascending: false });
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t("Chu kỳ KPI")}</h1>
        <button className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium">{t("+ Tạo chu kỳ")}</button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr><th className="text-left p-3">{t("Tên")}</th><th className="text-left p-3">{t("Loại")}</th><th className="text-left p-3">{t("Bắt đầu")}</th><th className="text-left p-3">{t("Kết thúc")}</th><th className="text-left p-3">{t("Trạng thái")}</th></tr>
          </thead>
          <tbody>
            {(cycles ?? []).map(c => (
              <tr key={c.id} className="border-t border-gray-100">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3">{c.type}</td>
                <td className="p-3">{c.start_date}</td>
                <td className="p-3">{c.end_date}</td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs ${c.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{c.status === "active" ? t("Đang chạy") : c.status}</span></td>
              </tr>
            ))}
            {(!cycles || cycles.length === 0) && <tr><td colSpan={5} className="p-8 text-center text-gray-400">{t("Chưa có chu kỳ")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
