"use client";

import { useLang } from "@/components/lang-provider";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Clock, Maximize2, Minus, Plus, Search, X } from "lucide-react";
import { VUNG, bac, boCuc, khopTim, laMoi, type Canh, type MaVung, type Nut } from "@/lib/do-thi-tri-nho-core";

const W = 900, H = 640;
const MAU: Record<string, string> = Object.fromEntries(VUNG.map((v) => [v.ma, v.mau]));
const TEN_VUNG: Record<string, string> = Object.fromEntries(VUNG.map((v) => [v.ma, v.ten]));

const lucChu = (iso?: string | null) => iso
  ? new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })
  : "";

export default function TriNhoClient({ nut, canh, nguonHong, now }: { nut: Nut[]; canh: Canh[]; nguonHong: string[]; now: number }) {
  const { t: tDich } = useLang();
  const [q, setQ] = useState("");
  const [vung, setVung] = useState<MaVung | null>(null);
  const [chiMoi, setChiMoi] = useState(false);
  const [chon, setChon] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const keo = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const viTri = useMemo(() => boCuc(nut, canh, W, H), [nut, canh]);
  const deg = useMemo(() => bac(canh), [canh]);
  const theoId = useMemo(() => new Map(nut.map((n) => [n.id, n])), [nut]);
  const hangXom = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const [a, b] of canh) { m.set(a, [...(m.get(a) || []), b]); m.set(b, [...(m.get(b) || []), a]); }
    return m;
  }, [canh]);

  const dat = (n: Nut) => khopTim(n, q) && (!vung || n.vung === vung) && (!chiMoi || laMoi(n, now));
  const dangLoc = !!q.trim() || !!vung || chiMoi;
  const soDat = nut.filter(dat).length;
  const tieuDiem = hover || chon;
  const quanh = new Set(tieuDiem ? [tieuDiem, ...(hangXom.get(tieuDiem) || [])] : []);

  const demVung = VUNG.map((v) => ({ ...v, so: nut.filter((n) => n.vung === v.ma).length })).filter((v) => v.so > 0);
  const soMoi = nut.filter((n) => laMoi(n, now)).length;
  const nChon = chon ? theoId.get(chon) : null;

  const tiLe = () => { const r = svgRef.current?.getBoundingClientRect(); return r ? W / r.width : 1; };

  return (
    <div className="space-y-3">
      {nguonHong.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{tDich("Không đọc được:")} <b>{nguonHong.join(", ")}</b>{tDich(". Đồ thị đang thiếu phần của các nguồn này.")}</span>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[250px_minmax(0,1fr)_300px]">
        <aside className="bg-white border border-gray-200 rounded-xl p-3 space-y-3 h-fit">
          <label className="flex items-center gap-2 rounded-lg border border-gray-300 px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-brand-500">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tDich("Tìm, gõ không dấu cũng được")}
              className="w-full text-sm outline-none bg-transparent" />
            {q && <button onClick={() => setQ("")} aria-label={tDich("Xoá tìm")}><X className="w-4 h-4 text-gray-400" /></button>}
          </label>
          <button onClick={() => setChiMoi(!chiMoi)}
            className={`w-full inline-flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-sm ${chiMoi ? "border-brand-500 bg-brand-50 text-brand-700 font-semibold" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
            <span className="inline-flex items-center gap-1.5"><Clock className="w-4 h-4" /> {tDich("Mới")} {48} {tDich("giờ")}</span>
            <span className="text-xs tabular-nums">{soMoi}</span>
          </button>

          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1.5">{tDich("Vùng trí nhớ")}</p>
            <ul className="space-y-1">
              {demVung.map((v) => (
                <li key={v.ma}>
                  <button onClick={() => setVung(vung === v.ma ? null : v.ma)} title={v.goiY}
                    className={`w-full text-left rounded-lg px-2 py-1.5 ${vung === v.ma ? "bg-gray-100" : "hover:bg-gray-50"}`}>
                    <span className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-1.5 text-gray-800"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: v.mau }} />{tDich(v.ten)}</span>
                      <span className="text-xs text-gray-500 tabular-nums">{v.so}</span>
                    </span>
                    <span className="mt-1 block h-1 rounded bg-gray-100 overflow-hidden">
                      <span className="block h-full rounded" style={{ width: `${(v.so / nut.length) * 100}%`, background: v.mau }} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-gray-500 tabular-nums">{nut.length} {tDich("nút ·")} {canh.length} {tDich("mối nối")}{dangLoc ? ` · đang lọc ${soDat}` : ""}</p>
        </aside>

        <div className="relative bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="absolute right-2 top-2 z-10 flex gap-1">
            <button onClick={() => setZoom((z) => Math.min(4, z * 1.25))} className="p-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50" aria-label={tDich("Phóng to")}><Plus className="w-4 h-4" /></button>
            <button onClick={() => setZoom((z) => Math.max(0.5, z / 1.25))} className="p-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50" aria-label={tDich("Thu nhỏ")}><Minus className="w-4 h-4" /></button>
            <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="p-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50" aria-label={tDich("Về giữa")}><Maximize2 className="w-4 h-4" /></button>
          </div>
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto touch-none select-none cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => { if ((e.target as Element).tagName === "svg") { keo.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; setChon(null); } }}
            onPointerMove={(e) => { const k = keo.current; if (!k) return; const t = tiLe(); setPan({ x: k.px + (e.clientX - k.x) * t, y: k.py + (e.clientY - k.y) * t }); }}
            onPointerUp={() => { keo.current = null; }} onPointerLeave={() => { keo.current = null; }}>
            <g transform={`translate(${pan.x + (W / 2) * (1 - zoom)} ${pan.y + (H / 2) * (1 - zoom)}) scale(${zoom})`}>
              {canh.map(([a, b]) => {
                const p = viTri.get(a), r = viTri.get(b);
                if (!p || !r) return null;
                const sang = tieuDiem ? quanh.has(a) && quanh.has(b) : false;
                const mo = dangLoc && !(dat(theoId.get(a)!) || dat(theoId.get(b)!));
                const mx = (p.x + r.x) / 2 - (r.y - p.y) * 0.14, my = (p.y + r.y) / 2 + (r.x - p.x) * 0.14;
                return <path key={`${a}|${b}`} d={`M${p.x},${p.y} Q${mx},${my} ${r.x},${r.y}`} fill="none"
                  stroke={sang ? MAU[theoId.get(a)!.vung] : "#cbd5e1"} strokeWidth={sang ? 1.6 / zoom : 0.8 / zoom}
                  opacity={tieuDiem && !sang ? 0.15 : mo ? 0.12 : 0.7} />;
              })}
              {nut.map((n) => {
                const p = viTri.get(n.id);
                if (!p) return null;
                const d = deg.get(n.id) || 0;
                const r = Math.min(9, 3 + Math.sqrt(d) * 1.2);
                const mo = (dangLoc && !dat(n)) || (tieuDiem && !quanh.has(n.id));
                const hienTen = n.vung === "agent" || n.id === tieuDiem || (tieuDiem && quanh.has(n.id)) || zoom >= 2;
                return (
                  <g key={n.id} transform={`translate(${p.x} ${p.y})`} opacity={mo ? 0.15 : 1} className="cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); setChon(n.id); }}
                    onPointerEnter={() => setHover(n.id)} onPointerLeave={() => setHover(null)}>
                    {d >= 6 && <circle r={r + 4} fill={MAU[n.vung]} opacity={0.15} />}
                    <circle r={r} fill={MAU[n.vung]} stroke={n.hong ? "#dc2626" : n.id === chon ? "#111827" : "#fff"} strokeWidth={(n.hong || n.id === chon ? 2 : 1) / zoom} />
                    {hienTen && (
                      <text x={r + 3} y={3.5} fontSize={11 / zoom} fill="#1f2937" stroke="#fff" strokeWidth={3 / zoom} paintOrder="stroke">
                        {tDich(n.ten).length > 34 ? `${tDich(n.ten).slice(0, 33)}…` : tDich(n.ten)}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
          <p className="px-3 py-2 text-xs text-gray-400 border-t border-gray-100">{tDich("Kéo nền để di chuyển, bấm một nút để xem chi tiết và các mối nối của nó.")}</p>
        </div>

        <aside className="bg-white border border-gray-200 rounded-xl p-4 h-fit">
          {!nChon ? (
            <p className="text-sm text-gray-500">{tDich("Bấm một nút trên đồ thị để xem nó là gì, nối với ai.")}</p>
          ) : (
            <div className="space-y-3">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: MAU[nChon.vung] }}>
                  <span className="w-2 h-2 rounded-sm" style={{ background: MAU[nChon.vung] }} />{TEN_VUNG[nChon.vung]}
                </span>
                <p className="mt-1 font-semibold text-gray-900 break-words">{tDich(nChon.ten)}</p>
                {nChon.tom && <p className="mt-1 text-sm text-gray-600 break-words">{nChon.tom}</p>}
                {nChon.luc && <p className="mt-1 text-xs text-gray-400">{lucChu(nChon.luc)}</p>}
              </div>
              {nChon.link && (
                <Link href={nChon.link} className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                  {tDich("Mở trang")} <ArrowUpRight className="w-4 h-4" />
                </Link>
              )}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">{tDich("Nối với (")}{(hangXom.get(nChon.id) || []).length})</p>
                <ul className="space-y-0.5 max-h-80 overflow-auto">
                  {(hangXom.get(nChon.id) || []).map((id) => theoId.get(id)).filter(Boolean).map((x) => (
                    <li key={x!.id}>
                      <button onClick={() => setChon(x!.id)} className="w-full text-left flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-gray-700 hover:bg-gray-50">
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: MAU[x!.vung] }} />
                        <span className="truncate">{tDich(x!.ten)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
