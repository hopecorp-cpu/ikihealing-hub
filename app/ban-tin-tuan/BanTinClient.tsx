"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, Youtube, Facebook, FileText, AlertTriangle, Save, ShieldCheck } from "lucide-react";
import type { MucBanTin } from "@/lib/ban-tin-tuan-core";
import { luuNhapAction, xemTruocAction } from "./actions";

type Nhap = { subject: string; mucIds: string[]; linkThem: string; luc: string; nguoi: string } | null;
const ddmm = (n: string) => `${n.slice(8, 10)}/${n.slice(5, 7)}`;
const IconLoai = ({ loai }: { loai: MucBanTin["loai"] }) =>
  loai === "youtube" ? <Youtube className="w-4 h-4 text-red-600" /> : loai === "fanpage" ? <Facebook className="w-4 h-4 text-blue-600" /> : <FileText className="w-4 h-4 text-emerald-600" />;

export default function BanTinClient({ khung, cacTuan, muc, loi, nhap, dem }: {
  khung: { tuNgay: string; denNgay: string };
  cacTuan: { tuNgay: string; denNgay: string }[];
  muc: MucBanTin[];
  loi: string[];
  nhap: Nhap;
  dem: { tong: number; duocGui: number };
}) {
  const router = useRouter();

  const [chon, setChon] = useState<Set<string>>(() => new Set(nhap?.mucIds?.length ? nhap.mucIds
    : [...muc.filter((m) => m.loai !== "fanpage"), ...muc.filter((m) => m.loai === "fanpage").slice(0, 5)].map((m) => m.id)));
  const [linkThem, setLinkThem] = useState(nhap?.linkThem || "");
  const [xem, setXem] = useState<{ subject?: string; html?: string; tuCam?: string[]; error?: string }>({});
  const [baoLuu, setBaoLuu] = useState<{ ok: boolean; text: string } | null>(null);
  const [dangLuu, startLuu] = useTransition();
  const mucChon = useMemo(() => muc.filter((m) => chon.has(m.id)), [muc, chon]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await xemTruocAction({ tuNgay: khung.tuNgay, denNgay: khung.denNgay, muc: mucChon, linkThem });
      setXem(r.ok ? { subject: r.subject, html: r.html, tuCam: r.tuCam } : { error: r.error });
    }, 400);
    return () => clearTimeout(t);
  }, [mucChon, linkThem, khung.tuNgay, khung.denNgay]);

  const bat = (id: string) => setChon((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const luu = () => startLuu(async () => {
    const r = await luuNhapAction({ tuNgay: khung.tuNgay, mucIds: [...chon], linkThem });
    setBaoLuu({ ok: r.ok, text: r.ok ? "Đã lưu bản nháp tuần này. Chưa gửi cho ai." : r.error || "Lưu hỏng" });
    if (r.ok) router.refresh();
  });

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2"><Mail className="w-6 h-6" /> Bản tin email tuần</h1>
        <p className="text-sm text-gray-500 mt-1">Gom video YouTube, video fanpage và bài blog mới trong tuần thành một email. Trang này chỉ xem trước và lưu nháp, không gửi cho khách.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-500">Tuần:</span>
        {cacTuan.map((t) => (
          <a key={t.tuNgay} href={`/ban-tin-tuan?tuan=${t.tuNgay}`}
            className={`px-3 py-1.5 rounded-md border ${t.tuNgay === khung.tuNgay ? "bg-[#B5436A] text-white border-[#B5436A]" : "bg-white border-gray-200 hover:border-gray-400"}`}>
            {ddmm(t.tuNgay)} - {ddmm(t.denNgay)}
          </a>
        ))}
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex gap-2">
        <ShieldCheck className="w-5 h-5 shrink-0" />
        <div>
          Máy không tự gửi. Tệp email hiện có {dem.tong.toLocaleString("vi-VN")} địa chỉ, trong đó {dem.duocGui.toLocaleString("vi-VN")} địa chỉ đã tick đồng ý nhận tin (được phép gửi theo NĐ 330).
          Muốn gửi thật phải có lệnh CEO; khi gửi máy đi qua cổng gửi chung (link huỷ, nhãn QC, trần nhịp 1 thư/2 ngày).
          {nhap && <> Bản nháp tuần này lưu lúc {new Date(nhap.luc).toLocaleString("vi-VN")}{nhap.nguoi ? ` bởi ${nhap.nguoi}` : ""}.</>}
        </div>
      </div>

      {loi.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <div className="font-semibold flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Nguồn đọc hỏng (các nguồn khác vẫn chạy)</div>
          <ul className="list-disc ml-5 mt-1">{loi.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="bg-white border border-gray-100 rounded-lg p-4">
            <div className="font-semibold mb-2">Mục trong tuần ({muc.length}) · đang chọn {chon.size}</div>
            {muc.length === 0 && <p className="text-sm text-gray-500">Tuần này chưa có video hay bài blog mới.</p>}
            <ul className="space-y-2">
              {muc.map((m) => (
                <li key={m.id} className="flex gap-3 items-start">
                  <input type="checkbox" className="mt-1" checked={chon.has(m.id)} onChange={() => bat(m.id)} aria-label={m.tieuDe} />
                  {m.anh ? <img src={m.anh} alt="" className="w-20 h-12 object-cover rounded" /> : <div className="w-20 h-12 rounded bg-gray-100" />}
                  <div className="min-w-0 text-sm">
                    <div className="font-medium flex items-center gap-1"><IconLoai loai={m.loai} /> <a href={m.url} target="_blank" rel="noreferrer" className="hover:underline truncate">{m.tieuDe}</a></div>
                    <div className="text-xs text-gray-500">{m.nguon} · {ddmm(m.ngay)}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white border border-gray-100 rounded-lg p-4">
            <label className="font-semibold text-sm" htmlFor="link-them">Chọn thêm (mỗi dòng: Tiêu đề | link)</label>
            <p className="text-xs text-gray-500 mb-2">Ví dụ video BOD khen hay, video kênh đối tác đã xin phép. Link Facebook không lấy được ảnh nên thư chỉ hiện tiêu đề và nút xem.</p>
            <textarea id="link-them" value={linkThem} onChange={(e) => setLinkThem(e.target.value)} rows={4}
              className="w-full border border-gray-200 rounded-md p-2 text-sm" placeholder="Bữa sáng 5 phút cho người bận | https://www.facebook.com/..." />
          </div>

          <div className="flex items-center gap-3">
            <button onClick={luu} disabled={dangLuu || !!xem.tuCam?.length}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#B5436A] text-white font-semibold disabled:opacity-50">
              <Save className="w-4 h-4" /> {dangLuu ? "Đang lưu..." : "Lưu bản nháp"}
            </button>
            {baoLuu && <span className={`text-sm ${baoLuu.ok ? "text-emerald-700" : "text-red-700"}`}>{baoLuu.text}</span>}
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-lg p-4">
          <div className="text-xs text-gray-500">Tiêu đề thư</div>
          <div className="font-semibold mb-2">{xem.subject || "..."}</div>
          {xem.tuCam && xem.tuCam.length > 0 && (
            <div className="text-sm text-red-700 mb-2">Còn từ cấm: {xem.tuCam.join(", ")}. Bỏ tick mục đó mới lưu được.</div>
          )}
          {xem.error && <div className="text-sm text-red-700 mb-2">{xem.error}</div>}
          <iframe title="Xem trước bản tin" srcDoc={xem.html || ""} sandbox="" className="w-full h-[900px] border border-gray-100 rounded-md bg-white" />
        </div>
      </div>
    </div>
  );
}
