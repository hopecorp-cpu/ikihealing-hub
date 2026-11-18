"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useTransition } from "react";
import { SectionCard, Badge, Card } from "@/components/ui/kit";
import { Rocket, Gauge, CheckCircle2, Ban } from "lucide-react";
import { taoPhieu, doiTrangThaiPhieu, doNgay } from "./actions";
import type { PhieuRaMat } from "@/lib/ra-mat-san-pham";

const PHONG: Array<{ k: keyof PhieuRaMat["phuTrach"]; ten: string }> = [
  { k: "kho", ten: "Kho / sản phẩm" }, { k: "content", ten: "Nội dung" }, { k: "sale", ten: "Sale" }, { k: "mkt", ten: "Marketing" },
];

export default function Client({ phieu, nhanSu, laQuanLy }: { phieu: PhieuRaMat[]; nhanSu: string[]; laQuanLy: boolean }) {
  const { t: t } = useLang();
  const [pending, start] = useTransition();
  const [tb, setTb] = useState("");
  const [f, setF] = useState({ ten: "", sku: "", ngayRaMat: new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10), moTa: "", phuTrach: {} as PhieuRaMat["phuTrach"] });

  const tao = () => start(async () => {
    setTb("");
    const r = await taoPhieu({ ma: f.sku || f.ten, ...f });
    if (!r.ok) { setTb(r.error); return; }
    setTb(`Đã mở phiếu và đẻ ${r.viec.taoMoi.length} việc vào /tasks${r.viec.loi ? ` (lỗi: ${r.viec.loi})` : ""}${r.viec.loiGhi?.length ? ` — ${r.viec.loiGhi.length} việc KHÔNG mở được: ${r.viec.loiGhi[0]}` : ""}. Người được giao sẽ thấy trong việc của mình và kế hoạch ngày.`);
    setF({ ...f, ten: "", sku: "", moTa: "" });
  });

  return (
    <div className="space-y-5">
      {laQuanLy && (
        <SectionCard title={<span className="flex items-center gap-2"><Rocket className="h-4 w-4" /> {t("Mở phiếu ra mắt")}</span>}
          desc={t("Điền một lần — máy tự đẻ 7 việc có chủ có hạn cho kho, nội dung, sale, marketing; và tự đo sau 7 ngày.")}>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm md:col-span-2"><span className="mb-1 block text-gray-500">{t("Tên sản phẩm")}</span>
              <input value={t(f.ten)} onChange={(e) => setF({ ...f, ten: e.target.value })} className="w-full rounded-lg border px-3 py-2" placeholder={t("VD: Trà Mẫu B hộp 30 gói")} /></label>
            <label className="text-sm"><span className="mb-1 block text-gray-500">{t("Mã SKU (nếu có)")}</span>
              <input value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} className="w-full rounded-lg border px-3 py-2" placeholder="TTH-030" /></label>
            <label className="text-sm"><span className="mb-1 block text-gray-500">{t("Ngày ra mắt (hàng về)")}</span>
              <input type="date" value={f.ngayRaMat} onChange={(e) => setF({ ...f, ngayRaMat: e.target.value })} className="w-full rounded-lg border px-3 py-2" /></label>
            <label className="text-sm md:col-span-2"><span className="mb-1 block text-gray-500">{t("Ghi chú (điểm bán, combo, giá dự kiến...)")}</span>
              <input value={t(f.moTa)} onChange={(e) => setF({ ...f, moTa: e.target.value })} className="w-full rounded-lg border px-3 py-2" /></label>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            {PHONG.map((p) => (
              <label key={p.k} className="text-xs"><span className="mb-1 block text-gray-500">{t("Phụ trách")} {t(p.ten)}</span>
                <select value={f.phuTrach[p.k] || ""} onChange={(e) => setF({ ...f, phuTrach: { ...f.phuTrach, [p.k]: e.target.value || undefined } })} className="w-full rounded-lg border px-2 py-1.5">
                  <option value="">{t("— CEO nhận mặc định —")}</option>
                  {nhanSu.map((n) => <option key={n} value={n}>{n}</option>)}
                </select></label>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button onClick={tao} disabled={pending || !t(f.ten).trim()} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              {pending ? t("Đang mở...") : t("Mở phiếu + đẻ việc")}
            </button>
            {tb && <span className="text-xs text-gray-700">{tb}</span>}
          </div>
        </SectionCard>
      )}

      <SectionCard title={t("Phiếu ra mắt")} desc={t("Số bài, khách đã báo, đơn — máy đếm từ dữ liệu thật, không phải cờ tay. Bài không gắn mã sản phẩm thì không được tính.")}
        right={laQuanLy ? <button onClick={() => start(async () => { const r = await doNgay(); setTb(r.ok ? `Đã đo ${r.soPhieu} phiếu.` : r.error); })} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs hover:bg-gray-50"><Gauge className="h-3.5 w-3.5" /> {t("Đo ngay")}</button> : undefined}>
        {!phieu.length ? <p className="text-sm text-gray-500">{t("Chưa có phiếu nào. Mẫu mới về thì mở phiếu ở trên — đừng để nó nằm trong đầu người nhận hàng.")}</p> : (
          <div className="grid gap-3 md:grid-cols-2">
            {phieu.map((p) => {
              const ngayThu = Math.floor((Date.now() - new Date(`${p.ngayRaMat}T00:00:00Z`).getTime()) / 864e5) + 1;
              const d = p.do;
              return (
                <Card key={p.ma}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-800">{t(p.ten)} {p.sku && <span className="text-xs font-normal text-gray-400">· {p.sku}</span>}</p>
                      <p className="text-xs text-gray-500">{t("Ra mắt")} {p.ngayRaMat} · {p.trangThai === "dang-chay" ? `ngày thứ ${Math.max(1, ngayThu)}` : p.trangThai === "xong" ? t("đã xong") : t("đã huỷ")}</p>
                    </div>
                    <Badge tone={p.trangThai === "dang-chay" ? "green" : "gray"}>{p.trangThai === "dang-chay" ? t("đang chạy") : p.trangThai}</Badge>
                  </div>
                  {d ? (
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className={`rounded-lg p-2 ${d.soBaiDaDang === 0 && ngayThu >= 3 ? "bg-red-50" : "bg-gray-50"}`}><div className="text-lg font-bold">{d.soBaiDaDang}<span className="text-xs font-normal text-gray-400">/{d.soBai}</span></div><div className="text-[11px] text-gray-500">{t("bài đã đăng")}</div></div>
                      <div className="rounded-lg bg-gray-50 p-2"><div className="text-lg font-bold">{d.soKhachDaBao}</div><div className="text-[11px] text-gray-500">{t("khách đã báo")}</div></div>
                      <div className="rounded-lg bg-gray-50 p-2"><div className="text-lg font-bold">{d.soDon}</div><div className="text-[11px] text-gray-500">{t("đơn")}</div></div>
                    </div>
                  ) : <p className="mt-3 text-xs text-gray-400">{t("Chưa đo — máy đo mỗi sáng, hoặc bấm Đo ngay.")}</p>}
                  {d?.ghiChu?.length ? <ul className="mt-2 list-disc pl-4 text-[11px] text-amber-700">{d.ghiChu.map((g) => <li key={g}>{g}</li>)}</ul> : null}
                  {laQuanLy && p.trangThai === "dang-chay" && (
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => start(async () => { await doiTrangThaiPhieu(p.ma, "xong"); })} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs hover:bg-gray-50"><CheckCircle2 className="h-3.5 w-3.5" /> {t("Đóng phiếu")}</button>
                      <button onClick={() => start(async () => { await doiTrangThaiPhieu(p.ma, "huy"); })} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"><Ban className="h-3.5 w-3.5" /> {t("Huỷ")}</button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
