import { requireAdmin } from "@/lib/auth-server";
import { getT } from "@/lib/i18n-server";
import { getServiceClient } from "@/lib/supabase-server";
import { Database, AlertCircle, FileSpreadsheet } from "lucide-react";
import { MisaSyncClient } from "./client";

export const dynamic = "force-dynamic";

export default async function MisaPage() {
  await requireAdmin();
  const { t } = getT();
  const sb = getServiceClient();
  const [{ data: logs }, { data: sales }] = await Promise.all([
    sb.from("misa_sync_log").select("*").order("created_at", { ascending: false }).limit(20),
    sb.from("users").select("id, full_name, position").eq("active", true).ilike("position", "%sale%")
  ]);

  const hasMisaCreds = !!(process.env.MISA_APP_ID && process.env.MISA_APP_SECRET && process.env.MISA_SHOP_ID);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database className="w-6 h-6 text-orange-600" /> {t("Sync MISA eShop")}
        </h1>
        <a href="/admin/orders/import" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold inline-flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4" /> {t("Import CSV (Pancake/Shopee/MISA)")}
        </a>
      </div>

      {!hasMisaCreds ? (
        <NoCredsBlock />
      ) : (
        <MisaSyncClient sales={sales ?? []} />
      )}

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
        <h3 className="font-semibold mb-3">{t("Lịch sử sync")}</h3>
        {(!logs || logs.length === 0) ? (
          <div className="text-center py-8 text-gray-400 text-sm">{t("Chưa có lần sync nào")}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="text-left p-2">{t("Thời gian")}</th>
                <th className="text-left p-2">{t("Loại")}</th>
                <th className="text-right p-2">{t("Mới")}</th>
                <th className="text-right p-2">{t("Update")}</th>
                <th className="text-left p-2">{t("Status")}</th>
                <th className="text-left p-2">{t("Note")}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l: any) => (
                <tr key={l.id} className="border-t border-gray-100">
                  <td className="p-2 text-xs">{new Date(l.created_at).toLocaleString("vi-VN")}</td>
                  <td className="p-2 text-xs">{l.sync_type}</td>
                  <td className="p-2 text-right text-xs font-semibold text-green-700">{l.records_new ?? 0}</td>
                  <td className="p-2 text-right text-xs text-blue-700">{l.records_updated ?? 0}</td>
                  <td className="p-2 text-xs">
                    <span className={`px-2 py-0.5 rounded ${
                      l.status === "success" ? "bg-green-100 text-green-700" :
                      l.status === "running" ? "bg-blue-100 text-blue-700" :
                      l.status === "partial" ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    }`}>{l.status}</span>
                  </td>
                  <td className="p-2 text-xs text-gray-500 max-w-[300px] truncate">{l.error_message || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function NoCredsBlock() {
  const { t } = getT();
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold text-yellow-900">{t("Chưa cấu hình MISA API")}</h3>
          <p className="text-sm text-yellow-800 mt-1">
            {t("Để sync trực tiếp từ MISA eShop, cần 3 env vars trong Vercel:")}
          </p>
          <pre className="bg-white border border-yellow-300 p-2 rounded text-xs mt-2 overflow-x-auto">
{`vercel env add MISA_APP_ID production
vercel env add MISA_APP_SECRET production
vercel env add MISA_SHOP_ID production
vercel --prod --force`}
          </pre>
          <div className="mt-3 text-xs text-yellow-800">
            <b>{t("Cách lấy API key:")}</b>
            <ol className="mt-1 list-decimal ml-4 space-y-1">
              <li>{t("Đăng nhập")} <a href="https://eshop.misa.vn" target="_blank" className="text-blue-700 underline">eshop.misa.vn</a></li>
              <li>{t("Vào mục")} <b>{t("Cài đặt → Tích hợp → API Key")}</b></li>
              <li>{t("Tạo App + copy App ID, App Secret, Shop ID")}</li>
              <li>{t("Add vào Vercel, deploy → quay lại trang này")}</li>
            </ol>
          </div>

          <div className="mt-4 bg-white border border-yellow-200 rounded p-3">
            <b className="text-sm">{t("Trong khi chờ kết nối MISA:")}</b>
            <p className="text-xs mt-1">{t("Anh dùng")} <b>{t("Import CSV")}</b> {t("(nút xanh trên) để upload file export từ MISA (hoặc Pancake/Shopee). Hệ thống tự parse + auto-detect format + auto-create khách hàng + sản phẩm mới.")}</p>
            <a href="/admin/orders/import" className="inline-block mt-2 text-sm text-emerald-700 font-semibold underline">{t("→ Mở Import Wizard ngay")}</a>
          </div>
        </div>
      </div>
    </div>
  );
}
