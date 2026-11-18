"use client";
import { useLang } from "@/components/lang-provider";
import { useState, useTransition } from "react";
import { ArrowUp, ArrowDown, Eye, EyeOff, Plus, Trash2, Save, Download, ExternalLink } from "lucide-react";
import type { SanPhamShop } from "@/lib/cua-hang";
import { luuCuaHang, napTuWeb } from "./actions";

const NHOM: Record<string, string> = {
  dam: "Đạm", tra: "Trà", dau: "Dầu", giavi: "Gia vị", thucduong: "Thực dưỡng", caphe: "Cà phê", khac: "Khác",
};

const TRANG_THAI: Record<string, string> = { "sap-ra-mat": "Sắp ra mắt (đặt trước)", "ngung-ban": "Ngừng bán" };
const tien = (n: number) => (n || 0).toLocaleString("vi-VN") + "đ";
const o = "w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm";

export default function CuaHangClient({ dsBanDau, lichSu }: { dsBanDau: SanPhamShop[]; lichSu: { luc: string; ai: string; doi: string[] }[] }) {
  const { t: tDich } = useLang();
  const [ds, setDs] = useState<SanPhamShop[]>(dsBanDau);
  const [mo, setMo] = useState<number | null>(null);
  const [loi, setLoi] = useState<string[]>([]);
  const [bao, setBao] = useState("");
  const [dang, startT] = useTransition();
  const doi = JSON.stringify(ds) !== JSON.stringify(dsBanDau);

  const sua = (i: number, patch: Partial<SanPhamShop>) => setDs((x) => x.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const doiCho = (i: number, d: number) => setDs((x) => {
    const y = [...x]; const j = i + d; if (j < 0 || j >= y.length) return x;
    [y[i], y[j]] = [y[j], y[i]]; return y;
  });

  const luu = () => startT(async () => {
    setBao(""); const kq = await luuCuaHang(ds); setLoi(kq.loi);
    if (kq.ok) setBao("Đã lưu. Khoảng một phút sau example.com/shop đổi theo. " + ((kq as any).pinterest || ""));
  });
  const nap = () => startT(async () => {
    const kq = await napTuWeb(); setLoi(kq.loi);
    if (kq.ok) { setBao(`Đã nạp ${kq.so} sản phẩm từ web.`); location.reload(); }
  });

  if (!ds.length) {
    return (
      <div className="bg-white border rounded-2xl p-6 text-center">
        <p className="mb-3 text-gray-600">{tDich("Chưa có danh sách. Nạp một lần từ trang example.com/shop đang chạy.")}</p>
        <button onClick={nap} disabled={dang} className="inline-flex items-center gap-2 bg-emerald-700 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50">
          <Download size={16} /> {dang ? tDich("Đang nạp...") : tDich("Nạp sản phẩm từ web")}
        </button>
        {loi.map((l) => <p key={l} className="text-red-600 text-sm mt-2">{l}</p>)}
      </div>
    );
  }

  return (
    <div>
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border rounded-xl p-3 mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-600">{ds.length} {tDich("món ·")} {ds.filter((p) => !p.an).length} {tDich("đang hiện")}</span>
        <a href="https://example.com/shop/" target="_blank" className="text-sm text-emerald-700 inline-flex items-center gap-1"><ExternalLink size={14} />Xem web</a>
        <div className="flex-1" />
        <button onClick={() => { setDs((x) => [...x, { n: "", t: "", cat: "khac", price: 0, img: "", an: true }]); setMo(ds.length); }}
          className="inline-flex items-center gap-1 border rounded-lg px-3 py-1.5 text-sm"><Plus size={15} />{tDich("Thêm món")}</button>
        <button onClick={luu} disabled={dang || !doi} className="inline-flex items-center gap-1 bg-emerald-700 text-white rounded-lg px-3 py-1.5 text-sm disabled:opacity-40">
          <Save size={15} />{dang ? tDich("Đang lưu...") : doi ? tDich("Lưu thay đổi") : tDich("Chưa đổi gì")}
        </button>
      </div>
      {bao && <p className="text-emerald-700 text-sm mb-2">{bao}</p>}
      {loi.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3 text-sm text-red-700">
          <b>{tDich("Chưa lưu được:")}</b>
          <ul className="list-disc ml-5">{loi.map((l) => <li key={l}>{l}</li>)}</ul>
        </div>
      )}

      <div className="space-y-2">
        {ds.map((p, i) => (
          <div key={i} className={`bg-white border rounded-xl ${p.an ? "opacity-60" : ""}`}>
            <div className="flex items-center gap-3 p-2.5">
              {p.img ? <img src={p.img} alt="" className="w-12 h-12 object-cover rounded-lg border" /> : <div className="w-12 h-12 rounded-lg bg-gray-100" />}
              <button onClick={() => setMo(mo === i ? null : i)} className="flex-1 text-left min-w-0">
                <div className="font-medium truncate">{p.n || tDich("(chưa có tên)")}</div>
                <div className="text-xs text-gray-500">{tDich(NHOM[p.cat]) || p.cat} · {tien(p.price)}{p.qua ? tDich(" · có quà") : ""}{p.an ? tDich(" · đang ẩn") : ""}{p.het_hang ? tDich(" · hết hàng") : ""}{p.trangThai ? " · " + tDich(TRANG_THAI[p.trangThai] || p.trangThai) + (p.ngayVe ? " " + p.ngayVe : "") : ""}</div>
              </button>
              <button type="button" title={tDich("Lên")} onClick={() => doiCho(i, -1)} className="p-1.5 text-gray-500"><ArrowUp size={16} /></button>
              <button type="button" title={tDich("Xuống")} onClick={() => doiCho(i, 1)} className="p-1.5 text-gray-500"><ArrowDown size={16} /></button>
              <button type="button" title={p.het_hang ? tDich("Còn hàng") : tDich("Đánh dấu hết hàng")} onClick={() => sua(i, { het_hang: !p.het_hang })}
                className={`px-2 py-1 text-xs border rounded-lg ${p.het_hang ? "bg-red-50 text-red-800 border-red-200" : "text-gray-600 border-gray-200"}`}>
                {p.het_hang ? tDich("Hết hàng") : tDich("Còn hàng")}
              </button>
              <button type="button" title={p.an ? tDich("Hiện") : tDich("Ẩn")} onClick={() => sua(i, { an: !p.an })} className="p-1.5 text-gray-500">{p.an ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
            {mo === i && (
              <div className="border-t p-3 grid md:grid-cols-2 gap-3 text-sm">
                <label className="md:col-span-2 flex items-start gap-2">
                  <input type="checkbox" className="mt-1" checked={p.het_hang === true} onChange={(e) => sua(i, { het_hang: e.target.checked })} />
                  <span>{tDich("Hết hàng trên web (vẫn hiện trang, giá và quà; khoá nút đặt. Zalo và sale không đổi)")}</span>
                </label>
                <label>{tDich("Trạng thái bán")}<select className={o} value={p.trangThai || ""} onChange={(e) => sua(i, { trangThai: (e.target.value || undefined) as SanPhamShop["trangThai"] })}>
                  <option value="">{tDich("Đang bán")}</option>
                  {Object.entries(TRANG_THAI).map(([k, v]) => <option key={k} value={k}>{tDich(v)}</option>)}
                </select></label>
                <label>{tDich("Ngày dự kiến về hàng (dd/mm/yyyy, khi sắp ra mắt)")}<input className={o} value={p.ngayVe || ""} onChange={(e) => sua(i, { ngayVe: e.target.value.trim() || undefined })} /></label>
                <label className="md:col-span-2">{tDich("Tên")}<input className={o} value={p.n} onChange={(e) => sua(i, { n: e.target.value })} /></label>
                <label className="md:col-span-2">{tDich("Dòng mô tả ngắn")}<input className={o} value={p.t} onChange={(e) => sua(i, { t: e.target.value })} /></label>
                <label>{tDich("Giá bán (đồng)")}<input className={o} inputMode="numeric" value={p.price || ""} onChange={(e) => sua(i, { price: parseInt(e.target.value.replace(/\D/g, "") || "0", 10) })} /></label>
                <label>{tDich("Nhóm")}<select className={o} value={p.cat} onChange={(e) => sua(i, { cat: e.target.value })}>
                  {Object.entries(NHOM).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></label>
                <label className="md:col-span-2">{tDich("Link ảnh")}<input className={o} value={p.img} onChange={(e) => sua(i, { img: e.target.value })} /></label>
                <label>{tDich("Nhãn góc ảnh (vd Bán chạy)")}<input className={o} value={p.badge || ""} onChange={(e) => sua(i, { badge: e.target.value })} /></label>
                <label>{tDich("Điểm nổi bật (cao lên trước)")}<input className={o} inputMode="numeric" value={p.score ?? ""} onChange={(e) => sua(i, { score: parseInt(e.target.value.replace(/\D/g, "") || "0", 10) })} /></label>
                <label className="md:col-span-2">{tDich("Chứng nhận (cách nhau dấu phẩy)")}<input className={o} value={(p.certs || []).join(", ")} onChange={(e) => sua(i, { certs: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></label>
                <label className="md:col-span-2">{tDich("Quà tặng kèm (để trống = không hiện ô quà)")}<input className={o} value={p.qua || ""} onChange={(e) => sua(i, { qua: e.target.value })} /></label>
                <label className="md:col-span-2">{tDich("Mô tả thẻ")}<textarea className={o} rows={2} value={tDich(p.desc) || ""} onChange={(e) => sua(i, { desc: e.target.value })} /></label>
                <label className="md:col-span-2">{tDich("Giới thiệu (trang chi tiết)")}<textarea className={o} rows={3} value={tDich(p.intro) || ""} onChange={(e) => sua(i, { intro: e.target.value })} /></label>
                <label className="md:col-span-2">{tDich("Điểm nổi bật, mỗi dòng \"tiêu đề | mô tả\"")}
                  <textarea className={o} rows={3} value={(p.highlights || []).map((h) => `${h.t} | ${h.d}`).join("\n")}
                    onChange={(e) => sua(i, { highlights: e.target.value.split("\n").filter((l) => l.trim()).map((l) => { const [t, ...d] = l.split("|"); return { t: t.trim(), d: d.join("|").trim() }; }) })} />
                </label>
                <label>{tDich("Cách dùng")}<textarea className={o} rows={2} value={p.usage || ""} onChange={(e) => sua(i, { usage: e.target.value })} /></label>
                <label>{tDich("Bảo quản")}<textarea className={o} rows={2} value={p.storage || ""} onChange={(e) => sua(i, { storage: e.target.value })} /></label>
                <div className="md:col-span-2 flex justify-end">
                  <button onClick={() => { if (confirm(`Xoá hẳn "${p.n || tDich("món này")}" khỏi danh sách? (Muốn tạm cất thì bấm Ẩn)`)) { setDs((x) => x.filter((_, j) => j !== i)); setMo(null); } }}
                    className="inline-flex items-center gap-1 text-red-600 text-sm"><Trash2 size={14} />{tDich("Xoá món")}</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {lichSu.length > 0 && (
        <div className="mt-6">
          <h2 className="font-semibold mb-2">{tDich("Lần sửa gần đây")}</h2>
          <ul className="text-sm text-gray-600 space-y-1">
            {lichSu.map((l, k) => (
              <li key={k}>{new Date(l.luc).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {l.ai}: {l.doi.join("; ")}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
