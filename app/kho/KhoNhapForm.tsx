"use client";
import { useLang } from "@/components/lang-provider";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { ghiNhapKhoAction, khaiMocTonAction } from "./actions";

function Nut({ nhan }: { nhan: string }) {
  const { t: t } = useLang();
  const { pending } = useFormStatus();
  return <button disabled={pending} className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-50">{pending ? t("Đang ghi...") : nhan}</button>;
}

export default function KhoNhapForm({ laQuanLy }: { laQuanLy: boolean }) {
  const { t: t } = useLang();
  const [tab, setTab] = useState<"nhap" | "moc">("nhap");
  const [kqNhap, ghiNhap] = useFormState(ghiNhapKhoAction, null as any);
  const [kqMoc, khaiMoc] = useFormState(khaiMocTonAction, null as any);
  const kq = tab === "nhap" ? kqNhap : kqMoc;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-4 space-y-3">
      <div className="flex gap-2 items-center">
        <div className="text-sm font-semibold mr-2">{t("Nuôi sổ tồn nội bộ")}</div>
        <button onClick={() => setTab("nhap")} className={`px-3 py-1 rounded-md text-xs border ${tab === "nhap" ? "bg-gray-900 text-white border-gray-900" : "border-gray-300"}`}>{t("Ghi đợt nhập kho")}</button>
        {laQuanLy && <button onClick={() => setTab("moc")} className={`px-3 py-1 rounded-md text-xs border ${tab === "moc" ? "bg-gray-900 text-white border-gray-900" : "border-gray-300"}`}>{t("Khai mốc kiểm kho")}</button>}
      </div>
      <p className="text-xs text-gray-500">
        {tab === "nhap"
          ? t("Hàng về kho đợt nào ghi đợt đó — không ghi thì tồn máy tính sẽ thấp hơn thật. Mỗi dòng: Tên hàng | số lượng.")
          : t("Kiểm kho thật xong dán kết quả vào đây — ĐÈ toàn bộ mốc cũ, sổ tự trừ tính lại từ hôm nay. Mỗi dòng: Tên hàng | số lượng.")}
      </p>
      <form action={tab === "nhap" ? ghiNhap : khaiMoc} className="space-y-2">
        {tab === "nhap" && (
          <input type="date" name="ngay" className="p-2 border border-gray-200 rounded-lg text-sm" defaultValue={new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)} />
        )}
        <textarea name="dong" rows={4} required placeholder={t("Đạm thực vật Đạm Mẫu | 120\nTrà Mẫu A | 50")}
          className="w-full p-2 border border-gray-200 rounded-lg text-sm font-mono" />
        <div className="flex items-center gap-3">
          <Nut nhan={tab === "nhap" ? t("Ghi đợt nhập") : t("Khai mốc mới")} />
          {kq?.ok && <span className="text-sm text-emerald-600">{kq.ok}</span>}
          {kq?.loi && <span className="text-sm text-red-600">{kq.loi}</span>}
        </div>
      </form>
    </div>
  );
}
