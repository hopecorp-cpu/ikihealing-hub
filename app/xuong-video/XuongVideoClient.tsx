"use client";
import { useState, useTransition } from "react";
import { Check, X, KeyRound, Copy, RotateCcw, TriangleAlert } from "lucide-react";
import { NHAN_TRANG_THAI, type ViecXuong } from "@/lib/xuong-video";
import { capMaMoi, thuHoi, quyetVideo, dungLai } from "./actions";

type Ma = { id: string; ten: string; tao_luc: string; thu_hoi?: string };
const gio = (iso?: string) => (iso ? new Date(iso).toLocaleString("vi-VN") : "");

export default function XuongVideoClient({ viec, ma, link, cam, nhip, loiDoc }: {
  viec: ViecXuong[]; ma: Ma[]; link: Record<string, string>; cam: Record<string, string[]>; nhip: any; loiDoc: string;
}) {
  const [cho, chay] = useTransition();
  const [bao, setBao] = useState<{ tot: boolean; chu: string } | null>(null);
  const [linkMoi, setLinkMoi] = useState("");
  const [ten, setTen] = useState("");
  const lam = (f: () => Promise<{ ok: boolean; loi?: string; thongBao?: string; link?: string }>) => chay(async () => {
    const r = await f();
    setBao({ tot: r.ok, chu: r.ok ? r.thongBao || "Xong" : r.loi || "Lỗi" });
    if (r.link) setLinkMoi(r.link);
  });
  const dem = (t: string) => viec.filter((v) => v.trang_thai === t).length;
  const nut = "inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-50";

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <h1 className="text-xl font-semibold">Xưởng video đại lý</h1>
      <p className="mt-1 text-sm text-neutral-500">Đại lý gửi clip qua đường link có mã riêng, máy Mac của ACME dựng, quản lý duyệt chữ rồi đại lý mới tải được.</p>

      {loiDoc && <div role="alert" className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">Đọc dữ liệu lỗi: {loiDoc}</div>}
      {bao && <div role="status" className={`mt-4 rounded-md border px-3 py-2 text-sm ${bao.tot ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-red-300 bg-red-50 text-red-800"}`}>{bao.chu}</div>}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Chờ dựng", dem("cho_dung") + dem("dang_dung")], ["Chờ duyệt", dem("cho_duyet")], ["Đã duyệt", dem("da_duyet")], ["Lỗi", dem("loi")]].map(([n, s]) => (
          <div key={n as string} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <div className="text-xs text-neutral-500">{n}</div><div className="text-2xl font-semibold tabular-nums">{s}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        Máy dựng: {nhip ? `${nhip.ok === false ? "LỖI: " + nhip.loi : "chạy lần cuối"} ${gio(nhip.at)}${nhip.may ? " trên " + nhip.may : ""}` : "chưa chạy lần nào"}
      </p>

      <section className="mt-6 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="flex items-center gap-2 text-base font-semibold"><KeyRound size={16} /> Mã vào cửa của đại lý</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input value={ten} onChange={(e) => setTen(e.target.value)} placeholder="Tên đại lý" maxLength={80}
            className="min-w-[220px] flex-1 rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700" />
          <button disabled={cho || ten.trim().length < 2} onClick={() => lam(async () => { const r = await capMaMoi(ten); if (r.ok) setTen(""); return r; })}
            className={`${nut} border-rose-700 bg-rose-700 text-white`}>Cấp đường link</button>
        </div>
        {linkMoi && (
          <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="font-medium">Đường link của đại lý (chỉ hiện lần này):</div>
            <div className="mt-1 break-all">{linkMoi}</div>
            <button onClick={() => navigator.clipboard?.writeText(linkMoi)} className={`${nut} mt-2 border-amber-400`}><Copy size={13} /> Chép</button>
          </div>
        )}
        <ul className="mt-3 divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
          {ma.length === 0 && <li className="py-2 text-neutral-500">Chưa cấp mã nào. Khi chưa có mã, trang gửi clip đóng với mọi người.</li>}
          {ma.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>{m.ten} <span className="text-xs text-neutral-500">cấp {gio(m.tao_luc)}</span></span>
              {m.thu_hoi ? <span className="text-xs text-neutral-500">đã thu hồi {gio(m.thu_hoi)}</span>
                : <button disabled={cho} onClick={() => { if (confirm(`Thu hồi mã của ${m.ten}? Đường link cũ sẽ hết hiệu lực.`)) lam(() => thuHoi(m.id)); }} className={`${nut} border-neutral-300 dark:border-neutral-700`}>Thu hồi</button>}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-base font-semibold">Hàng việc</h2>
        {viec.length === 0 && <p className="mt-2 text-sm text-neutral-500">Chưa có clip nào được gửi.</p>}
        <ul className="mt-3 space-y-4">
          {viec.map((v) => (
            <li key={v.id} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-sm font-semibold">{v.ten_dai_ly} · {v.san_pham}</div>
                <div className="text-xs text-neutral-500">{gio(v.tao_luc)}</div>
              </div>
              <div className="mt-1 text-xs text-neutral-500">{v.file.ten} · {(v.file.bytes / 1048576).toFixed(1)} MB · {v.so_ban} bản · {NHAN_TRANG_THAI[v.trang_thai]}{v.duyet_boi ? ` · ${v.duyet_boi} duyệt` : ""}</div>
              {v.y_chinh && <div className="mt-2 whitespace-pre-wrap rounded-md bg-neutral-50 p-2 text-xs text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">Ý đại lý ghi: {v.y_chinh}</div>}
              {v.trang_thai === "loi" && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-red-700">
                  <TriangleAlert size={15} /> {v.loi || "lỗi không rõ"}
                  <button disabled={cho} onClick={() => lam(() => dungLai(v.id))} className={`${nut} border-neutral-300 text-neutral-800 dark:border-neutral-700 dark:text-neutral-200`}><RotateCcw size={13} /> Dựng lại</button>
                </div>
              )}
              {(v.ket_qua || []).length > 0 && (
                <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {v.ket_qua!.map((k, i) => {
                    const c = cam[k.path] || [];
                    return (
                      <div key={k.path} className="rounded-md border border-neutral-200 p-2 dark:border-neutral-800">
                        {link[k.path] ? <video src={link[k.path]} controls preload="metadata" playsInline className="aspect-[9/16] w-full rounded bg-black" />
                          : <div className="flex aspect-[9/16] items-center justify-center rounded bg-neutral-100 text-xs text-neutral-500">không có file</div>}
                        <div className="mt-2 text-xs font-medium">{k.ten} · {(k.bytes / 1048576).toFixed(1)} MB</div>
                        <div className="mt-1 max-h-28 overflow-auto text-xs text-neutral-600 dark:text-neutral-400">{k.chu || "(không đọc được chữ trên video)"}</div>
                        {c.length > 0 && <div className="mt-1 text-xs font-medium text-red-700">Từ cấm: {c.join(", ")}</div>}
                        <div className="mt-2 flex items-center gap-2">
                          <button disabled={cho || c.length > 0} onClick={() => lam(() => quyetVideo(v.id, i, true))}
                            className={`${nut} ${k.duyet === true ? "border-emerald-600 bg-emerald-600 text-white" : "border-neutral-300 dark:border-neutral-700"}`}><Check size={13} /> Đạt</button>
                          <button disabled={cho} onClick={() => lam(() => quyetVideo(v.id, i, false))}
                            className={`${nut} ${k.duyet === false ? "border-red-600 bg-red-600 text-white" : "border-neutral-300 dark:border-neutral-700"}`}><X size={13} /> Không đạt</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
