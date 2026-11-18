"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useTransition } from "react";
import { SectionCard, Card, Badge } from "@/components/ui/kit";
import { Upload, Store, AlertTriangle } from "lucide-react";
import { doiSoatTuFile } from "./actions";
import type { KetQuaDoiSoat } from "@/lib/doi-soat-san";

const vn = (n: number) => Math.round(n || 0).toLocaleString("vi-VN") + "đ";
const LOAI: Record<string, { ten: string; tone: string }> = {
  "chua-thanh-toan": { ten: "Chưa được trả", tone: "amber" },
  "khong-co-don": { ten: "Có tiền, không có đơn", tone: "blue" },
  "lech-tien": { ten: "Lệch tiền", tone: "red" },
  "hoan": { ten: "Hoàn bất thường", tone: "red" },
};

export default function Client() {
  const { t: t } = useLang();
  const [pending, start] = useTransition();
  const [kq, setKq] = useState<KetQuaDoiSoat | null>(null);
  const [meta, setMeta] = useState<{ soDongDon: number; soDongTT: number } | null>(null);
  const [loi, setLoi] = useState("");

  const nop = (fd: FormData) => start(async () => {
    setLoi(""); setKq(null);
    const r = await doiSoatTuFile(fd);
    if (!r.ok) { setLoi(r.error); return; }
    setKq(r.kq); setMeta({ soDongDon: r.soDongDon, soDongTT: r.soDongTT });
  });

  return (
    <div className="space-y-5">
      <SectionCard title={<span className="flex items-center gap-2"><Upload className="h-4 w-4" /> {t("Thả file xuất từ sàn")}</span>}
        desc={t("File ĐƠN là bắt buộc (Shopee: Order.all*.xlsx từ Đơn hàng → Xuất; TikTok: All Orders). File THANH TOÁN nếu có (Shopee: Báo cáo doanh thu / Income; TikTok: Settlement) — không có thì máy suy 'thực về' từ phí ghi trong file đơn.")}>
        <form action={nop} className="grid gap-3 md:grid-cols-4">
          <label className="text-sm"><span className="mb-1 block text-gray-500">{t("Sàn")}</span>
            <select name="san" className="w-full rounded-lg border px-3 py-2"><option value="shopee">Shopee</option><option value="tiktok">TikTok Shop</option></select></label>
          <label className="text-sm md:col-span-1"><span className="mb-1 block text-gray-500">{t("File ĐƠN")}</span>
            <input type="file" name="fileDon" accept=".xlsx,.xls,.csv,.tsv" className="w-full text-xs" /></label>
          <label className="text-sm md:col-span-1"><span className="mb-1 block text-gray-500">{t("File THANH TOÁN (nếu có)")}</span>
            <input type="file" name="fileTT" accept=".xlsx,.xls,.csv,.tsv" className="w-full text-xs" /></label>
          <div className="flex items-end">
            <button type="submit" disabled={pending} className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{pending ? t("Đang đối soát...") : t("Đối soát")}</button>
          </div>
        </form>
        {loi && <p className="mt-3 text-sm text-red-600">{loi}</p>}
        <p className="mt-3 text-[11px] text-gray-500">{t("File không được lưu lại — chỉ tính rồi trả kết quả. Muốn giữ thì bấm In hoặc chụp màn hình.")}</p>
      </SectionCard>

      {kq && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card><div className="text-[11px] uppercase tracking-wide text-gray-500">{t("Bán được (tiền hàng)")}</div><div className="mt-1 text-2xl font-bold text-gray-800">{vn(kq.tongTienHang)}</div><div className="text-xs text-gray-500">{kq.soDon} {t("đơn · kỳ")} {kq.kyTu} → {kq.kyDen}</div></Card>
            <Card><div className="text-[11px] uppercase tracking-wide text-gray-500">{t("Sàn giữ lại")}</div><div className="mt-1 text-2xl font-bold text-amber-700">{vn(kq.tongSanTru)}</div><div className="text-xs text-gray-500">{t("phí sàn + trợ giá shop chịu + ship shop chịu")}</div></Card>
            <Card><div className="text-[11px] uppercase tracking-wide text-gray-500">{t("Thực về")}</div><div className="mt-1 text-2xl font-bold text-emerald-700">{vn(kq.tongThucVe)}</div><div className="text-xs text-gray-500">= {(kq.tiLeThucVe * 100).toFixed(1)}{t("% tiền hàng ·")} {kq.soDonCoThanhToan} {t("đơn có tiền")}</div></Card>
          </div>

          {(kq.canhBao.length > 0 || kq.cotThieu.length > 0 || kq.soDonConHanTra > 0) && (
            <Card className="border-amber-200 bg-amber-50">
              <div className="flex gap-2 text-sm text-amber-900"><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <ul className="list-disc space-y-0.5 pl-4">
                  {kq.soDonConHanTra > 0 && <li><b>{kq.soDonConHanTra} {t("đơn (")}{vn(kq.tienConHanTra)}{t(") đã giao nhưng còn trong hạn khách được trả hàng")}</b> {t("— đã tính vào bán được, nhưng tiền chưa chắc về. Đối soát lại sau khi hết hạn.")}</li>}
                  {kq.canhBao.map((c) => <li key={c}>{c}</li>)}
                  {kq.cotThieu.map((c) => <li key={c}>{c}</li>)}
                </ul></div>
            </Card>
          )}

          <SectionCard title={`Lệch đích danh (${kq.lech.length})`} desc={t("Mỗi dòng một mã đơn, một lý do. Không có dòng nào là hai file khớp nhau hoàn toàn.")}>
            {!kq.lech.length ? <p className="text-sm text-emerald-700">{t("Không có lệch.")} {meta?.soDongTT ? t("Hai file khớp nhau.") : t("Chưa có file thanh toán nên mới soi được phí — muốn soi tiền về thì thả thêm file thanh toán.")}</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left text-xs text-gray-500"><th className="py-2 pr-3">{t("Mã đơn")}</th><th className="py-2 pr-3">{t("Loại")}</th><th className="py-2 pr-3 text-right">{t("Số tiền")}</th><th className="py-2">{t("Chi tiết")}</th></tr></thead>
                  <tbody>{kq.lech.map((l) => (
                    <tr key={l.ma + l.loai} className="border-b last:border-0">
                      <td className="py-2 pr-3 tabular-nums text-xs">{l.ma}</td>
                      <td className="py-2 pr-3"><Badge tone={LOAI[l.loai]?.tone || "gray"}>{t(LOAI[l.loai]?.ten) || l.loai}</Badge></td>
                      <td className="py-2 pr-3 text-right tabular-nums">{vn(l.tien)}</td>
                      <td className="py-2 text-xs text-gray-600">{l.chiTiet}</td>
                    </tr>))}</tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
