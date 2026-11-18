"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Download, RefreshCw, Loader2 } from "lucide-react";
import {
  CLIP_TOI_DA, DUOI_CLIP, MANH_BYTES, NHAN_TRANG_THAI, SO_BAN_TOI_DA, VIEC_MOI_NGAY, kiemDauVaoTao, type ViecCongKhai,
} from "@/lib/xuong-video";

const goi = async (duong: string, than: unknown) => {
  const r = await fetch(duong, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(than) });
  const j = await r.json().catch(() => ({ ok: false, loi: "Máy chủ không trả lời" }));
  return j as any;
};

function dayManh(url: string, manh: Blob, tienDo: (da: number) => void, lan = 0): Promise<void> {
  return new Promise<void>((xong, hong) => {
    const x = new XMLHttpRequest();
    x.open("PUT", url);
    x.setRequestHeader("Content-Type", "application/octet-stream");
    x.setRequestHeader("x-upsert", "true");
    x.upload.onprogress = (e) => tienDo(e.loaded);
    x.onload = () => (x.status >= 200 && x.status < 300 ? xong() : hong(new Error("kho từ chối mảnh (" + x.status + ")")));
    x.onerror = () => hong(new Error("mất mạng giữa chừng"));
    x.send(manh);
  }).catch((e) => { if (lan < 2) return dayManh(url, manh, tienDo, lan + 1); throw e; });
}

export default function XuongClient({ ma, ten }: { ma: string; ten: string }) {
  const [viec, setViec] = useState<ViecCongKhai[] | null>(null);
  const [sanPham, setSanPham] = useState("");
  const [yChinh, setYChinh] = useState("");
  const [soBan, setSoBan] = useState(2);
  const [file, setFile] = useState<File | null>(null);
  const [dangGui, setDangGui] = useState(false);
  const [phanTram, setPhanTram] = useState(0);
  const [loi, setLoi] = useState("");
  const [baoXong, setBaoXong] = useState("");
  const oFile = useRef<HTMLInputElement>(null);

  const nap = useCallback(async () => {
    const j = await goi("/api/xuong-video/cua-toi", { ma });
    if (j.ok) setViec(j.viec); else setLoi(j.loi || "Không đọc được danh sách");
  }, [ma]);
  useEffect(() => { nap(); const t = setInterval(nap, 60000); return () => clearInterval(t); }, [nap]);

  async function gui() {
    setLoi(""); setBaoXong("");
    if (!file) { setLoi("Chưa chọn clip"); return; }
    const kt = kiemDauVaoTao({ san_pham: sanPham, y_chinh: yChinh, so_ban: soBan, ten: file.name, bytes: file.size });
    if (!kt.ok) { setLoi(kt.loi); return; }
    setDangGui(true); setPhanTram(0);
    try {
      const t = await goi("/api/xuong-video/tao", { ma, san_pham: sanPham, y_chinh: yChinh, so_ban: soBan, ten: file.name, bytes: file.size });
      if (!t.ok) throw new Error(t.loi || "Không gửi được");
      const links: string[] = t.links;
      for (let i = 0; i < links.length; i++) {
        const manh = file.slice(i * MANH_BYTES, Math.min(file.size, (i + 1) * MANH_BYTES));
        await dayManh(links[i], manh, (da) => setPhanTram(Math.round(((i * MANH_BYTES + da) / file.size) * 100)));
      }
      const x = await goi("/api/xuong-video/xong", { ma, id: t.id });
      if (!x.ok) throw new Error(x.loi || "Clip tải lên chưa đủ");
      setBaoXong("Đã nhận clip. Video sẽ hiện ở danh sách bên dưới sau khi dựng xong và được ACME duyệt.");
      setFile(null); if (oFile.current) oFile.current.value = "";
      nap();
    } catch (e: any) { setLoi(String(e?.message || e)); }
    finally { setDangGui(false); }
  }

  const o = "mt-1 w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-rose-500 dark:border-neutral-700";
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <div className="text-sm font-medium text-rose-600">NOVA by ACME</div>
      <h1 className="mt-1 text-2xl font-semibold">Xưởng video</h1>
      <p className="mt-1 text-sm text-neutral-500">Đại lý: {ten}</p>

      <section className="mt-6 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="text-base font-semibold">Gửi clip để dựng video</h2>
        <label className="mt-4 block text-sm font-medium">Tên sản phẩm trong clip
          <input className={o} value={sanPham} maxLength={80} onChange={(e) => setSanPham(e.target.value)} disabled={dangGui} />
        </label>
        <label className="mt-4 block text-sm font-medium">Ý chính muốn video nói tới (mỗi dòng một ý, có thể để trống)
          <textarea className={o} rows={4} value={yChinh} maxLength={600} onChange={(e) => setYChinh(e.target.value)} disabled={dangGui} />
        </label>
        <label className="mt-4 block text-sm font-medium">Số bản video
          <select className={o} value={soBan} onChange={(e) => setSoBan(Number(e.target.value))} disabled={dangGui}>
            {Array.from({ length: SO_BAN_TOI_DA }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} bản</option>)}
          </select>
        </label>
        <label className="mt-4 block text-sm font-medium">Clip quay thật ({DUOI_CLIP.join(", ")}, tối đa {Math.round(CLIP_TOI_DA / 1048576)} MB)
          <input ref={oFile} type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm" className="mt-1 block w-full text-sm"
            onChange={(e) => setFile(e.target.files?.[0] || null)} disabled={dangGui} />
        </label>
        {dangGui && (
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800"><div className="h-2 bg-rose-600" style={{ width: `${phanTram}%` }} /></div>
            <div className="mt-1 text-xs tabular-nums text-neutral-500">Đang tải lên {phanTram}%. Giữ nguyên trang này tới khi xong.</div>
          </div>
        )}
        {loi && <div role="alert" className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{loi}</div>}
        {baoXong && <div role="status" className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{baoXong}</div>}
        <button onClick={gui} disabled={dangGui} className="mt-5 inline-flex items-center gap-2 rounded-md bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-60">
          {dangGui ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Gửi clip
        </button>
        <p className="mt-3 text-xs text-neutral-500">Mỗi ngày gửi tối đa {VIEC_MOI_NGAY} clip. Video chỉ hiện ở đây sau khi ACME duyệt.</p>
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Clip đã gửi</h2>
          <button onClick={nap} className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-3 py-1.5 text-xs hover:border-rose-500 dark:border-neutral-700"><RefreshCw size={13} /> Tải lại</button>
        </div>
        {viec === null ? <p className="mt-3 text-sm text-neutral-500">Đang đọc…</p>
          : viec.length === 0 ? <p className="mt-3 text-sm text-neutral-500">Chưa có clip nào.</p>
          : (
            <ul className="mt-3 space-y-3">
              {viec.map((v) => (
                <li key={v.id} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="text-sm font-medium">{v.san_pham}</div>
                    <div className="text-xs text-neutral-500">{new Date(v.tao_luc).toLocaleString("vi-VN")}</div>
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">{v.file_ten}</div>
                  <div className="mt-2 text-sm">{NHAN_TRANG_THAI[v.trang_thai]}</div>
                  {v.video.length > 0 && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {v.video.map((k) => (
                        <div key={k.url}>
                          <video src={k.url} controls preload="metadata" playsInline className="aspect-[9/16] w-full rounded-md bg-black" />
                          <a href={k.url} download className="mt-2 inline-flex items-center gap-1 rounded-md border border-neutral-300 px-3 py-1.5 text-xs hover:border-rose-500 dark:border-neutral-700"><Download size={13} /> Tải {k.ten}</a>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
      </section>
    </main>
  );
}
