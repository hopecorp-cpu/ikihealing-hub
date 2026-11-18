"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useTransition } from "react";
import { markPaymentPaid, seedLoansFromFile } from "./actions";
import { fmtVND } from "@/lib/payroll";
import { Check, Clock, Sprout } from "lucide-react";

export function LoansClient({ loans, payments, needSeed }: any) {
  const { t } = useLang();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [payDate, setPayDate] = useState<Record<string, string>>({});
  const [payRef, setPayRef] = useState<Record<string, string>>({});

  const seed = () => {
    if (!confirm(t("Seed 2 hợp đồng (HĐ1 300M + HĐ2 1B) + 12 payments từ file?"))) return;
    startTransition(async () => {
      const res = await seedLoansFromFile();
      if (res.success) { setMsg({ text: t("Seed xong — reload trang"), type: "ok" }); setTimeout(() => location.reload(), 800); }
      else setMsg({ text: "" + res.error, type: "err" });
    });
  };

  const markPaid = (paymentId: string) => {
    const date = payDate[paymentId] || new Date().toISOString().slice(0, 10);
    const ref = payRef[paymentId];
    if (!confirm(`${t("Đánh dấu paid ngày")} ${date}?`)) return;
    startTransition(async () => {
      const res = await markPaymentPaid({ paymentId, paid_date: date, ref_code: ref, payment_method: "MB Bank" });
      if (res.success) { setMsg({ text: t("Đã ghi nhận thanh toán"), type: "ok" }); setTimeout(() => location.reload(), 800); }
      else setMsg({ text: "" + (res as any).error, type: "err" });
    });
  };

  if (needSeed) {
    return (
      <button onClick={seed} disabled={pending}
        className="mt-4 px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold inline-flex items-center gap-2 disabled:opacity-50">
        <Sprout className="w-4 h-4" /> {pending ? t("Seeding...") : t("Seed data từ file ACME_TheoDoi_NoVay")}
      </button>
    );
  }

  const pending_pay = payments.filter((p: any) => p.status === "pending").sort((a: any, b: any) => (a.due_date || "").localeCompare(b.due_date || ""));
  const paid = payments.filter((p: any) => p.status === "paid").sort((a: any, b: any) => (b.paid_date || b.period_end || "").localeCompare(a.paid_date || a.period_end || ""));

  return (
    <div className="space-y-6">
      {msg && <div className={`p-3 rounded text-sm ${msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg.text}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loans.map((l: any) => (
          <div key={l.id} className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-bold text-lg">{l.contract_code}</h3>
                <p className="text-xs text-gray-500">{t("Người cho vay:")} <b>{l.lender}</b></p>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                l.status === "active" ? "bg-orange-100 text-orange-700" :
                l.status === "paid_off" ? "bg-emerald-100 text-emerald-700" :
                "bg-gray-100 text-gray-700"
              }`}>{l.status === "active" ? t("Đang vay") : l.status === "paid_off" ? t("Tất toán") : l.status}</span>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">{t("Gốc ban đầu:")}</span> <b>{fmtVND(l.principal_amount)}</b></div>
              <div className="flex justify-between"><span className="text-gray-500">{t("Dư nợ hiện tại:")}</span> <b className={l.outstanding_principal > 0 ? "text-red-600" : "text-emerald-600"}>{fmtVND(l.outstanding_principal)}</b></div>
              <div className="flex justify-between"><span className="text-gray-500">{t("Lãi suất:")}</span> <b>{(l.interest_rate * 100).toFixed(1)}{t("%/năm")}</b></div>
              <div className="flex justify-between"><span className="text-gray-500">{t("Tần suất:")}</span> <b>{l.payment_frequency}</b></div>
              <div className="flex justify-between"><span className="text-gray-500">{t("Bắt đầu:")}</span> <b>{l.start_date}</b></div>
              {l.end_date && <div className="flex justify-between"><span className="text-gray-500">{t("Tất toán:")}</span> <b>{l.end_date}</b></div>}
            </div>
            {l.notes && <div className="text-xs text-gray-500 italic mt-2">{l.notes}</div>}
          </div>
        ))}
      </div>

      {pending_pay.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
          <h3 className="font-bold text-orange-900 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" /> {t("Kỳ thanh toán sắp đến hạn")} ({pending_pay.length})
          </h3>
          <div className="space-y-3">
            {pending_pay.map((p: any) => (
              <div key={p.id} className="bg-white border border-orange-200 rounded-lg p-3">
                <div className="flex justify-between items-start gap-3 flex-wrap">
                  <div>
                    <div className="font-bold">{p.loans?.contract_code} · {p.period}</div>
                    <div className="text-xs text-gray-500">{p.period_start} → {p.period_end} {p.due_date && `· ${t("Đến hạn:")} ${p.due_date}`}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">{t("Lãi gộp")}</div>
                    <div className="font-bold">{fmtVND(p.gross_amount || 0)}</div>
                    <div className="text-xs text-red-600">{t("- Thuế 5%:")} {fmtVND(p.withholding_tax || 0)}</div>
                    <div className="font-bold text-emerald-700">{t("= Thực:")} {fmtVND(p.net_amount || 0)}</div>
                  </div>
                </div>
                <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100 items-center">
                  <input type="date" value={payDate[p.id] || ""} onChange={e => setPayDate({ ...payDate, [p.id]: e.target.value })}
                    className="p-1 border border-gray-200 rounded text-xs" />
                  <input value={payRef[p.id] || ""} onChange={e => setPayRef({ ...payRef, [p.id]: e.target.value })}
                    placeholder={t("Mã GD bank")} className="p-1 border border-gray-200 rounded text-xs flex-1" />
                  <button onClick={() => markPaid(p.id)} disabled={pending}
                    className="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-semibold inline-flex items-center gap-1">
                    <Check className="w-3 h-3" /> {t("Đã thanh toán")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.06)] p-5">
        <h3 className="font-bold mb-3">{t("Lịch sử thanh toán")} ({paid.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="text-left p-2">{t("HĐ")}</th>
                <th className="text-left p-2">{t("Kỳ")}</th>
                <th className="text-left p-2">{t("Loại")}</th>
                <th className="text-left p-2">{t("Ngày trả")}</th>
                <th className="text-right p-2">{t("Lãi gộp")}</th>
                <th className="text-right p-2">{t("Thuế 5%")}</th>
                <th className="text-right p-2">{t("Thực trả")}</th>
                <th className="text-left p-2">{t("Mã GD")}</th>
              </tr>
            </thead>
            <tbody>
              {paid.map((p: any) => (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="p-2 font-medium">{p.loans?.contract_code}</td>
                  <td className="p-2">{p.period}</td>
                  <td className="p-2 text-xs">
                    <span className={`px-1.5 py-0.5 rounded ${p.payment_type === "principal" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                      {p.payment_type === "principal" ? t("Gốc") : t("Lãi")}
                    </span>
                  </td>
                  <td className="p-2 text-xs">{p.paid_date || "—"}</td>
                  <td className="p-2 text-right tabular-nums">{fmtVND(p.gross_amount)}</td>
                  <td className="p-2 text-right tabular-nums text-red-600">{p.withholding_tax > 0 ? `-${fmtVND(p.withholding_tax)}` : "—"}</td>
                  <td className="p-2 text-right tabular-nums font-semibold text-emerald-700">{fmtVND(p.net_amount)}</td>
                  <td className="p-2 text-xs tabular-nums">{p.ref_code || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
