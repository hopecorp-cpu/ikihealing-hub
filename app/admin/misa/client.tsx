"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useTransition } from "react";
import { syncMisaOrders, syncMisaProducts } from "./actions";
import { ArrowRight, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

export function MisaSyncClient({ sales }: { sales: any[] }) {
  const { t } = useLang();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [days, setDays] = useState(7);
  const [defaultSaleId, setDefaultSaleId] = useState("");

  const syncOrders = () => {
    startTransition(async () => {
      const res = await syncMisaOrders({ days, defaultSaleId: defaultSaleId || undefined });
      if (res.success) {
        setMsg({ text: `${t("Sync xong:")} ${res.total} ${t("đơn")} (${res.inserted} ${t("mới")}, ${res.updated} ${t("cập nhật")})`, type: "ok" });
      } else {
        setMsg({ text: "" + res.error, type: "err" });
      }
    });
  };

  const syncProds = () => {
    startTransition(async () => {
      const res = await syncMisaProducts();
      if (res.success) {
        setMsg({ text: `${t("Sync xong:")} ${res.total} ${t("SP")} (${res.inserted} ${t("mới")})`, type: "ok" });
      } else {
        setMsg({ text: "" + res.error, type: "err" });
      }
    });
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5 space-y-4">
      <h3 className="font-semibold">{t("Đồng bộ thủ công")}</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">{t("Sync orders bao nhiêu ngày trở lại")}</label>
          <select value={days} onChange={e => setDays(+e.target.value)}
            className="mt-1 w-full p-2 border border-gray-200 rounded text-sm">
            <option value={1}>{t("1 ngày (hôm qua)")}</option>
            <option value={7}>{t("7 ngày")}</option>
            <option value={30}>{t("30 ngày")}</option>
            <option value={90}>{t("90 ngày")}</option>
            <option value={365}>{t("1 năm")}</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">{t("Sale mặc định cho đơn từ MISA")}</label>
          <select value={defaultSaleId} onChange={e => setDefaultSaleId(e.target.value)}
            className="mt-1 w-full p-2 border border-gray-200 rounded text-sm">
            <option value="">{t("— Không gán —")}</option>
            {sales.map((s: any) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded text-sm flex items-start gap-2 ${msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {msg.type === "ok" ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <AlertCircle className="w-4 h-4 mt-0.5" />}
          {msg.text}
        </div>
      )}

      <div className="flex gap-2 flex-wrap pt-3 border-t">
        <button onClick={syncOrders} disabled={pending}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${pending ? "animate-spin" : ""}`} />
          {pending ? t("Đang sync...") : `${t("Sync orders")} ${days} ${t("ngày")}`}
        </button>
        <button onClick={syncProds} disabled={pending}
          className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2">
          <ArrowRight className="w-4 h-4" /> {t("Sync products")}
        </button>
      </div>

      <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
        {t("Sync sẽ:")}
        <ul className="mt-1 ml-4 list-disc">
          <li>{t("Pull tất cả orders trong khoảng date từ MISA")}</li>
          <li>{t("Insert mới hoặc update theo")} <code>misa_id</code> {t("để tránh trùng")}</li>
          <li>{t('Auto-categorize channel = "MISA eShop", source_platform = "misa"')}</li>
          <li>{t("Gán sale mặc định nếu chọn → tự tính bonus tháng đó")}</li>
        </ul>
      </div>
    </div>
  );
}
