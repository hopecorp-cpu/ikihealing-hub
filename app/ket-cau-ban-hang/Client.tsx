"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useTransition } from "react";
import { Package, CheckCircle2, Undo2, Loader2, AlertTriangle, RotateCcw, Braces } from "lucide-react";
import type { Offer, OfferEconomics } from "@/lib/offer-architecture";
import { setOfferStatus, saveOffersJson, resetToDefault } from "./actions";

const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n || 0)) + "đ";
const LOAI_LABEL: Record<string, string> = {
  combo: "Combo", the: "Thẻ", membership: "Membership", prepay: "Trả trước", autoship: "Auto-ship", flash: "Flash", flow: "Flow bán",
};

export default function Client({ offers: initial, fromConfig, eco }: {
  offers: Offer[]; fromConfig: boolean; eco: Record<string, OfferEconomics>;
}) {
  const { t: t } = useLang();
  const [offers, setOffers] = useState<Offer[]>(initial);
  const [showJson, setShowJson] = useState(false);
  const [json, setJson] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? "Đã lưu." : r.error || "Lỗi");
      if (r.ok && after) after();
      if (r.ok) setTimeout(() => location.reload(), 400);
    });

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Package className="h-6 w-6 text-emerald-700" />
        <div>
          <h1 className="text-xl font-bold">{t("Kết cấu bán hàng — combo, thẻ, quà")}</h1>
          <p className="text-sm text-gray-500">
            {t("Bán GÌ, gói NÀO, tặng GÌ. Luật cứng: khuyến mãi = TẶNG QUÀ, không giảm giá %. Biên gộp tính tự động, KHÔNG hiển thị giá vốn.")}
          </p>
        </div>
      </div>

      {!fromConfig && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>{t("Toàn bộ dưới đây là")} <b>{t("bản đề xuất của Trợ lý AI")}</b>{t(", chưa lưu chính thức. Bấm")} <b>{t("Duyệt")}</b> {t("từng offer (hoặc sửa rồi lưu) để thành chuẩn của công ty — bot và Nhà máy Content sẽ dùng đúng bản này.")}</div>
        </div>
      )}
      {msg && <div className="rounded-lg border bg-gray-50 p-2 text-sm">{msg}</div>}

      <div className="space-y-3">
        {offers.map((o) => {
  const { t: t } = useLang();
          const e = eco[o.code];
          return (
            <div key={o.code} className={`rounded-xl border p-4 ${o.status === "chot" ? "border-emerald-300 bg-emerald-50/40" : "bg-white"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs tabular-nums">{o.code}</span>
                <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{t(LOAI_LABEL[o.loai]) || o.loai}</span>
                <span className="font-semibold">{t(o.ten)}</span>
                {o.status === "chot"
                  ? <span className="ml-auto rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">{t("ĐÃ CHỐT")}</span>
                  : <span className="ml-auto rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">{t("DRAFT — chờ duyệt")}</span>}
              </div>

              <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <div><span className="text-gray-500">{t("Giá niêm yết:")}</span> <b>{o.gia_niem_yet > 0 ? fmt(o.gia_niem_yet) : t("Tặng kèm / khung")}</b>
                    {e && e.tongGiaLe > 0 && o.gia_niem_yet > 0 && (
                      <span className="text-gray-500"> {t("· giá trị lẻ")} {fmt(e.tongGiaLe)}{e.chenhLech > 0 ? ` (khách "hời" ${fmt(e.chenhLech)})` : ""}</span>
                    )}
                  </div>
                  {e?.bienGopPct != null && (
                    <div className={e.bienGopPct < 30 ? "text-red-600 font-medium" : "text-emerald-700"}>
                      {t("Biên gộp ~")}{e.bienGopPct}% {e.bienGopPct < 30 ? t("— DƯỚI SÀN 30%, cân lại giá/ruột") : ""}
                    </div>
                  )}
                  {e && e.thieuSku.length > 0 && <div className="text-amber-600">{t("Thiếu SKU trong hệ:")} {e.thieuSku.join(", ")}</div>}
                  {o.ruot?.length > 0 && <div className="text-gray-600">{t("Ruột:")} {o.ruot.map(r => `${r.sku} x${r.qty}`).join(" + ")}</div>}
                </div>
                <div>
                  {o.qua_tang?.length > 0 && <div><span className="text-gray-500">{t("Quà tặng:")}</span> {o.qua_tang.join(" · ")}</div>}
                  {o.dieu_kien && <div><span className="text-gray-500">{t("Điều kiện:")}</span> {o.dieu_kien}</div>}
                  {o.kenh && <div><span className="text-gray-500">{t("Kênh:")}</span> {o.kenh}</div>}
                </div>
              </div>
              {o.ghi_chu && <div className="mt-2 text-xs text-gray-500 italic">{o.ghi_chu}</div>}

              <div className="mt-3 flex gap-2">
                {o.status !== "chot" ? (
                  <button disabled={pending} onClick={() => act(() => setOfferStatus(o.code, "chot"))}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {t("Duyệt offer này")}
                  </button>
                ) : (
                  <button disabled={pending} onClick={() => act(() => setOfferStatus(o.code, "draft"))}
                    className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">
                    <Undo2 className="h-4 w-4" /> {t("Trả về draft")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border bg-white p-4">
        <button onClick={() => { setShowJson(!showJson); setJson(JSON.stringify(offers, null, 2)); }}
          className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline">
          <Braces className="h-4 w-4" /> {t("Sửa nâng cao (JSON — đổi giá/ruột/quà)")}
        </button>
        {showJson && (
          <div className="mt-3 space-y-2">
            <textarea value={json} onChange={(e) => setJson(e.target.value)} rows={16}
              className="w-full rounded-lg border p-2 font-mono text-xs" />
            <div className="flex gap-2">
              <button disabled={pending} onClick={() => act(() => saveOffersJson(json))}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{t("Lưu JSON")}</button>
              <button disabled={pending} onClick={() => { if (confirm(t("Khôi phục về bản đề xuất gốc của Trợ lý AI (mọi offer về draft)?"))) act(() => resetToDefault()); }}
                className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">
                <RotateCcw className="h-4 w-4" /> {t("Về bản gốc")}
              </button>
            </div>
            <p className="text-xs text-gray-500">{t("Không nhét giá vốn vào đây — hệ tự tính biên từ bảng sản phẩm và chỉ hiện %.")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
