"use client";
import { useLang } from "@/components/lang-provider";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { guiTinSoan, boQuaTinSoan } from "./actions";
import { Send, X } from "lucide-react";

type Tin = {
  chuoi: string; buoc: number; zalo_uid: string; ten: string; sdt: string | null; noiDung: string;

  kenh?: string; tinKhach?: string; luc?: string; hot?: boolean; medical?: boolean;
};

function Nut({ nhan, mau, icon: Icon }: { nhan: string; mau: string; icon: any }) {
  const { t: tDich } = useLang();
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-50 ${mau}`}>
      <Icon className="w-3.5 h-3.5" />{pending ? tDich("Đang xử lý...") : nhan}
    </button>
  );
}

function MotTin({ t, tenChuoi }: { t: Tin; tenChuoi: string }) {
  const { t: tDich } = useLang();
  const [noiDung, setNoiDung] = useState(t.noiDung);
  const [kqGui, gui] = useFormState(guiTinSoan, null as any);
  const [kqBo, bo] = useFormState(boQuaTinSoan, null as any);

  const kq = (kqGui?.ok && kqGui) || (kqBo?.ok && kqBo) || kqBo || kqGui;
  if (kq?.ok) return <div className="py-3 border-b border-gray-100 text-sm text-emerald-700">{kq.ok}</div>;

  const laOa = t.kenh === "oa";
  const nhan = laOa
    ? `${tenChuoi} · ${t.noiDung ? "AI soạn nháp" : "chờ người soạn"}${t.luc ? " · " + new Date(t.luc).toLocaleString("vi-VN") : ""}`
    : `${tenChuoi} · bước ${t.buoc + 1}`;

  return (
    <div className="py-3 border-b border-gray-100 last:border-0 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-900">{tDich(t.ten)}</span>
        {t.sdt && <span className="text-xs text-gray-400">{t.sdt}</span>}
        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{nhan}</span>
        {laOa && t.medical && <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-700">{tDich("chạm chuyện bệnh - đã bàn giao sale")}</span>}
        {laOa && !t.medical && t.hot && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">{tDich("có ý mua - đã bàn giao sale")}</span>}
      </div>
      {laOa && t.tinKhach && (
        <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-2 whitespace-pre-wrap"><span className="text-xs text-gray-400">{tDich("Khách nhắn:")} </span>{t.tinKhach}</p>
      )}
      <textarea value={noiDung} onChange={(e) => setNoiDung(e.target.value)} rows={laOa ? 3 : 2}
        placeholder={laOa ? tDich("Viết câu trả lời cho khách...") : undefined}
        className="w-full p-2 border border-gray-200 rounded-lg text-sm" />
      <div className="flex items-center gap-2 flex-wrap">
        <form action={gui}>
          <input type="hidden" name="uid" value={t.zalo_uid} />
          <input type="hidden" name="kenh" value={t.kenh || ""} />
          <input type="hidden" name="noiDung" value={noiDung} />
          <Nut nhan={laOa ? tDich("Gửi qua OA") : tDich("Gửi")} mau="bg-gray-900 text-white" icon={Send} />
        </form>
        <form action={bo}>
          <input type="hidden" name="uid" value={t.zalo_uid} />
          <input type="hidden" name="kenh" value={t.kenh || ""} />
          <Nut nhan={tDich("Bỏ qua")} mau="bg-white border border-gray-300 text-gray-700" icon={X} />
        </form>
        {kq?.loi && <span className="text-sm text-red-600">{kq.loi}</span>}
      </div>
    </div>
  );
}

export default function Client({ tin, tenChuoi }: { tin: Tin[]; tenChuoi: Record<string, string> }) {
  const { t: tDich } = useLang();
  if (!tin.length) return <p className="text-sm text-gray-500 py-3">{tDich("Không có tin nào chờ duyệt. Tin Zalo OA vào ngay khi khách nhắn; chuỗi chăm sóc máy soạn lúc 9:16 sáng mỗi ngày.")}</p>;
  return <div>{tin.map((t) => <MotTin key={`${t.kenh || "nick"}:${t.zalo_uid}`} t={t} tenChuoi={tenChuoi[t.chuoi] || t.chuoi} />)}</div>;
}
