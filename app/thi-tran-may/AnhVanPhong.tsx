"use client";

import type { MayChay, TrangThai } from "@/lib/may-chay-ngam";
import { timPhong, type MaPhong } from "@/lib/thi-tran";
import type { PhongLive, ThiTranData } from "@/lib/thi-tran-server";
import { useLang } from "@/components/lang-provider";

const LUOI: MaPhong[] = ["th", "mkt", "kd", "cskh", "tlgd", "vhsp", "ns", "tc", "kt"];
const AO: Record<TrangThai, string> = { chay: "#10B981", chet: "#F43F5E", "chua-ro": "#94A3B8", tat: "#64748B" };

const CHO_BAN: [number, number][] = [[31, 40], [41, 40], [61, 45], [72, 46], [24, 60], [35, 64], [56, 69], [68, 73]];
const CHO_GIAM_DOC: [number, number][] = [[47, 40], [30, 66], [52, 70], [70, 57]];

const SO_NGUOI = 9;
const anhNguoi = (phong: number, i: number) => `/thi-tran-may/anh/nguoi/n${((phong * 4 + i * 5) % SO_NGUOI) + 1}.webp`;

function Nguoi({ anh, m, x, y, to, chon, onChon }: { anh: string; m: MayChay; x: number; y: number; to: number; chon: boolean; onChon: (m: MayChay) => void }) {
  const tat = m.trangThai === "tat" || m.trangThai === "chua-ro";
  const { t } = useLang();
  return (
    <button type="button" title={`${t(m.ten)}: ${m.ghiChu}`} onClick={(e) => { e.stopPropagation(); onChon(m); }}
      className="absolute -translate-x-1/2 -translate-y-full group" style={{ left: `${x}%`, top: `${y}%`, height: `${to}%`, zIndex: Math.round(y) }}>
      <span className="absolute rounded-[50%]" style={{ bottom: "-3%", left: "20%", width: "110%", height: "9%", background: "rgba(40,28,18,.35)", filter: "blur(2px)" }} />
      <span className="absolute left-1/2 -translate-x-1/2 rounded-[50%]"
        style={{ bottom: "-5%", width: "70%", height: "7%", background: AO[m.trangThai], opacity: 0.9, outline: chon ? "2px solid #0F172A" : undefined, outlineOffset: 1 }} />
      {m.trangThai === "chet" && (
        <span className="absolute left-1/2 -translate-x-1/2 rounded-[50%] animate-ping"
          style={{ bottom: "-6%", width: "150%", height: "14%", border: "2px solid #F43F5E" }} />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={anh} alt="" draggable={false}
        className="relative h-full w-auto max-w-none transition-transform group-hover:-translate-y-[3%]"
        style={{ filter: tat ? "grayscale(1) opacity(.55)" : undefined }} />
    </button>
  );
}

function Phong({ id, pl, lon, canAnh, mayChon, onMo, onChonMay }: {
  id: MaPhong; pl: PhongLive; lon: boolean; canAnh: number; mayChon: MayChay | null; onMo: () => void; onChonMay: (m: MayChay) => void;
}) {
  const p = timPhong(id)!;
  const giua = id === "tlgd";
  const cho = giua ? CHO_GIAM_DOC : CHO_BAN;
  const may = pl.boPhan.flatMap((b) => b.may)
    .sort((a, b) => (a.trangThai === "chet" ? 0 : 1) - (b.trangThai === "chet" ? 0 : 1)).slice(0, cho.length);
  const choAnh = pl.dem.grokChoAnh + canAnh > 0;
  const { t } = useLang();
  return (
    <div role="button" tabIndex={0} onClick={onMo} onKeyDown={(e) => { if (e.key === "Enter") onMo(); }}
      className="relative rounded-lg overflow-hidden cursor-pointer"
      style={{ background: "#ffffff", border: `2px solid ${pl.dem.dut ? "#F43F5E" : "var(--ttm-vien)"}` }}>
      <div className="relative w-full" style={{ aspectRatio: "3 / 2" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/thi-tran-may/anh/${id}.webp`} alt={t(p.ten)} draggable={false} className="absolute inset-0 w-full h-full object-cover select-none" />
        {may.map((m, i) => (
          <Nguoi key={m.key} anh={anhNguoi(LUOI.indexOf(id), i)} m={m} x={cho[i][0]} y={cho[i][1]} to={giua ? 15 : 14} chon={mayChon?.key === m.key} onChon={onChonMay} />
        ))}
      </div>
      <div className={`absolute left-2 top-2 flex items-center gap-1.5 rounded-md bg-white/95 text-slate-900 shadow ${lon ? "px-2.5 py-1 text-[13px]" : "px-2 py-0.5 text-[12px]"} font-bold`}
        style={{ border: `2px solid ${pl.dem.dut ? "#F43F5E" : p.mau}` }}>
        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: p.mau }} />
        {giua ? t("Giám đốc + MausBot") : t(p.ngan)}
        <span className="font-semibold opacity-60 tabular-nums">{pl.dem.chay}/{pl.dem.may}</span>
        {pl.dem.dut > 0 && <span className="rounded-md bg-rose-500 text-white px-1.5 text-[11px]">{pl.dem.dut} {t("đứt")}</span>}
        {choAnh && <span className="rounded-md bg-amber-100 text-amber-800 px-1.5 text-[11px]">{t("chờ anh")}</span>}
      </div>
    </div>
  );
}

export default function AnhVanPhong({ d, chon, mayChon, onMo, onToanCanh, onChonMay }: {
  d: ThiTranData; chon: MaPhong | null; mayChon: MayChay | null;
  onMo: (id: MaPhong) => void; onToanCanh: () => void; onChonMay: (m: MayChay) => void;
}) {
  const canAnh = new Map<string, number>();
  for (const x of d.vong.deXuat) if (x.canAnh) canAnh.set(x.phong, (canAnh.get(x.phong) || 0) + 1);
  const live = (id: MaPhong) => d.phong.find((x) => x.id === id)!;
  const { t } = useLang();
  return (
    <div className="p-3">
      <div className="flex flex-wrap gap-1.5 mb-3">
        <button type="button" onClick={onToanCanh}
          className={`rounded-md px-2.5 py-1 text-[12px] border ${!chon ? "bg-teal-600 text-white border-teal-600" : ""}`}
          style={chon ? { background: "var(--ttm-nen)", borderColor: "var(--ttm-vien)" } : undefined}>{t("Cả tầng")}</button>
        {LUOI.map((id) => {
          const p = timPhong(id)!;
          return (
            <button key={id} type="button" onClick={() => onMo(id)}
              className="rounded-md px-2.5 py-1 text-[12px] border inline-flex items-center gap-1.5"
              style={{ background: chon === id ? p.mau : "var(--ttm-nen)", color: chon === id ? "#fff" : undefined, borderColor: chon === id ? p.mau : "var(--ttm-vien)" }}>
              <span className="w-2 h-2 rounded-sm" style={{ background: chon === id ? "#fff" : p.mau }} />
              {id === "tlgd" ? t("Giám đốc") : t(p.ngan)}
            </button>
          );
        })}
      </div>
      {chon ? (
        <Phong id={chon} pl={live(chon)} lon canAnh={canAnh.get(chon) || 0} mayChon={mayChon} onMo={() => {}} onChonMay={onChonMay} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {LUOI.map((id) => (
            <Phong key={id} id={id} pl={live(id)} lon={false} canAnh={canAnh.get(id) || 0} mayChon={mayChon} onMo={() => onMo(id)} onChonMay={onChonMay} />
          ))}
        </div>
      )}
      <div className="mt-2 text-[11px] opacity-70">{t("Bấm phòng để phóng to · bấm người để xem máy · chấm dưới chân: xanh chạy, đỏ đứt, xám tắt")}</div>
    </div>
  );
}
