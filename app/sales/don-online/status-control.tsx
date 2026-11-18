"use client";

import { useLang } from "@/components/lang-provider";
import { useState, useTransition } from "react";
import { updateOnlineOrderStatus } from "./actions";

const OPTIONS: { value: string; label: string }[] = [
  { value: "pending", label: "Chờ thanh toán" },
  { value: "confirmed", label: "Đã thanh toán" },
  { value: "shipping", label: "Đang giao" },
  { value: "delivered", label: "Đã giao" },
  { value: "cancelled", label: "Huỷ" },
  { value: "refunded", label: "Hoàn tiền" },
];

export function StatusControl({ orderId, value }: { orderId: string; value: string }) {
  const { t: t } = useLang();
  const [status, setStatus] = useState(value);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  function change(next: string) {
    const prev = status;
    setStatus(next);
    start(async () => {
      const r = await updateOnlineOrderStatus(orderId, next);
      if (!r.ok) { setStatus(prev); setMsg(r.error || "Lỗi"); setTimeout(() => setMsg(""), 2500); }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={status}
        disabled={pending}
        onChange={(e) => change(e.target.value)}
        className="text-xs border rounded-md px-2 py-1 bg-white disabled:opacity-50"
      >
        {OPTIONS.map(o => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
      </select>
      {pending && <span className="text-[10px] text-gray-400">…</span>}
      {msg && <span className="text-[10px] text-red-600">{msg}</span>}
    </div>
  );
}
