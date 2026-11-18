"use client";
import { useLang } from "@/components/lang-provider";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, Handshake, Loader2, Plus, Pencil, Wallet, ChevronDown, ChevronUp, Info } from "lucide-react";
import { Badge, PageHeader, SectionCard, StatCard } from "@/components/ui/kit";
import { NHAN_TRANG_THAI, type MaSanPham } from "@/lib/gia-v4";
import { BAC_CHON, LOAI_DAI_LY, type DaiLyClient as DL, type DongCongNo } from "@/lib/dai-ly";
import type { BangDaiLy, DongBangDaiLy } from "@/lib/dai-ly-server";
import { ghiCongNoAction, luuDaiLyAction, type FormDaiLy } from "./actions";

const vnd = (n: number | null | undefined) => n == null ? "—" : new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
const tr = (n: number) => (n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + "tr";
const ngayVN = (s?: string | null) => (s ? s.slice(0, 10).split("-").reverse().join("/") : "—");
const TONE_TT: Record<string, string> = { hieu_luc: "green", de_xuat: "amber", chua_chot: "red", ban_het_ton: "gray", thay_the_boi_de_xuat: "slate", noi_bo: "slate" };
const NHAN_CK: Record<string, string> = { dat: "Đã đủ", dung_nhip: "Đúng nhịp", cham: "Chậm", qua_han: "Quá hạn", khong: "Chưa cam kết" };
const TONE_CK: Record<string, string> = { dat: "green", dung_nhip: "blue", cham: "amber", qua_han: "red", khong: "gray" };

export type NppNoiBo = { gia: number; nhanTrangThai: string; docQuyenTrieu: number };

export default function DaiLyClient({ bang, laAdmin, npp }: { bang: BangDaiLy; laAdmin: boolean; npp: NppNoiBo | null }) {
  const { t: t } = useLang();
  const [sua, setSua] = useState<DL | "moi" | null>(null);
  const [congNoCua, setCongNoCua] = useState<DL | null>(null);
  const [mo, setMo] = useState<string | null>(null);
  const tong = useMemo(() => ({
    soDL: bang.dong.length,
    thang: bang.dong.reduce((s, d) => s + d.doanhSoThang.gop, 0),
    quy: bang.dong.reduce((s, d) => s + d.doanhSoQuy.gop, 0),
    noDu: bang.dong.reduce((s, d) => s + d.congNo.soDu, 0),
    quaHan: bang.dong.reduce((s, d) => s + d.congNo.quaHan, 0),
  }), [bang.dong]);

  return (
    <div className="space-y-5">
      <PageHeader icon={Handshake} iconColor="#2563EB" title={t("Đại lý & Nhà phân phối")}
        subtitle={<>{t("Sổ đại lý (config")} <code>dealers</code>{t(") · chiết khấu đọc từ")} <code>lib/gia-v4.ts</code> {t("· doanh số từ sổ đơn Telegram theo SĐT chính + phụ · công nợ hạn")} {bang.cauHinh.hanTraNgay} {t("ngày. Chương trình Giới thiệu (app CTV) là chương trình RIÊNG, không nằm ở đây.")}</>}
        actions={laAdmin ? <button onClick={() => setSua("moi")} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"><Plus className="w-4 h-4" /> {t("Thêm đại lý")}</button> : null} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label={t("Đại lý / NPP")} value={tong.soDL} color="#2563EB" />
        <StatCard label={`Doanh số tháng ${t(bang.ky.thang.nhan)}`} value={tr(tong.thang)} hint={t("số giao dịch, gồm VAT")} color="#10B981" />
        <StatCard label={`Doanh số ${t(bang.ky.quy.nhan)}`} value={tr(tong.quy)} hint={t("gồm VAT")} color="#10B981" />
        <StatCard label={t("Công nợ còn")} value={tr(tong.noDu)} color={tong.noDu > 0 ? "#F59E0B" : "#9CA3AF"} />
        <StatCard label={t("Quá hạn")} value={tr(tong.quaHan)} color={tong.quaHan > 0 ? "#EF4444" : "#9CA3AF"} hint={tong.quaHan > 0 ? t("cần đòi ngay") : undefined} />
      </div>

      {bang.canhBao.length > 0 && (
        <div className="text-sm bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-800 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <ul className="list-disc pl-4 space-y-0.5">{bang.canhBao.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      )}

      {npp && <div className="text-xs bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-600 flex gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-gray-400" />
        <div>
          <b>{t("Thưởng quý bằng hàng (CEO duyệt 02/10/2026):")}</b> {bang.cauHinh.thuong.pct.join("/")}{t("% ở ngưỡng")} {bang.cauHinh.thuong.nguongQuy.map((n) => tr(n)).join(" / ")} {t("doanh số quý\n          (nguồn ngưỡng:")} {bang.cauHinh.nguon.thuong === "config" ? "config dai_ly_cau_hinh" : "gia-v4"}{t(") · hạn công nợ")} {bang.cauHinh.hanTraNgay} {t("ngày.")}
          {" "}<b>{t("Mô hình NPP đạm —")} {npp.nhanTrangThai} {t("(chỉ admin/CEO thấy):")}</b> {t("hộp quy theo giá nhập NPP")} {vnd(npp.gia)}{t(", độc quyền vùng xét từ")} {npp.docQuyenTrieu}{t("tr/quý.\n          Cột &quot;Thưởng quý&quot; là dự kiến trong kỳ đang chạy — chốt khi hết quý; không công bố ra bảng giá / sale page.")}
        </div>
      </div>}

      <SectionCard title={t("Bảng đại lý / NPP")} desc={`Doanh số tính tới ${ngayVN(bang.homNay)} · công nợ lưu ở ${bang.noiLuuCongNo === "bang" ? t("bảng dai_ly_cong_no") : t("config (chưa có bảng)")}`}>
        {bang.dong.length === 0 ? <div className="text-sm text-gray-500">{t("Chưa có đại lý nào trong sổ.")}</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500">
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-2 font-medium">{t("Mã · Tên")}</th>
                  <th className="text-left py-2 pr-2 font-medium">{t("Loại · Bậc")}</th>
                  <th className="text-left py-2 pr-2 font-medium">{t("Vùng")}</th>
                  <th className="text-left py-2 pr-2 font-medium">{t("Chiết khấu")}</th>
                  <th className="text-right py-2 pr-2 font-medium">{t("DS tháng")}</th>
                  <th className="text-right py-2 pr-2 font-medium">{t("DS quý")}</th>
                  <th className="text-left py-2 pr-2 font-medium">{t("Cam kết kỳ")}</th>
                  <th className="text-right py-2 pr-2 font-medium">{t("Công nợ")}</th>
                  {npp && <th className="text-left py-2 pr-2 font-medium">{t("Thưởng quý")} <span className="text-amber-600">{t("(nội bộ)")}</span></th>}
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {bang.dong.map((r) => <Dong key={r.dl.ma} r={r} laAdmin={laAdmin} coNpp={!!npp} mo={mo === r.dl.ma} onMo={() => setMo(mo === r.dl.ma ? null : r.dl.ma)} chiTiet={bang.congNoChiTiet[r.dl.ma] || []} onSua={() => setSua(r.dl)} onCongNo={() => setCongNoCua(r.dl)} />)}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {sua && <FormDaiLyModal dl={sua === "moi" ? null : sua} onDong={() => setSua(null)} />}
      {congNoCua && <FormCongNoModal dl={congNoCua} homNay={bang.homNay} onDong={() => setCongNoCua(null)} />}
    </div>
  );
}

function Dong({ r, laAdmin, coNpp, mo, onMo, chiTiet, onSua, onCongNo }: { r: DongBangDaiLy; laAdmin: boolean; coNpp: boolean; mo: boolean; onMo: () => void; chiTiet: DongCongNo[]; onSua: () => void; onCongNo: () => void }) {
  const { t: t } = useLang();
  const d = r.dl;
  return (
    <>
      <tr className="border-b border-gray-100 align-top">
        <td className="py-2 pr-2">
          <div className="font-semibold">{d.ma}</div>
          <div className="text-gray-700">{d.ho_ten}</div>
          <div className="text-xs text-gray-400">{d.dien_thoai || "—"}{d.dien_thoai_khac?.length ? ` +${d.dien_thoai_khac.length} số phụ` : ""}</div>
        </td>
        <td className="py-2 pr-2">
          <div>{d.loai || t("Đại lý")}</div>
          <div className="text-xs text-gray-500">{d.bac}</div>
        </td>
        <td className="py-2 pr-2">
          <div>{d.vung || "—"}</div>
          {d.doc_quyen_vung && <Badge tone="violet">{t("Độc quyền")}{d.doc_quyen_tu ? ` từ ${ngayVN(d.doc_quyen_tu)}` : ""}</Badge>}
        </td>
        <td className="py-2 pr-2 text-xs space-y-0.5">
          {r.chietKhau.map((c) => (
            <div key={c.ma} className="whitespace-nowrap">
              <span className="text-gray-500">{t(c.ten).replace("Đạm Thực Vật Mẫu Protein Pro", "Đạm").replace("Trà ", "")}:</span>{" "}
              {c.pct == null ? <span className="text-gray-400">{t("không có bậc")}</span> : <b>{c.pct}%</b>}
              {c.giaNhap != null && <span className="text-gray-500"> · {vnd(c.giaNhap)}</span>}
              {c.trangThai && c.trangThai !== "hieu_luc" && <Badge tone={TONE_TT[c.trangThai]} className="ml-1">{NHAN_TRANG_THAI[c.trangThai]}</Badge>}
              {c.ghiDe && <Badge tone="amber" className="ml-1" >{t("ghi đè:")} {c.ghiDe}</Badge>}
            </div>
          ))}
        </td>
        <td className="py-2 pr-2 text-right tabular-nums"><div className="font-medium">{tr(r.doanhSoThang.gop)}</div><div className="text-xs text-gray-400">{r.doanhSoThang.don} {t("đơn")}</div></td>
        <td className="py-2 pr-2 text-right tabular-nums"><div className="font-medium">{tr(r.doanhSoQuy.gop)}</div><div className="text-xs text-gray-400">{r.doanhSoQuy.don} {t("đơn")}</div></td>
        <td className="py-2 pr-2 text-xs">
          {d.cam_ket ? (
            <>
              <div>{d.cam_ket.san_pham}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${r.camKet.pct}%` }} /></div>
                <span>{d.cam_ket.da_lay}/{d.cam_ket.can_lay} ({r.camKet.pct}%)</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1"><Badge tone={TONE_CK[r.camKet.trangThai]}>{t(NHAN_CK[r.camKet.trangThai])}</Badge><span className="text-gray-400">{t("hạn")} {ngayVN(d.cam_ket.han)}{r.camKet.conNgay != null && r.camKet.conNgay >= 0 ? ` · còn ${r.camKet.conNgay} ngày` : ""}</span></div>
            </>
          ) : <span className="text-gray-400">—</span>}
        </td>
        <td className="py-2 pr-2 text-right tabular-nums">
          <div className={`font-medium ${r.congNo.soDu > 0 ? "text-amber-700" : ""}`}>{vnd(r.congNo.soDu)}</div>
          {r.congNo.quaHan > 0 && <div className="text-xs text-red-600 font-medium">{t("quá hạn")} {vnd(r.congNo.quaHan)} · {r.congNo.ngayQuaHanLauNhat} {t("ngày")}</div>}
          <button onClick={onMo} className="text-xs text-blue-600 inline-flex items-center gap-0.5 mt-0.5">{mo ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} {chiTiet.length} {t("dòng")}</button>
        </td>
        {coNpp && <td className="py-2 pr-2 text-xs">
          {r.thuong.bac > 0 ? (
            <>
              <div><b>{t("Bậc")} {r.thuong.bac} · {r.thuong.pct}%</b> = {vnd(r.thuong.tien)}</div>
              <div className="text-gray-700">≈ <b>{r.thuong.hop ?? "—"}</b> {t("hộp đạm")}</div>
            </>
          ) : <div className="text-gray-400">{t("Chưa tới ngưỡng")}</div>}
          {r.thuong.nguongKe != null && <div className="text-gray-400">{t("bậc kế")} {tr(r.thuong.nguongKe)}{t(", thiếu")} {tr(Math.max(0, r.thuong.conThieu || 0))}</div>}
          {r.thuong.trangThai !== "hieu_luc" && <Badge tone={TONE_TT[r.thuong.trangThai] || "amber"} className="mt-0.5">{NHAN_TRANG_THAI[r.thuong.trangThai]}</Badge>}
        </td>}
        <td className="py-2 text-right whitespace-nowrap">
          {laAdmin && (
            <div className="flex flex-col gap-1 items-end">
              <button onClick={onSua} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"><Pencil className="w-3 h-3" /> {t("Sửa")}</button>
              <button onClick={onCongNo} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"><Wallet className="w-3 h-3" /> {t("Công nợ")}</button>
            </div>
          )}
        </td>
      </tr>
      {mo && (
        <tr className="border-b border-gray-100 bg-gray-50/60">
          <td colSpan={10} className="px-3 py-2 text-xs">
            {chiTiet.length === 0 ? <span className="text-gray-400">{t("Chưa có dòng công nợ.")}</span> : (
              <table className="w-full">
                <thead className="text-gray-500"><tr><th className="text-left py-1 font-medium">{t("Ngày")}</th><th className="text-left py-1 font-medium">{t("Loại")}</th><th className="text-right py-1 font-medium">{t("Số tiền")}</th><th className="text-left py-1 pl-3 font-medium">{t("Đơn / kênh")}</th><th className="text-left py-1 pl-3 font-medium">{t("Ghi chú")}</th><th className="text-left py-1 pl-3 font-medium">{t("Người ghi")}</th></tr></thead>
                <tbody>
                  {[...chiTiet].sort((a, b) => b.ngay.localeCompare(a.ngay)).map((c) => (
                    <tr key={c.id} className="border-t border-gray-100">
                      <td className="py-1">{ngayVN(c.ngay)}</td>
                      <td className="py-1">{c.loai === "no" ? <Badge tone="amber">{t("Giao nợ")}</Badge> : <Badge tone="green">{t("Đã trả")}</Badge>}</td>
                      <td className="py-1 text-right tabular-nums">{vnd(c.so_tien)}</td>
                      <td className="py-1 pl-3">{c.loai === "no" ? c.ma_don || "" : c.kenh || ""}</td>
                      <td className="py-1 pl-3 text-gray-500">{c.ghi_chu || ""}</td>
                      <td className="py-1 pl-3 text-gray-400">{c.tao_boi || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {d.ghi_chu && <div className="mt-2 text-gray-500">{t("Ghi chú sổ:")} {d.ghi_chu}</div>}
            {(d.hop_dong_so || d.ngay_ky) && <div className="text-gray-500">{t("Hợp đồng")} {d.hop_dong_so || "—"} {t("· ký")} {ngayVN(d.ngay_ky)}{d.freeship_tu ? ` · freeship từ ${d.freeship_tu}` : ""}</div>}
          </td>
        </tr>
      )}
    </>
  );
}

const O = "w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm";
const SP_GHI_DE: { ma: MaSanPham; ten: string }[] = [{ ma: "dam", ten: "Đạm" }, { ma: "san-pham-b", ten: "Trà Mẫu B" }, { ma: "san-pham-c", ten: "Trà Mẫu A" }];

function FormDaiLyModal({ dl, onDong }: { dl: DL | null; onDong: () => void }) {
  const { t: t } = useLang();
  const [f, setF] = useState<FormDaiLy>({
    ma: dl?.ma || "", ho_ten: dl?.ho_ten || "", loai: dl?.loai || "Đại lý", bac: dl?.bac && (BAC_CHON as readonly string[]).includes(dl.bac) ? dl.bac : "Đại lý",
    vung: dl?.vung || "", doc_quyen_vung: !!dl?.doc_quyen_vung, doc_quyen_tu: dl?.doc_quyen_tu || "",
    dia_chi: dl?.dia_chi || "", dien_thoai: dl?.dien_thoai || "", dien_thoai_khac: (dl?.dien_thoai_khac || []).join(", "),
    freeship_tu: dl?.freeship_tu || "", hop_dong_so: dl?.hop_dong_so || "", ngay_ky: dl?.ngay_ky || "", ghi_chu: dl?.ghi_chu || "",
    cam_ket: dl?.cam_ket ? { san_pham: dl.cam_ket.san_pham, han: dl.cam_ket.han, moc_giua: dl.cam_ket.moc_giua || "", da_lay: dl.cam_ket.da_lay, can_lay: dl.cam_ket.can_lay } : null,
    ghi_de: Object.entries(dl?.chiet_khau_ghi_de || {}).map(([ma, v]) => ({ ma: ma as MaSanPham, pct: v!.pct, ly_do: v!.ly_do })),
    cccd_moi: "",
  });
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, batDau] = useTransition();
  const set = <K extends keyof FormDaiLy>(k: K, v: FormDaiLy[K]) => setF((o) => ({ ...o, [k]: v }));
  const luu = () => batDau(async () => {
    setLoi(null);
    const r = await luuDaiLyAction(f);
    if (r.ok) onDong(); else setLoi(r.error || "Lỗi không rõ");
  });
  const ghiDeCua = (ma: MaSanPham) => f.ghi_de.find((g) => g.ma === ma);
  const datGhiDe = (ma: MaSanPham, pct: string, ly_do: string) => {
    const con = f.ghi_de.filter((g) => g.ma !== ma);
    if (pct.trim() === "") return set("ghi_de", con);
    set("ghi_de", [...con, { ma, pct: Number(pct), ly_do }]);
  };
  return (
    <Modal tieuDe={dl ? `Sửa đại lý ${dl.ma}` : t("Thêm đại lý / NPP")} onDong={onDong}>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <L n={t("Mã")}><input className={O} value={f.ma} disabled={!!dl} onChange={(e) => set("ma", e.target.value)} placeholder="ACME-DL-002" /></L>
        <L n={t("Họ tên")}><input className={O} value={f.ho_ten} onChange={(e) => set("ho_ten", e.target.value)} /></L>
        <L n={t("Loại")}><select className={O} value={f.loai} onChange={(e) => set("loai", e.target.value)}>{LOAI_DAI_LY.map((x) => <option key={x}>{x}</option>)}</select></L>
        <L n={t("Bậc (chiết khấu theo gia-v4)")}><select className={O} value={f.bac} onChange={(e) => set("bac", e.target.value)}>{BAC_CHON.map((x) => <option key={x}>{x}</option>)}</select></L>
        <L n={t("Vùng")}><input className={O} value={f.vung} onChange={(e) => set("vung", e.target.value)} placeholder={t("vd Hải Phòng")} /></L>
        <L n={t("Độc quyền vùng")}>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={f.doc_quyen_vung} onChange={(e) => set("doc_quyen_vung", e.target.checked)} />
            <input type="date" className={O} value={f.doc_quyen_tu} disabled={!f.doc_quyen_vung} onChange={(e) => set("doc_quyen_tu", e.target.value)} />
          </div>
        </L>
        <L n={t("SĐT chính")}><input className={O} value={f.dien_thoai} onChange={(e) => set("dien_thoai", e.target.value)} /></L>
        <L n={t("SĐT phụ (cách nhau bằng dấu phẩy)")}><input className={O} value={f.dien_thoai_khac} onChange={(e) => set("dien_thoai_khac", e.target.value)} /></L>
        <L n={t("Địa chỉ")} rong><input className={O} value={f.dia_chi} onChange={(e) => set("dia_chi", e.target.value)} /></L>
        <L n={t("CCCD (chỉ lưu ở server, không hiện lại)")}><input className={O} value={f.cccd_moi || ""} onChange={(e) => set("cccd_moi", e.target.value)} placeholder={dl ? t("để trống = giữ nguyên") : ""} /></L>
        <L n={t("Freeship từ")}><input className={O} value={f.freeship_tu} onChange={(e) => set("freeship_tu", e.target.value)} /></L>
        <L n={t("Số hợp đồng")}><input className={O} value={f.hop_dong_so} onChange={(e) => set("hop_dong_so", e.target.value)} /></L>
        <L n={t("Ngày ký")}><input type="date" className={O} value={f.ngay_ky} onChange={(e) => set("ngay_ky", e.target.value)} /></L>
        <L n={t("Ghi chú")} rong><input className={O} value={f.ghi_chu} onChange={(e) => set("ghi_chu", e.target.value)} /></L>
      </div>

      <div className="mt-4">
        <div className="text-xs font-semibold text-gray-600 mb-1">{t("Cam kết kỳ")}</div>
        {f.cam_ket ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
            <L n={t("Sản phẩm / mô tả")} rong><input className={O} value={f.cam_ket.san_pham} onChange={(e) => set("cam_ket", { ...f.cam_ket!, san_pham: e.target.value })} /></L>
            <L n={t("Hạn")}><input type="date" className={O} value={f.cam_ket.han} onChange={(e) => set("cam_ket", { ...f.cam_ket!, han: e.target.value })} /></L>
            <L n={t("Mốc giữa")}><input type="date" className={O} value={f.cam_ket.moc_giua} onChange={(e) => set("cam_ket", { ...f.cam_ket!, moc_giua: e.target.value })} /></L>
            <L n={t("Đã lấy / cần lấy")}><div className="flex gap-1"><input type="number" className={O} value={f.cam_ket.da_lay} onChange={(e) => set("cam_ket", { ...f.cam_ket!, da_lay: Number(e.target.value) })} /><input type="number" className={O} value={f.cam_ket.can_lay} onChange={(e) => set("cam_ket", { ...f.cam_ket!, can_lay: Number(e.target.value) })} /></div></L>
            <button className="text-xs text-red-600 text-left" onClick={() => set("cam_ket", null)}>{t("Bỏ cam kết")}</button>
          </div>
        ) : <button className="text-xs text-blue-600" onClick={() => set("cam_ket", { san_pham: "", han: "", moc_giua: "", da_lay: 0, can_lay: 0 })}>{t("+ Thêm cam kết")}</button>}
      </div>

      <div className="mt-4">
        <div className="text-xs font-semibold text-gray-600 mb-1">{t("Ghi đè chiết khấu (để trống = theo bậc trong gia-v4; ghi đè bắt buộc có lý do)")}</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
          {SP_GHI_DE.map((sp) => {
            const g = ghiDeCua(sp.ma);
            return (
              <div key={sp.ma} className="flex gap-1 items-center">
                <span className="text-xs text-gray-500 w-24 shrink-0">{t(sp.ten)}</span>
                <input type="number" className={O + " w-16"} placeholder="%" value={g ? g.pct : ""} onChange={(e) => datGhiDe(sp.ma, e.target.value, g?.ly_do || "")} />
                <input className={O} placeholder={t("lý do")} value={g?.ly_do || ""} onChange={(e) => datGhiDe(sp.ma, g ? String(g.pct) : "", e.target.value)} disabled={!g} />
              </div>
            );
          })}
        </div>
      </div>

      {loi && <div className="mt-3 text-sm text-red-600">{loi}</div>}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onDong} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm">{t("Huỷ")}</button>
        <button onClick={luu} disabled={dang} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium inline-flex items-center gap-1 disabled:opacity-60">{dang && <Loader2 className="w-4 h-4 animate-spin" />} {t("Lưu")}</button>
      </div>
    </Modal>
  );
}

function FormCongNoModal({ dl, homNay, onDong }: { dl: DL; homNay: string; onDong: () => void }) {
  const { t: t } = useLang();
  const [loai, setLoai] = useState<"no" | "tra">("no");
  const [ngay, setNgay] = useState(homNay);
  const [soTien, setSoTien] = useState("");
  const [maDon, setMaDon] = useState("");
  const [kenh, setKenh] = useState("Chuyển khoản");
  const [ghiChu, setGhiChu] = useState("");
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, batDau] = useTransition();
  const luu = () => batDau(async () => {
    setLoi(null);
    const r = await ghiCongNoAction({ ma_dai_ly: dl.ma, loai, ngay, so_tien: Number(soTien.replace(/\D/g, "")), ma_don: maDon, kenh, ghi_chu: ghiChu });
    if (r.ok) onDong(); else setLoi(r.error || "Lỗi không rõ");
  });
  return (
    <Modal tieuDe={`Công nợ · ${dl.ma} ${dl.ho_ten}`} onDong={onDong}>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <L n={t("Loại")}><select className={O} value={loai} onChange={(e) => setLoai(e.target.value as any)}><option value="no">{t("Giao hàng nợ")}</option><option value="tra">{t("Đã trả")}</option></select></L>
        <L n={t("Ngày")}><input type="date" className={O} value={ngay} onChange={(e) => setNgay(e.target.value)} /></L>
        <L n={t("Số tiền (đ)")}><input className={O} inputMode="numeric" value={soTien} onChange={(e) => setSoTien(e.target.value)} placeholder="vd 16000000" /></L>
        {loai === "no" ? <L n={t("Mã đơn liên quan")}><input className={O} value={maDon} onChange={(e) => setMaDon(e.target.value)} placeholder={t("TG-… hoặc số HĐ")} /></L>
          : <L n={t("Kênh trả")}><select className={O} value={kenh} onChange={(e) => setKenh(e.target.value)}><option>{t("Chuyển khoản")}</option><option>{t("Tiền mặt")}</option><option>{t("Cấn trừ")}</option><option>{t("Khác")}</option></select></L>}
        <L n={t("Ghi chú")} rong><input className={O} value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} /></L>
      </div>
      {loi && <div className="mt-3 text-sm text-red-600">{loi}</div>}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onDong} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm">{t("Huỷ")}</button>
        <button onClick={luu} disabled={dang} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium inline-flex items-center gap-1 disabled:opacity-60">{dang && <Loader2 className="w-4 h-4 animate-spin" />} Ghi</button>
      </div>
    </Modal>
  );
}

function L({ n, children, rong }: { n: string; children: React.ReactNode; rong?: boolean }) {
  return <label className={`block ${rong ? "col-span-2 md:col-span-full" : ""}`}><span className="block text-xs text-gray-500 mb-0.5">{n}</span>{children}</label>;
}

function Modal({ tieuDe, children, onDong }: { tieuDe: string; children: React.ReactNode; onDong: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={onDong}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-5 mt-8" onClick={(e) => e.stopPropagation()}>
        <div className="font-bold text-gray-900 mb-3">{tieuDe}</div>
        {children}
      </div>
    </div>
  );
}
