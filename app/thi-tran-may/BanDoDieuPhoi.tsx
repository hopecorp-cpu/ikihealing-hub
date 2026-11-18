"use client";

import { Bot, MessageCircle } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { timPhong, type MaPhong, type Phong } from "@/lib/thi-tran";
import type { PhongLive, ThiTranData } from "@/lib/thi-tran-server";

const VI_TRI: Record<Exclude<MaPhong, "tlgd">, [number, number]> = {
  th: [150, 92], mkt: [500, 72], kd: [850, 92],
  cskh: [118, 320], vhsp: [882, 320],
  ns: [150, 548], tc: [500, 568], kt: [850, 548],
};
const W = 1000, H = 640, TAM: [number, number] = [500, 320];

type TrangThaiPhong = { nhan: string; lop: string; mau: string; huong: "ra" | "ve" | "dung" };

function trangThai(pl: PhongLive, canAnh: number, mau: string): TrangThaiPhong {

  if (pl.dem.grokKet > 0) return { nhan: "Có việc kẹt", lop: "bg-rose-100 text-rose-700", mau: "#F43F5E", huong: "ve" };
  if (pl.dem.grokChoAnh > 0 || canAnh > 0) return { nhan: "Chờ anh duyệt", lop: "bg-amber-100 text-amber-800", mau: "#F59E0B", huong: "ve" };
  if (pl.dem.grokDangChay > 0 || pl.daGiao.length > 0) return { nhan: "Đang làm việc giao", lop: "bg-sky-100 text-sky-800", mau, huong: "ra" };
  if (pl.dem.dut > 0) return { nhan: "Có máy đứt", lop: "bg-rose-100 text-rose-700", mau: "#F43F5E", huong: "dung" };
  return { nhan: "Tự chạy", lop: "bg-emerald-100 text-emerald-700", mau: "#10B981", huong: "dung" };
}

function rutGon(s: string, n: number) {
  const t = (s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

function TheAgent({ p, pl, tt, onMo, onChat, nho }: {
  p: Phong; pl: PhongLive; tt: TrangThaiPhong; onMo: () => void; onChat: () => void; nho?: boolean;
}) {
  const viec = pl.viecGrok.find((v) => v.trangThai !== "xong");
  const { t } = useLang();
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onMo}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onMo(); } }}
      aria-label={`${t(p.ten)} — ${t(tt.nhan)}`}
      className={`ttm-phong group relative rounded-lg cursor-pointer text-left ${nho ? "" : "w-full"}`}
      style={{ background: "var(--ttm-nen)", border: "1px solid var(--ttm-vien)", borderTop: `3px solid ${p.mau}`, boxShadow: "0 8px 22px -14px rgba(15,23,42,.45)" }}
    >
      <div className="flex items-start gap-2 p-2">
        <img src={`/thi-tran-may/tang/${p.id}.webp`} alt="" className="w-9 h-9 object-contain shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[12.5px] leading-tight truncate">{t(p.ten)}</div>
          <div className="text-[11px] opacity-60 truncate">{t(p.moTa)}</div>
        </div>
        <button type="button" onClick={(e) => { e.stopPropagation(); onChat(); }} aria-label={`${t("Trò chuyện với")} ${t(p.ngan)}`} title={t("Trò chuyện, giao việc")}
          className="p-1 rounded-md opacity-50 hover:opacity-100 shrink-0"><MessageCircle className="w-3.5 h-3.5" /></button>
      </div>
      <div className="px-2 pb-2 space-y-1">
        <div className="flex flex-wrap items-center gap-1 text-[10.5px]">
          <span className={`rounded-md px-1.5 py-0.5 font-semibold ${tt.lop}`}>{t(tt.nhan)}</span>
          <span className="tabular-nums opacity-70">{t("máy")} {pl.dem.chay}/{pl.dem.may}</span>
          {pl.dem.grokDangChay > 0 && <span className="tabular-nums opacity-70">· {pl.dem.grokDangChay} {t("việc chạy")}</span>}
          {pl.dem.dut > 0 && tt.nhan !== "Có máy đứt" && <span className="tabular-nums text-rose-600 font-semibold">· {pl.dem.dut} {t("máy đứt")}</span>}
        </div>
        <div className="text-[11px] opacity-75 truncate">{viec ? rutGon(viec.moTa || viec.ma, 60) : t("MausBot chưa giao việc")}</div>
      </div>
    </div>
  );
}

