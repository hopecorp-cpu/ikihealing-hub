"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Handshake, Loader2, Save, Gift, Info, AlertTriangle, Printer, Download } from "lucide-react";
import type { ChannelPolicy, CtvTier, DealerTier } from "@/lib/channel-policy";
import { GIA_V3_HET_HIEU_LUC, GIA_V4_HIEU_LUC_TU, GIA_V4_PHIEN_BAN, NHAN_TRANG_THAI, type DongBangGia } from "@/lib/gia-v4";
import { saveChannelPolicyAction } from "./actions";

const vnd = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n || 0)) + "đ";
const ngayVN = (iso: string) => iso.split("-").reverse().join("/");
const MAU_TT: Record<string, string> = {
  hieu_luc: "bg-emerald-100 text-emerald-700 border-emerald-200",
  de_xuat: "bg-amber-100 text-amber-700 border-amber-200",
  chua_chot: "bg-red-100 text-red-700 border-red-200",
  ban_het_ton: "bg-gray-100 text-gray-600 border-gray-200",
  thay_the_boi_de_xuat: "bg-gray-100 text-gray-500 border-gray-200 line-through",
  noi_bo: "bg-gray-100 text-gray-500 border-gray-200",
};

function BangV4({ bang, bien, choCeo }: { bang: DongBangGia[]; bien: (number | null)[]; choCeo: string[] }) {
  const { t: t } = useLang();
  const nhom = Array.from(new Set(bang.map((d) => d.sanPham)));
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold text-sm">{t("Chính sách giá")} {GIA_V4_PHIEN_BAN} {t("— hiệu lực từ")} {ngayVN(GIA_V4_HIEU_LUC_TU)}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{t("v3 hết hiệu lực từ")} {ngayVN(GIA_V3_HET_HIEU_LUC)}{t(". Nguồn duy nhất:")} <code>lib/gia-v4.ts</code> {t("— mọi cửa bán (web, PayOS, bóc đơn Telegram) đọc cùng bảng này. Giá gồm VAT 8%.")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/chinh-sach-kenh/bang-gia" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-gray-300 hover:bg-gray-50"><Printer className="w-3.5 h-3.5" /> {t("Bản in cho sale/đại lý")}</Link>
          <Link href="/chinh-sach-kenh/bang-gia/csv" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-gray-300 hover:bg-gray-50"><Download className="w-3.5 h-3.5" /> CSV</Link>
        </div>
      </div>
      {choCeo.length > 0 && (
        <div className="text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-800 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <b>{t("Chờ CEO chốt — chưa phải chính sách hiệu lực:")}</b>
            <ul className="list-disc pl-5 mt-1 space-y-0.5">{choCeo.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500">
            <tr className="border-b border-gray-200">
              <th className="text-left py-1.5 pr-2 font-medium">{t("Sản phẩm")}</th>
              <th className="text-left py-1.5 pr-2 font-medium">{t("Kênh")}</th>
              <th className="text-left py-1.5 pr-2 font-medium">{t("Bậc")}</th>
              <th className="text-right py-1.5 pr-2 font-medium">CK %</th>
              <th className="text-right py-1.5 pr-2 font-medium">{t("Giá")}</th>
              <th className="text-right py-1.5 pr-2 font-medium">{t("Biên gộp")}</th>
              <th className="text-left py-1.5 pr-2 font-medium">{t("Trạng thái")}</th>
              <th className="text-left py-1.5 font-medium">{t("Ghi chú")}</th>
            </tr>
          </thead>
          <tbody>
            {nhom.map((ten) => bang.map((d, i) => ({ d, i })).filter((x) => x.d.sanPham === ten).map(({ d, i }, k) => (
              <tr key={i} className="border-b border-gray-50 align-top">
                <td className="py-1.5 pr-2 whitespace-nowrap">{k === 0 ? <b>{ten}</b> : ""}</td>
                <td className="py-1.5 pr-2 whitespace-nowrap">{d.kenh}</td>
                <td className="py-1.5 pr-2">{d.bac}{k === 0 && d.quyCach ? <span className="text-gray-400"> · {d.quyCach}</span> : null}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{d.chietKhauPct == null ? "" : d.chietKhauPct + "%"}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums font-medium">{d.gia == null ? "—" : vnd(d.gia)}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-gray-500 sensitive">{bien[i] == null ? "" : bien[i] + "%"}</td>
                <td className="py-1.5 pr-2"><span className={`text-[11px] px-1.5 py-0.5 rounded border ${MAU_TT[d.trangThai] || ""}`}>{NHAN_TRANG_THAI[d.trangThai]}</span></td>
                <td className="py-1.5 text-xs text-gray-500 min-w-[16rem]">{d.ghiChu}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function marginAfterDiscount(G: number, d: number): number {
  if (d >= 100) return -100;
  return Math.round((1 - (1 - G / 100) / (1 - d / 100)) * 100);
}

function marginAfterCommission(G: number, c: number): number { return Math.round(G - c); }

function lightOf(newM: number, floor: number): { cls: string; label: string } {
  if (newM >= floor) return { cls: "bg-emerald-100 text-emerald-700 border-emerald-200", label: `biên còn ${newM}%` };
  if (newM >= floor - 15) return { cls: "bg-amber-100 text-amber-700 border-amber-200", label: `biên còn ${newM}% — sát ngưỡng` };
  return { cls: "bg-red-100 text-red-700 border-red-200", label: `biên còn ${newM}% — ĂN MÒN` };
}

export default function PolicyClient({ policy, refMargin, bangV4, bienV4, choCeo }: {
  policy: ChannelPolicy; refMargin: number | null; bangV4: DongBangGia[]; bienV4: (number | null)[]; choCeo: string[];
}) {
  const { t: t } = useLang();
  const [ctv, setCtv] = useState<CtvTier[]>(policy.ctv);
  const [dealer, setDealer] = useState<DealerTier[]>(policy.dealer);
  const [floor, setFloor] = useState(policy.desiredMarginFloor || 30);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const G = refMargin;

  function save() {
    setMsg(null);
    start(async () => {
  const { t: t } = useLang();
      const r = await saveChannelPolicyAction({ ctv, dealer, desiredMarginFloor: floor });
      setMsg(r.ok ? { ok: true, text: t("Đã lưu chính sách.") } : { ok: false, text: r.error || "Lỗi" });
    });
  }

  const num = (v: string) => Math.max(0, Number(String(v).replace(/\D/g, "")) || 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Handshake className="w-6 h-6 text-brand-600" /> {t("Chính sách kênh")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("Bảng giá v4 theo sản phẩm × kênh (nguồn trong code) · bên dưới là bản cấu hình cũ v3. Đèn tự chấm biên theo giá vốn —")} <b>{t("không lộ giá vốn")}</b>.</p>
      </div>

      <BangV4 bang={bangV4} bien={bienV4} choCeo={choCeo} />

      <section className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2"><Info className="w-5 h-5 text-blue-600" /><h2 className="font-semibold text-sm">{t("Nguyên tắc chống xung đột giá")}</h2></div>
        <ul className="space-y-1.5">
          {policy.principles.map((p, i) => (
            <li key={i} className="text-sm text-gray-700 pl-4 relative before:content-[''] before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:rounded-sm before:bg-brand-500">{p}</li>
          ))}
        </ul>
        <div className="mt-3 flex items-center gap-2 text-sm bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-emerald-800">
          <Gift className="w-4 h-4 shrink-0" /> {t("Khuyến mãi khách lẻ =")} <b>{t("TẶNG QUÀ")}</b>{t(", không chiết khấu % (luật thực phẩm bổ sung).")}
        </div>
      </section>

      {G != null && (
        <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          {t("Biên tham chiếu (sản phẩm chủ lực):")} <b>~{G}%</b>{t(". Ngưỡng biên tối thiểu:")}
          <input type="number" value={floor} onChange={(e) => setFloor(num(e.target.value))} className="mx-1 w-14 border border-gray-300 rounded px-1.5 py-0.5 text-sm" />{t("%.\n          Đèn dưới báo mức CK có giữ được ngưỡng này không.")}
        </div>
      )}

      <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
        {t("Hai khối dưới là")} <b>{t("bản cấu hình cũ (config")} <code>channel_policy</code>{t(", v3) — hết hiệu lực từ")} {ngayVN(GIA_V3_HET_HIEU_LUC)}</b>{t(", giữ để đối chiếu. Máy chặn/cảnh báo đơn KHÔNG đọc số ở đây, chỉ đọc bảng v4 ở trên.")}
      </div>

      <section className="bg-white border border-gray-200 rounded-xl p-4">
        <h2 className="font-semibold text-sm mb-3">{t("Bậc Đại lý (chiết khấu nhập sỉ) — bản cũ")}</h2>
        <div className="space-y-2">
          {dealer.map((d, i) => {
            const m = G != null ? marginAfterDiscount(G, d.discountPct) : null;
            const lt = m != null ? lightOf(m, floor) : null;
            return (
              <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <input value={d.name} onChange={(e) => setDealer(dealer.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className="border border-gray-300 rounded px-2 py-1 w-40" />
                <span className="text-gray-500">{t("nhập từ")}</span>
                <input type="number" value={d.minUnits} onChange={(e) => setDealer(dealer.map((x, j) => j === i ? { ...x, minUnits: num(e.target.value) } : x))} className="border border-gray-300 rounded px-2 py-1 w-16 text-right" />
                <span className="text-gray-500">{t("thùng → CK")}</span>
                <input type="number" value={d.discountPct} onChange={(e) => setDealer(dealer.map((x, j) => j === i ? { ...x, discountPct: num(e.target.value) } : x))} className="border border-gray-300 rounded px-2 py-1 w-16 text-right" />
                <span className="text-gray-500">%</span>
                {lt && <span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${lt.cls}`}>{t(lt.label)}</span>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-4">
        <h2 className="font-semibold text-sm mb-3">{t("Bậc CTV (hoa hồng — bán đúng giá niêm yết) — bản cũ; chương trình giới thiệu v4 là 15% / 5% ở bảng trên")}</h2>
        <div className="space-y-2">
          {ctv.map((c, i) => {
            const m = G != null ? marginAfterCommission(G, c.commissionPct) : null;
            const lt = m != null ? lightOf(m, floor) : null;
            return (
              <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <input value={c.name} onChange={(e) => setCtv(ctv.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className="border border-gray-300 rounded px-2 py-1 w-40" />
                <span className="text-gray-500">{t("doanh số/tháng ≥")}</span>
                <input type="number" value={c.minMonthly} onChange={(e) => setCtv(ctv.map((x, j) => j === i ? { ...x, minMonthly: num(e.target.value) } : x))} className="border border-gray-300 rounded px-2 py-1 w-28 text-right" />
                <span className="text-gray-500 text-xs">({vnd(c.minMonthly)}) → HH</span>
                <input type="number" value={c.commissionPct} onChange={(e) => setCtv(ctv.map((x, j) => j === i ? { ...x, commissionPct: num(e.target.value) } : x))} className="border border-gray-300 rounded px-2 py-1 w-16 text-right" />
                <span className="text-gray-500">%</span>
                {lt && <span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${lt.cls}`}>{t(lt.label)}</span>}
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={pending} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60">
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t("Lưu bản cấu hình cũ")}
        </button>
        {msg && <span className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</span>}
        {policy.updatedAt && <span className="text-xs text-gray-400 ml-auto">{t("Cập nhật")} {policy.updatedAt.slice(0, 10)}{policy.updatedBy ? ` · ${policy.updatedBy}` : ""}</span>}
      </div>
    </div>
  );
}