export default function BanDoDieuPhoi({ d, onMo, onChat }: { d: ThiTranData; onMo: (id: MaPhong) => void; onChat: (id: MaPhong) => void }) {
  const canAnhTheoPhong = new Map<string, number>();
  for (const x of d.vong.deXuat) if (x.canAnh) canAnhTheoPhong.set(x.phong, (canAnhTheoPhong.get(x.phong) || 0) + 1);
  const phong = (Object.keys(VI_TRI) as Exclude<MaPhong, "tlgd">[]).map((id) => {
    const p = timPhong(id)!;
    const pl = d.phong.find((x) => x.id === id)!;
    return { id, p, pl, tt: trangThai(pl, canAnhTheoPhong.get(id) || 0, p.mau), xy: VI_TRI[id] };
  });
  const sum = (f: (pl: PhongLive) => number) => d.phong.reduce((n, pl) => n + f(pl), 0);
  const dangLam = sum((pl) => pl.dem.grokDangChay) + (d.tongQuan.claude?.dangLam || 0);
  const choAnh = sum((pl) => pl.dem.grokChoAnh) + d.vong.deXuat.filter((x) => x.canAnh).length + d.tongQuan.choDuyet;
  const ket = sum((pl) => pl.dem.grokKet) + d.dem.chet;
  const tlgd = d.phong.find((x) => x.id === "tlgd")!;
  const { t } = useLang();

  return (
    <div className="p-3 sm:p-5">
      <style>{`
        @keyframes ttm-chay { to { stroke-dashoffset: -24 } }
        .ttm-chay { animation: ttm-chay 1s linear infinite; }
        .ttm-ve { animation-direction: reverse; }
        @media (prefers-reduced-motion: reduce) { .ttm-chay { animation: none } }
      `}</style>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {([
          ["Đang làm", dangLam, "text-sky-700"],
          ["Chờ anh duyệt", choAnh, choAnh ? "text-amber-700" : ""],
          ["Kẹt / đứt", ket, ket ? "text-rose-600" : ""],
          ["Máy đang chạy", `${d.dem.chay}/${d.dem.tong}`, "text-emerald-700"],
        ] as const).map(([nhan, so, mau]) => (
          <div key={nhan} className="rounded-lg px-3 py-2" style={{ background: "var(--ttm-nen)", border: "1px solid var(--ttm-vien)" }}>
            <div className={`text-[18px] font-bold tabular-nums leading-none ${mau}`}>{so}</div>
            <div className="text-[11px] opacity-65 mt-1">{t(nhan)}</div>
          </div>
        ))}
      </div>

      <div className="hidden md:block relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full" aria-hidden>
          {phong.map(({ id, tt, xy }) => {
            const chay = tt.huong !== "dung";
            const duong = `M${TAM[0]},${TAM[1]} L${xy[0]},${xy[1]}`;
            return (
              <g key={id}>
                <path d={duong} stroke={chay || tt.nhan === "Có máy đứt" ? tt.mau : "var(--ttm-vien)"} strokeWidth={chay ? 2.2 : 1.4} fill="none"
                  strokeDasharray={chay ? "8 4" : tt.nhan === "Có máy đứt" ? "3 5" : undefined} className={chay ? `ttm-chay ${tt.huong === "ve" ? "ttm-ve" : ""}` : undefined} />
                {chay && (
                  <circle r={5} fill={tt.mau}>
                    <animateMotion dur="2.4s" repeatCount="indefinite" path={duong} keyPoints={tt.huong === "ra" ? "0;1" : "1;0"} keyTimes="0;1" calcMode="linear" />
                  </circle>
                )}
              </g>
            );
          })}
        </svg>

        <div className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center" style={{ left: `${(TAM[0] / W) * 100}%`, top: `${(TAM[1] / H) * 100}%` }}>
          <button type="button" onClick={() => onMo("tlgd")} aria-label={t("MausBot điều phối — mở phòng Giám đốc")}
            className="relative w-[132px] h-[104px] rounded-lg flex flex-col items-center justify-center text-white shadow-lg"
            style={{ background: "radial-gradient(circle at 35% 30%, #38BDF8, #0369A1)", boxShadow: "0 0 0 8px rgba(14,165,233,.15), 0 12px 30px -10px rgba(3,105,161,.6)" }}>
            <Bot className="w-7 h-7" />
            <span className="text-[13px] font-bold mt-1">{t("MausBot điều phối")}</span>
            <span className="text-[10.5px] opacity-85">{t("Giám đốc duyệt cuối")}</span>
          </button>
          <div className="mt-2 rounded-md px-2 py-0.5 text-[11px] font-semibold" style={{ background: "var(--ttm-nen)", border: "1px solid var(--ttm-vien)" }}>
            {t("Trợ lý GĐ: máy")} {tlgd.dem.chay}/{tlgd.dem.may}{choAnh ? ` · ${choAnh} ${t("chờ anh")}` : ""}
          </div>
        </div>

        {phong.map(({ id, p, pl, tt, xy }) => (
          <div key={id} className="absolute -translate-x-1/2 -translate-y-1/2 w-[23%]" style={{ left: `${(xy[0] / W) * 100}%`, top: `${(xy[1] / H) * 100}%` }}>
            <TheAgent p={p} pl={pl} tt={tt} onMo={() => onMo(id)} onChat={() => onChat(id)} />
          </div>
        ))}
      </div>

      <div className="md:hidden space-y-2">
        <button type="button" onClick={() => onMo("tlgd")} className="w-full rounded-lg p-3 flex items-center gap-3 text-white text-left"
          style={{ background: "linear-gradient(135deg, #0EA5E9, #0369A1)" }}>
          <Bot className="w-7 h-7 shrink-0" />
          <span><b className="block text-[13.5px]">{t("MausBot điều phối")}</b><span className="text-[11.5px] opacity-90">{choAnh ? `${choAnh} ${t("việc chờ anh duyệt")}` : t("Không việc nào chờ anh")}</span></span>
        </button>
        {phong.map(({ id, p, pl, tt }) => (
          <div key={id} className="pl-3" style={{ borderLeft: `2px ${tt.huong === "dung" ? "solid" : "dashed"} ${tt.huong === "dung" ? "var(--ttm-vien)" : tt.mau}` }}>
            <TheAgent p={p} pl={pl} tt={tt} onMo={() => onMo(id)} onChat={() => onChat(id)} />
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] opacity-75">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed border-sky-500" />{t("chấm chạy ra: MausBot đang giao việc")}</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed border-amber-500" />{t("chấm chạy về: chờ anh duyệt")}</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed border-rose-500" />{t("đỏ chạy về: việc kẹt; đỏ chấm đứng: máy đứt")}</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-5 border-t" style={{ borderColor: "var(--ttm-vien)" }} />{t("nét mảnh: tự chạy, không có việc")}</span>
      </div>
    </div>
  );
}
