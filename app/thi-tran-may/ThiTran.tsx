"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, RotateCw, X, Server, Laptop, Sun, Moon, Monitor, Play, Pause, Bot, ArrowLeft,
  Send, ClipboardCheck, ExternalLink, MessageCircle, LayoutGrid, Trash2,
} from "lucide-react";
import type { MayChay, TrangThai } from "@/lib/may-chay-ngam";
import type { TrangThai as TrangThaiGrok } from "@/lib/bang-viec";
import { MOI_PHONG, timPhong, type MaPhong, type Phong } from "@/lib/thi-tran";
import type { PhongLive, ThiTranData } from "@/lib/thi-tran-server";
import type { DeXuat } from "@/lib/thi-tran-phan-hoi";
import BanDoDieuPhoi from "./BanDoDieuPhoi";
import AnhVanPhong from "./AnhVanPhong";
import dynamic from "next/dynamic";
import { useLang } from "@/components/lang-provider";
import { dichSo, type TDich } from "@/lib/i18n";

const VanPhong3D = dynamic(() => import("./VanPhong3D"), { ssr: false, loading: () => <DangDung3D /> });
function DangDung3D() { const { t } = useLang(); return <div className="p-6 text-[13px] opacity-70">{t("Đang dựng văn phòng 3D…")}</div>; }

const anhTang = (id: MaPhong) => `/thi-tran-may/tang/${id}.webp`;
const anhNguoi = (id: MaPhong) => `/thi-tran-may/tang/nguoi-${id}.webp`;

const AO: Record<TrangThai, string> = { chay: "#10B981", chet: "#F43F5E", "chua-ro": "#94A3B8", tat: "#64748B" };
const CHU_TT: Record<TrangThai, string> = { chay: "Đang chạy", chet: "ĐỨT", "chua-ro": "Chưa ghi mốc", tat: "Tắt theo lệnh" };
const CHU_GROK: Record<TrangThaiGrok, string> = { "cho-anh": "chờ anh", ket: "kẹt", "dang-chay": "đang chạy", xong: "xong" };
const MAU_GROK: Record<TrangThaiGrok, string> = {
  "cho-anh": "bg-amber-100 text-amber-800", ket: "bg-rose-100 text-rose-700",
  "dang-chay": "bg-sky-100 text-sky-800", xong: "bg-emerald-100 text-emerald-700",
};
const CHU_CC: Record<string, string> = { pending: "chờ anh duyệt", approved: "chờ máy làm", running: "đang làm" };

const LUOI: MaPhong[] = ["th", "mkt", "kd", "cskh", "tlgd", "vhsp", "ns", "tc", "kt"];

function rutGon(s: string, n: number) {
  const t = (s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}
function gioTruoc(luc: string, t: TDich) {
  const p = (Date.now() - Date.parse(luc)) / 60000;
  if (!isFinite(p)) return "";
  if (p < 60) return t("{n} phút trước").replace("{n}", String(Math.max(1, Math.round(p))));
  if (p < 48 * 60) return t("{n} giờ trước").replace("{n}", String(Math.round(p / 60)));
  return t("{n} ngày trước").replace("{n}", String(Math.round(p / 1440)));
}

function dichTT(t: TDich, s: string) {
  const m = /^Chờ anh \/duyet (\S+) trên Telegram$/.exec(s);
  if (m) return t("Chờ anh /duyet {id} trên Telegram").replace("{id}", m[1]);
  return dichSo(t, s);
}

type CheDo = "sang" | "toi" | "tu";
type KieuXem = "tang" | "dieu-phoi" | "3d" | "anh";

function IconPhong({ p, to = 28 }: { p: Phong; to?: number }) {
  return <img src={anhTang(p.id)} alt="" width={to} height={to} className="object-contain shrink-0" style={{ width: to, height: to }} />;
}

function Nguoi({ id, cao, xam }: { id: MaPhong; cao: number; xam?: boolean }) {
  return (
    <img src={anhNguoi(id)} alt="" draggable={false} className="select-none pointer-events-none"
      style={{ height: cao, width: "auto", filter: `${xam ? "grayscale(1) " : ""}drop-shadow(0 6px 6px rgba(15,23,42,.25))` }} />
  );
}

function OMay({ m, chon, mo, onChon }: { m: MayChay; chon: boolean; mo: boolean; onChon: () => void }) {
  const dut = m.trangThai === "chet";
  const { t } = useLang();
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onChon(); }}
      title={`${t(m.ten)} — ${t(CHU_TT[m.trangThai])}${m.ghiChu ? ` · ${m.ghiChu}` : ""}`}
      aria-label={`${t(m.ten)} — ${t(CHU_TT[m.trangThai])}`}
      className={`relative w-3.5 h-3.5 rounded-[3px] shrink-0 transition-transform hover:scale-125 ${dut ? "ttm-nhip-o" : ""}`}
      style={{ background: AO[m.trangThai], opacity: mo ? 0.2 : 1, outline: chon ? "2px solid var(--ttm-chu)" : undefined, outlineOffset: 1 }}
    />
  );
}

const bienMauSang = {
  "--ttm-san": "#EEF2F7", "--ttm-o-san": "rgba(100,116,139,.09)", "--ttm-chu": "#1E293B", "--ttm-nen": "#FFFFFF",
  "--ttm-thanh": "rgba(255,255,255,.88)", "--ttm-vien": "rgba(30,41,59,.12)",
} as const;
const bienMauToi = {
  "--ttm-san": "#0B1220", "--ttm-o-san": "rgba(148,163,184,.07)", "--ttm-chu": "#E2E8F0", "--ttm-nen": "#0F172A",
  "--ttm-thanh": "rgba(15,23,42,.85)", "--ttm-vien": "rgba(148,163,184,.25)",
} as const;

export default function ThiTran({ d }: { d: ThiTranData }) {
  const [hienTen, setHienTen] = useState(false);
  const [hienBong, setHienBong] = useState(true);
  const [chiDut, setChiDut] = useState(false);
  const [tuChay, setTuChay] = useState(false);
  const [cheDo, setCheDo] = useState<CheDo>("tu");
  const [toiHeThong, setToiHeThong] = useState(false);
  const [trongPhong, setTrongPhong] = useState<MaPhong | null>(null);
  const [mayChon, setMayChon] = useState<MayChay | null>(null);
  const [tab, setTab] = useState<"phong" | "chat">("phong");
  const [kieuXem, setKieuXem] = useState<KieuXem>("tang");
  const [nhip, setNhip] = useState(0);
  const { t } = useLang();

  useEffect(() => {
    try { const v = localStorage.getItem("ttm-che-do"); if (v === "sang" || v === "toi" || v === "tu") setCheDo(v); } catch {}
    try { const k = localStorage.getItem("ttm-kieu-xem"); if (k === "dieu-phoi" || k === "3d" || k === "anh") setKieuXem(k); } catch {}

    const html = document.documentElement;
    setToiHeThong(html.classList.contains("dark"));
    const ob = new MutationObserver(() => setToiHeThong(html.classList.contains("dark")));
    ob.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => ob.disconnect();
  }, []);
  const doiKieuXem = (v: KieuXem) => { setKieuXem(v); setTrongPhong(null); setMayChon(null); try { localStorage.setItem("ttm-kieu-xem", v); } catch {} };
  const doiCheDo = (v: CheDo) => { setCheDo(v); try { localStorage.setItem("ttm-che-do", v); } catch {} };
  const toi = cheDo === "toi" || (cheDo === "tu" && toiHeThong);

  useEffect(() => { const t = setInterval(() => setNhip((n) => n + 1), 3200); return () => clearInterval(t); }, []);

  const theoId = useMemo(() => new Map(d.phong.map((p) => [p.id, p])), [d.phong]);

  const chuDut = useMemo(() => {
    const m = new Map<string, string>();
    for (const x of d.vong.deXuat) for (const may of x.may) if (!x.canAnh) m.set(may.key, dichTT(t, x.chuTrangThai));
    return (k: string, ghiChu: string) => m.get(k) || ghiChu || t("đứt");
  }, [d.vong, t]);
  const live = (id: MaPhong) => theoId.get(id)!;

  const moPhong = (id: MaPhong) => { setMayChon(null); setTrongPhong(id); };
  const veSoDo = () => { setTrongPhong(null); setMayChon(null); };

  const thuTuTour = useMemo(() => [...d.phong]
    .sort((a, b) => (b.dem.dut * 10 + b.dem.grokChoAnh + b.dem.grokKet) - (a.dem.dut * 10 + a.dem.grokChoAnh + a.dem.grokKet))
    .map((p) => p.id), [d.phong]);
  useEffect(() => {
    if (!tuChay) return;
    let i = 0;
    moPhong(thuTuTour[0]);
    const t = setInterval(() => {
      i = (i + 1) % (thuTuTour.length + 1);
      if (i === thuTuTour.length) veSoDo(); else moPhong(thuTuTour[i]);
    }, 6000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tuChay, thuTuTour]);
  const dungTour = () => setTuChay(false);

  const chonMay = (m: MayChay) => { dungTour(); setMayChon(m); };
  const may = useMemo(() => d.phong.flatMap((p) => p.boPhan.flatMap((b) => b.may)), [d.phong]);
  const grokTong = d.phong.reduce((n, p) => n + p.dem.grokChoAnh + p.dem.grokKet, 0);
  const bienMau = toi ? bienMauToi : bienMauSang;

  return (

    <div className={`grid xl:grid-cols-[1fr_360px] gap-4 ${toi ? "" : "sang-co-dinh"}`} style={bienMau as unknown as React.CSSProperties}>
      <style>{`
        @keyframes ttm-nhip-o { 0%,100% { box-shadow: 0 0 0 0 rgba(244,63,94,.7) } 60% { box-shadow: 0 0 0 5px rgba(244,63,94,0) } }
        .ttm-nhip-o { animation: ttm-nhip-o 1.6s ease-out infinite; }
        @keyframes ttm-vao { from { opacity: 0; transform: scale(.97) } to { opacity: 1; transform: none } }
        .ttm-vao { animation: ttm-vao .3s ease-out both; }
        @keyframes ttm-hien { from { opacity: 0 } to { opacity: 1 } }
        .ttm-hien { animation: ttm-hien .4s ease-out; }
        .ttm-phong { transition: box-shadow .2s ease, transform .2s ease; }
        .ttm-phong:hover { transform: translateY(-2px); }
        @media (prefers-reduced-motion: reduce) { .ttm-nhip-o, .ttm-vao, .ttm-hien, .ttm-phong { animation: none; transition: none } }
      `}</style>

      <div className="rounded-xl overflow-hidden border relative min-w-0" style={{ borderColor: "var(--ttm-vien)", background: "var(--ttm-san)", color: "var(--ttm-chu)" }}>
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 text-[12px] backdrop-blur" style={{ background: "var(--ttm-thanh)", borderBottom: "1px solid var(--ttm-vien)" }}>
          <span className="font-bold text-[13px] mr-1">{t("Tầng văn phòng ACME")}</span>
          <span className="opacity-60 mr-2 hidden sm:inline">{t("9 phòng ban")} · {d.dem.tong} {t("máy")}</span>
          <div className="inline-flex rounded-md border overflow-hidden" style={{ borderColor: "var(--ttm-vien)" }}>
            {([["sang", Sun, "Nền sáng"], ["tu", Monitor, "Theo máy"], ["toi", Moon, "Nền tối"]] as const).map(([v, Ic, nhan]) => (
              <button key={v} title={t(nhan)} aria-label={t(nhan)} onClick={() => doiCheDo(v)}
                className={`px-1.5 py-1 ${cheDo === v ? "bg-teal-600 text-white" : "opacity-70 hover:opacity-100"}`}>
                <Ic className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-md border overflow-hidden" style={{ borderColor: "var(--ttm-vien)" }}>
            {([["tang", "Sơ đồ tầng"], ["dieu-phoi", "Bản đồ điều phối"], ["3d", "Văn phòng 3D"], ["anh", "Ảnh văn phòng"]] as const).map(([v, nhan]) => (
              <button key={v} onClick={() => { dungTour(); doiKieuXem(v); }}
                className={`px-2.5 py-1 ${kieuXem === v && (!trongPhong || v === "3d" || v === "anh") ? "bg-teal-600 text-white" : "opacity-75 hover:opacity-100"}`}>{t(nhan)}</button>
            ))}
          </div>
          <NutBat bat={hienTen} onClick={() => setHienTen((v) => !v)}>{t("Tên")}</NutBat>
          <NutBat bat={hienBong} onClick={() => setHienBong((v) => !v)}>{t("Đang làm gì")}</NutBat>
          <NutBat bat={chiDut} onClick={() => setChiDut((v) => !v)}>{t("Chỉ chỗ đứt")}</NutBat>
          <NutBat bat={!trongPhong && !mayChon} onClick={() => { dungTour(); veSoDo(); }}>{t(kieuXem === "dieu-phoi" ? "Toàn bản đồ" : kieuXem === "3d" ? "Toàn cảnh" : "Cả tầng")}</NutBat>
          <NutBat bat={tuChay} onClick={() => setTuChay((v) => !v)}>
            {tuChay ? <Pause className="w-3.5 h-3.5 inline -mt-0.5" /> : <Play className="w-3.5 h-3.5 inline -mt-0.5" />} {tuChay ? t("Dừng tự chạy") : t("Tự chạy")}
          </NutBat>
          <div className="ml-auto flex flex-wrap gap-1.5 items-center">
            {d.dem.chet > 0 ? <Chip tone="do">{d.dem.chet} {t("đứt")}</Chip> : <Chip tone="xanh">{t("không máy nào đứt")}</Chip>}
            {d.vong.deXuat.some((x) => x.canAnh) && <Chip tone="do">{d.vong.deXuat.filter((x) => x.canAnh).length} {t("chỗ cần anh")}</Chip>}
            {d.tongQuan.choDuyet > 0 && <Chip tone="vang">{d.tongQuan.choDuyet} {t("chờ duyệt")}</Chip>}
          </div>
        </div>

        {kieuXem === "3d" ? (
          <VanPhong3D d={d} toi={toi} chon={trongPhong} mayChon={mayChon}
            onMo={(id) => { dungTour(); setTab("phong"); moPhong(id); }} onToanCanh={() => { dungTour(); veSoDo(); }} onChonMay={chonMay} />
        ) : kieuXem === "anh" ? (
          <AnhVanPhong d={d} chon={trongPhong} mayChon={mayChon}
            onMo={(id) => { dungTour(); setTab("phong"); moPhong(id); }} onToanCanh={() => { dungTour(); veSoDo(); }} onChonMay={chonMay} />
        ) : trongPhong ? (
          <PhongPhongTo
            key={trongPhong}
            p={timPhong(trongPhong)!}
            pl={live(trongPhong)}
            chuDut={chuDut}
            hienBong={hienBong}
            chiDut={chiDut}
            nhip={nhip}
            mayChon={mayChon}
            onChonMay={chonMay}
            onVe={() => { dungTour(); veSoDo(); }}
          />
        ) : kieuXem === "dieu-phoi" ? (
          <BanDoDieuPhoi d={d} onMo={(id) => { dungTour(); setTab("phong"); moPhong(id); }} onChat={(id) => { dungTour(); setTab("chat"); moPhong(id); }} />
        ) : (
          <div
            className="p-3 sm:p-5"
            style={{
              backgroundImage: "linear-gradient(var(--ttm-o-san) 1px, transparent 1px), linear-gradient(90deg, var(--ttm-o-san) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
            onClick={() => setMayChon(null)}
            role="group"
            aria-label={t("Sơ đồ tầng văn phòng 9 phòng ban")}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {LUOI.map((id) => {
                const p = timPhong(id)!;
                const pl = live(id);
                if (id === "tlgd") {
                  return (
                    <BanGiamDoc key={id} p={p} pl={pl} grokTong={grokTong} claude={d.tongQuan.claude}
                      hienTen={hienTen} chiDut={chiDut} mayChon={mayChon}
                      onMo={() => { dungTour(); moPhong(id); }} onChonMay={chonMay} />
                  );
                }
                return (
                  <PhongKinh key={id} p={p} pl={pl} chuDut={chuDut} hienTen={hienTen} hienBong={hienBong} chiDut={chiDut}
                    nhip={nhip} mayChon={mayChon} onMo={() => { dungTour(); moPhong(id); }} onChonMay={chonMay} />
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] opacity-75">
              {(["chay", "chet", "chua-ro", "tat"] as TrangThai[]).map((tt) => (
                <span key={tt} className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-1 rounded-full" style={{ background: AO[tt] }} />{t(CHU_TT[tt])}</span>
              ))}
              <span className="inline-flex items-center gap-1"><Laptop className="w-3.5 h-3.5" />
                {t("Máy văn phòng")} {d.nhipMac.song ? t("chạy, nhịp {n}h trước").replace("{n}", String(d.nhipMac.gio)) : d.nhipMac.gio === null ? t("chưa báo nhịp") : t("TẮT, nhịp {n}h trước").replace("{n}", String(d.nhipMac.gio))}
              </span>
            </div>
          </div>
        )}
      </div>

      <aside className="rounded-xl border border-gray-100 bg-white shadow-sm p-4 text-[12.5px] self-start xl:sticky xl:top-4 min-w-0">
        {mayChon ? (
          <ChiTietMay m={mayChon} phong={timPhong(d.phong.find((p) => p.boPhan.some((b) => b.may.some((x) => x.key === mayChon.key)))?.id ?? "")} onDong={() => setMayChon(null)} />
        ) : trongPhong ? (
          <PanelPhong
            key={trongPhong}
            p={timPhong(trongPhong)!}
            pl={live(trongPhong)}
            deXuat={d.vong.deXuat.filter((x) => x.phong === trongPhong)}
            tab={tab}
            setTab={setTab}
            grokCapNhat={d.tongQuan.grokCapNhat}
            onChonMay={chonMay}
            onDong={() => { dungTour(); veSoDo(); }}
          />
        ) : (
          <TongQuan d={d} may={may} onMo={(id) => { dungTour(); setTab("phong"); moPhong(id); }} onChat={(id) => { dungTour(); setTab("chat"); moPhong(id); }} />
        )}
      </aside>
    </div>
  );
}

function BongNoi({ chu, dut, mau }: { chu: string; dut?: boolean; mau: string }) {
  return (
    <div className="ttm-hien relative rounded-md px-2 py-1.5 text-[11.5px] leading-snug shadow-sm"
      style={{ background: dut ? "#FFF1F2" : "var(--ttm-nen)", color: dut ? "#BE123C" : "var(--ttm-chu)", border: `1px solid ${dut ? "#FDA4AF" : `${mau}66`}` }}>
      {chu}
      <span className="absolute -left-[5px] bottom-3 w-2.5 h-2.5 rotate-45"
        style={{ background: dut ? "#FFF1F2" : "var(--ttm-nen)", borderLeft: `1px solid ${dut ? "#FDA4AF" : `${mau}66`}`, borderBottom: `1px solid ${dut ? "#FDA4AF" : `${mau}66`}` }} />
    </div>
  );
}

function DemPhong({ pl }: { pl: PhongLive }) {
  const grok = pl.dem.grokChoAnh + pl.dem.grokKet;
  const { t } = useLang();
  return (
    <span className="ml-auto flex items-center gap-1 shrink-0">
      <span className="tabular-nums text-[11.5px] opacity-70">{pl.dem.chay}/{pl.dem.may}</span>
      {pl.dem.dut > 0 && <span className="rounded-md bg-rose-500 text-white px-1.5 text-[10.5px] font-semibold">{pl.dem.dut} {t("đứt")}</span>}
      {grok > 0 && <span className="rounded-md px-1.5 text-[10.5px] font-semibold bg-amber-100 text-amber-800" title={t("Việc MausBot chờ anh / kẹt")}>{grok} MausBot</span>}
    </span>
  );
}

function PhongKinh({ p, pl, chuDut, hienTen, hienBong, chiDut, nhip, mayChon, onMo, onChonMay }: {
  p: Phong; pl: PhongLive; chuDut: (k: string, ghiChu: string) => string; hienTen: boolean; hienBong: boolean; chiDut: boolean;
  nhip: number; mayChon: MayChay | null; onMo: () => void; onChonMay: (m: MayChay) => void;
}) {
  const may = pl.boPhan.flatMap((b) => b.may);
  const dut = may.filter((m) => m.trangThai === "chet" && !m.chiThamKhao);
  const dangChay = may.filter((m) => m.trangThai === "chay");
  const lam = dangChay.length ? dangChay[(nhip + p.id.length) % dangChay.length] : null;
  const { t } = useLang();
  const loi = dut.length
    ? { dut: true, chu: `${t(dut[0].ten)}: ${rutGon(chuDut(dut[0].key, dut[0].ghiChu), 52)}${dut.length > 1 ? ` (+${dut.length - 1})` : ""}` }
    : lam ? { dut: false, chu: rutGon(`${t(lam.ten)}: ${lam.ghiChu || t("ổn")}`, 56) } : null;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onMo}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onMo(); } }}
      aria-label={`${t(p.ten)} — ${t("bấm để vào phòng")}`}
      className="ttm-phong group relative rounded-lg cursor-pointer flex flex-col overflow-hidden"
      style={{
        background: "var(--ttm-nen)",
        border: `1px solid ${pl.dem.dut ? "#FDA4AF" : "var(--ttm-vien)"}`,
        boxShadow: pl.dem.dut ? "0 0 0 2px rgba(244,63,94,.25), 0 8px 24px -12px rgba(15,23,42,.35)" : "0 8px 24px -14px rgba(15,23,42,.35)",
        opacity: chiDut && !pl.dem.dut ? 0.4 : 1,
      }}
    >
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: p.mau }} />
      <div className="relative h-[150px] sm:h-[178px]">
        <img src={anhTang(p.id)} alt="" draggable={false}
          className="absolute right-1 top-2 h-[92%] w-auto max-w-[86%] object-contain transition-transform duration-300 group-hover:scale-[1.04]" />
        <div className="absolute left-1 bottom-0"><Nguoi id={p.id} cao={124} xam={!pl.dem.chay && pl.dem.may > 0} /></div>
        {hienBong && loi && (
          <div key={loi.chu} className="hidden sm:block absolute left-[66px] top-3 max-w-[60%]">
            <BongNoi chu={loi.chu} dut={loi.dut} mau={p.mau} />
          </div>
        )}
      </div>
      <div className="px-2.5 pt-1.5 pb-2 border-t" style={{ borderColor: "var(--ttm-vien)" }}>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12.5px]">
          <span className="font-semibold min-w-0 truncate"><span className="sm:hidden">{t(p.ngan)}</span><span className="hidden sm:inline">{t(p.ten)}</span></span>
          <DemPhong pl={pl} />
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {may.map((m) => <OMay key={m.key} m={m} chon={mayChon?.key === m.key} mo={chiDut && m.trangThai !== "chet"} onChon={() => onChonMay(m)} />)}
          {!may.length && <span className="text-[11px] opacity-60">{t("Chưa có máy, người làm tay")}</span>}
        </div>
        {hienTen && may.length > 0 && (
          <div className="mt-1 text-[11px] opacity-75 leading-snug">{may.map((m) => t(m.ten)).join(" · ")}</div>
        )}
      </div>
    </div>
  );
}

function BanGiamDoc({ p, pl, grokTong, claude, hienTen, chiDut, mayChon, onMo, onChonMay }: {
  p: Phong; pl: PhongLive; grokTong: number; claude: ThiTranData["tongQuan"]["claude"]; hienTen: boolean; chiDut: boolean;
  mayChon: MayChay | null; onMo: () => void; onChonMay: (m: MayChay) => void;
}) {
  const may = pl.boPhan.flatMap((b) => b.may);
  const { t } = useLang();
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onMo}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onMo(); } }}
      aria-label={t("Phòng Giám đốc và MausBot — bấm để mở")}
      className="ttm-phong group col-span-2 sm:col-span-1 order-first sm:order-none relative rounded-lg cursor-pointer flex flex-col overflow-hidden"
      style={{
        background: "linear-gradient(180deg, rgba(14,165,233,.10), var(--ttm-nen) 55%)",
        border: `1px solid ${p.mau}`,
        boxShadow: `0 0 0 3px ${p.mau}22, 0 10px 28px -14px rgba(15,23,42,.45)`,
        opacity: chiDut && !pl.dem.dut ? 0.4 : 1,
      }}
    >
      <div className="relative h-[150px] sm:h-[178px]">
        <img src={anhTang("tlgd")} alt="" draggable={false}
          className="absolute right-1 top-2 h-[92%] w-auto max-w-[86%] object-contain transition-transform duration-300 group-hover:scale-[1.04]" />
        <div className="absolute left-1 bottom-0"><Nguoi id="tlgd" cao={124} /></div>
        <div className="absolute left-[58px] sm:left-[66px] top-3 flex items-center gap-1.5 rounded-md px-2 py-1 text-white shadow" style={{ background: p.mau }}>
          <Bot className="w-4 h-4" />
          <span className="text-[11.5px] font-semibold">{grokTong ? `MausBot: ${grokTong} ${t("việc chờ anh")}` : t("MausBot: không việc nào chờ anh")}</span>
        </div>
      </div>
      <div className="px-2.5 pt-1.5 pb-2 border-t" style={{ borderColor: "var(--ttm-vien)" }}>
        <div className="flex items-center gap-1.5 text-[12.5px]">
          <span className="font-semibold truncate">{t("Giám đốc + MausBot")}</span>
          <DemPhong pl={pl} />
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {may.map((m) => <OMay key={m.key} m={m} chon={mayChon?.key === m.key} mo={chiDut && m.trangThai !== "chet"} onChon={() => onChonMay(m)} />)}
          {claude && <span className="text-[11px] opacity-75 ml-1">Claude Code: {claude.dangLam} {t("đang làm")} · {claude.choDuyet} {t("chờ duyệt")}{claude.song ? "" : ` · ${t("máy tắt")}`}</span>}
        </div>
        {hienTen && may.length > 0 && <div className="mt-1 text-[11px] opacity-75 leading-snug">{may.map((m) => t(m.ten)).join(" · ")}</div>}
      </div>
    </div>
  );
}

function PhongPhongTo({ p, pl, chuDut, hienBong, chiDut, nhip, mayChon, onChonMay, onVe }: {
  p: Phong; pl: PhongLive; chuDut: (k: string, ghiChu: string) => string; hienBong: boolean; chiDut: boolean; nhip: number; mayChon: MayChay | null;
  onChonMay: (m: MayChay) => void; onVe: () => void;
}) {
  const conViec = pl.viecGrok.filter((v) => v.trangThai !== "xong").length;
  const may = pl.boPhan.flatMap((b) => b.may);
  const dut = may.filter((m) => m.trangThai === "chet" && !m.chiThamKhao);
  const dangChay = may.filter((m) => m.trangThai === "chay");
  const lam = dangChay.length ? dangChay[nhip % dangChay.length] : null;
  const { t } = useLang();
  return (
    <div className="ttm-vao p-3 sm:p-5">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button onClick={onVe} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[12px] font-semibold"
          style={{ background: "var(--ttm-nen)", color: "var(--ttm-chu)", borderColor: "var(--ttm-vien)" }}>
          <ArrowLeft className="w-3.5 h-3.5" /> {t("Về sơ đồ tầng")}
        </button>
        <div className="rounded-md px-2.5 py-1 text-[12px] font-semibold text-white" style={{ background: p.mau }}>
          {t(p.ten)} · {pl.dem.chay}/{pl.dem.may} {t("máy chạy")}{pl.dem.dut ? ` · ${pl.dem.dut} ${t("đứt")}` : ""}
        </div>
        <div className="inline-flex items-center gap-1 text-[12px] opacity-80"><Bot className="w-4 h-4" />{conViec ? t("MausBot đang giao {n} việc").replace("{n}", String(conViec)) : t("MausBot chưa giao việc")}</div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="relative rounded-lg overflow-hidden h-[300px] sm:h-[380px] lg:self-start lg:sticky lg:top-3"
          style={{ background: "var(--ttm-nen)", border: "1px solid var(--ttm-vien)", boxShadow: "0 10px 30px -16px rgba(15,23,42,.45)" }}>
          <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: p.mau }} />
          <img src={anhTang(p.id)} alt="" draggable={false} className="absolute right-2 top-4 h-[88%] w-auto max-w-[80%] object-contain" />
          <div className="absolute left-2 bottom-0"><Nguoi id={p.id} cao={230} /></div>
          {hienBong && (dut.length > 0 || lam) && (
            <div key={`${lam?.key}-${nhip}`} className="absolute left-[100px] sm:left-[110px] top-4 max-w-[62%]">
              <BongNoi mau={p.mau} dut={dut.length > 0}
                chu={dut.length ? `${t(dut[0].ten)}: ${rutGon(chuDut(dut[0].key, dut[0].ghiChu), 80)}` : rutGon(`${t(lam!.ten)}: ${lam!.ghiChu || t("ổn")}`, 80)} />
            </div>
          )}
        </div>
        <div className="space-y-2.5">
          {pl.boPhan.map((b) => {
            const chay = b.may.filter((m) => m.trangThai === "chay").length;
            const dutBo = b.may.filter((m) => m.trangThai === "chet" && !m.chiThamKhao).length;
            return (
              <div key={b.ten} className="rounded-lg p-2.5" style={{ background: "var(--ttm-nen)", border: `1px solid ${dutBo ? "#FDA4AF" : "var(--ttm-vien)"}` }}>
                <div className="flex items-center gap-1.5 text-[12.5px] mb-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: p.mau }} />
                  <span className="font-semibold">{t(b.ten)}</span>
                  <span className="tabular-nums opacity-60">{chay}/{b.may.length}</span>
                  {dutBo > 0 && <span className="ml-auto rounded-md bg-rose-500 text-white px-1.5 text-[10.5px] font-semibold">{dutBo} {t("đứt")}</span>}
                </div>
                <ul>
                  {b.may.map((m) => (
                    <li key={m.key}>
                      <button onClick={() => onChonMay(m)}
                        className="w-full flex items-start gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-black/5"
                        style={{ opacity: chiDut && m.trangThai !== "chet" ? 0.3 : 1, outline: mayChon?.key === m.key ? `2px solid ${p.mau}` : undefined }}>
                        <span className={`w-2.5 h-2.5 rounded-[3px] shrink-0 mt-1 ${m.trangThai === "chet" ? "ttm-nhip-o" : ""}`} style={{ background: AO[m.trangThai] }} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-[12.5px]">{t(m.ten)}</span>
                          {m.ghiChu && <span className={`block text-[11.5px] ${m.trangThai === "chet" ? "text-rose-600" : "opacity-60"}`}>{rutGon(m.trangThai === "chet" ? chuDut(m.key, m.ghiChu) : m.ghiChu, 90)}</span>}
                        </span>
                        {m.noiChay === "mac" ? <Laptop className="w-3.5 h-3.5 opacity-50 mt-1" /> : <Server className="w-3.5 h-3.5 opacity-50 mt-1" />}
                      </button>
                    </li>
                  ))}
                  {!b.may.length && <li className="px-1.5 text-[11.5px] opacity-60">{t("Chưa có máy — bộ phận này người làm tay.")}</li>}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NutBat({ bat, onClick, children }: { bat: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 border transition ${bat ? "bg-teal-600 text-white border-teal-600" : ""}`}
      style={bat ? undefined : { background: "var(--ttm-nen)", color: "var(--ttm-chu)", borderColor: "var(--ttm-vien)" }}
    >
      {children}
    </button>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: "do" | "xanh" | "vang" }) {
  const c = tone === "do" ? "bg-rose-100 text-rose-700" : tone === "xanh" ? "bg-emerald-100 text-emerald-700" : tone === "vang" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700";
  return <span className={`rounded-md px-2 py-0.5 font-semibold tabular-nums ${c}`}>{children}</span>;
}

function O({ so, nhan, tone }: { so: number | string; nhan: string; tone?: "do" | "vang" | "xanh" }) {
  const c = tone === "do" ? "bg-rose-50 text-rose-700" : tone === "vang" ? "bg-amber-50 text-amber-800" : tone === "xanh" ? "bg-emerald-50 text-emerald-800" : "bg-gray-50 text-gray-900";
  return (
    <div className={`rounded-md py-2 px-1 ${c}`}>
      <div className="text-[19px] font-bold tabular-nums leading-none">{so}</div>
      <div className="text-[11px] mt-1 opacity-75">{nhan}</div>
    </div>
  );
}

function TongQuan({ d, may, onMo, onChat }: { d: ThiTranData; may: MayChay[]; onMo: (id: MaPhong) => void; onChat: (id: MaPhong) => void }) {
  const tq = d.tongQuan;
  const dut = d.phong.flatMap((p) => p.boPhan.flatMap((b) => b.may.filter((m) => m.trangThai === "chet" && !m.chiThamKhao).map((m) => ({ p, m }))));
  const grokCanAnh = d.phong.flatMap((p) => p.viecGrok.filter((v) => v.trangThai === "cho-anh" || v.trangThai === "ket").map((v) => ({ p, v })))
    .sort((a, b) => (a.v.trangThai === "cho-anh" ? 0 : 1) - (b.v.trangThai === "cho-anh" ? 0 : 1));
  const choAnh = d.phong.reduce((n, p) => n + p.dem.grokChoAnh, 0);
  const ket = d.phong.reduce((n, p) => n + p.dem.grokKet, 0);
  const chay = may.filter((m) => m.trangThai === "chay").length;
  const { t } = useLang();
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div className="font-bold text-gray-900 text-[14px]">{t("Tổng quan")}</div>
        <div className="text-[11px] text-gray-400">{t("dữ liệu thật lúc mở trang")}</div>
      </div>
      <VongPhanHoi d={d} onMo={onMo} />

      <div className="grid grid-cols-3 gap-2 text-center">
        <O so={`${chay}/${may.length}`} nhan={t("máy đang chạy")} tone="xanh" />
        <O so={dut.length} nhan={t("máy đứt")} tone={dut.length ? "do" : undefined} />
        <O so={tq.luotHomNay} nhan={t("lượt máy làm hôm nay")} />
        <O so={choAnh} nhan={t("việc MausBot chờ anh")} tone={choAnh ? "vang" : undefined} />
        <O so={ket} nhan={t("việc MausBot kẹt")} tone={ket ? "do" : undefined} />
        <O so={tq.choDuyet} nhan={t("việc máy chờ duyệt")} tone={tq.choDuyet ? "vang" : undefined} />
      </div>

      {tq.claude && (
        <div className="flex items-center gap-2 rounded-md bg-sky-50 px-2.5 py-2 text-sky-900">
          <Bot className="w-4 h-4 shrink-0" />
          <span>Claude Code: {tq.claude.dangLam} {t("đang làm")} · {tq.claude.choLam} {t("chờ làm")} · {tq.claude.choDuyet} {t("chờ anh duyệt")}</span>
          {!tq.claude.song && <span className="ml-auto text-amber-700 font-semibold shrink-0">{t("máy làm việc tắt")}</span>}
        </div>
      )}

      <div>
        <div className="font-semibold text-gray-800 mb-1">{t("9 phòng")}</div>
        <div className="space-y-0.5">
          {MOI_PHONG.map((p) => {
            const pl = d.phong.find((x) => x.id === p.id)!;
            return (
              <div key={p.id} className="flex items-center gap-1 rounded-md hover:bg-gray-50">
                <button onClick={() => onMo(p.id)} className="flex-1 min-w-0 flex items-center gap-2 px-1.5 py-1 text-left">
                  <IconPhong p={p} to={26} />
                  <span className="flex-1 min-w-0 text-gray-800 truncate">{t(p.ngan)}</span>
                  <span className="tabular-nums text-gray-500">{pl.dem.chay}/{pl.dem.may}</span>
                  {pl.dem.dut > 0 && <span className="text-rose-600 font-semibold">{pl.dem.dut} {t("đứt")}</span>}
                  {pl.dem.grokChoAnh + pl.dem.grokKet > 0 && <span className="rounded px-1 text-[10.5px] font-semibold bg-amber-100 text-amber-800">{pl.dem.grokChoAnh + pl.dem.grokKet} MausBot</span>}
                </button>
                <button onClick={() => onChat(p.id)} title={`${t("Trò chuyện với")} ${t(p.ngan)}`} aria-label={`${t("Trò chuyện với")} ${t(p.ngan)}`} className="p-1.5 text-gray-400 hover:text-teal-700">
                  <MessageCircle className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {grokCanAnh.length > 0 && (
        <div className="border-t border-gray-100 pt-3">
          <div className="font-semibold text-gray-800 mb-1">{t("MausBot đang chờ anh / kẹt")}</div>
          <ul className="space-y-1.5">
            {grokCanAnh.slice(0, 8).map(({ p, v }) => (
              <li key={v.ma}>
                <button onClick={() => onMo(p.id)} className="w-full flex gap-2 items-start text-left hover:bg-gray-50 rounded-md px-1 py-0.5">
                  <span className="flex-1 min-w-0"><span className="text-gray-800">{rutGon(v.moTa || v.ma, 72)}</span> <span className="text-gray-400">· {t(timPhong(p.id)?.ngan)}</span></span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-semibold ${MAU_GROK[v.trangThai]}`}>{t(CHU_GROK[v.trangThai])}</span>
                </button>
              </li>
            ))}
          </ul>
          {tq.grokCapNhat && <div className="text-[11px] text-gray-400 mt-1">{t("Bảng việc MausBot cập nhật")} {gioTruoc(tq.grokCapNhat, t)}</div>}
        </div>
      )}

      {tq.choDuyetDs.length > 0 && (
        <div className="border-t border-gray-100 pt-3">
          <div className="font-semibold text-gray-800 mb-1">{t("Máy làm xong, chờ anh duyệt")}</div>
          <ul className="space-y-1.5">
            {tq.choDuyetDs.map((v) => (
              <li key={v.id} className="flex gap-2 items-start">
                <span className="flex-1 min-w-0"><span className="text-gray-800">{rutGon(dichSo(t, v.viec), 70)}</span> <span className="text-gray-400">· {t(v.ai)}</span></span>
              </li>
            ))}
          </ul>
          <a href="/he-dieu-hanh-ai" className="text-teal-700 hover:underline text-[12px]">{t("Duyệt ở Hệ điều hành AI")}</a>
        </div>
      )}

      {dut.length > 0 && (
        <div className="border-t border-gray-100 pt-3">
          <div className="font-semibold text-rose-700 mb-1">{t("Đang đứt")} ({dut.length})</div>
          <ul className="space-y-1 text-gray-700">
            {dut.slice(0, 10).map(({ p, m }) => (
              <li key={m.key} className="flex gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" /><span><b>{t(m.ten)}</b> <span className="text-gray-400">· {t(timPhong(p.id)?.ngan)}</span></span></li>
            ))}
          </ul>
        </div>
      )}

      {tq.vuaLam.length > 0 && (
        <div className="border-t border-gray-100 pt-3">
          <div className="font-semibold text-gray-800 mb-1">{t("Vừa làm xong")}</div>
          <ul className="space-y-1 text-gray-700">
            {tq.vuaLam.map((v) => (
              <li key={v.id} className="flex gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${v.hong ? "bg-rose-500" : "bg-emerald-500"}`} />
                <span className="min-w-0"><b>{t(v.ai)}</b> {rutGon(dichSo(t, v.viec), 60)} <span className="text-gray-400">· {gioTruoc(v.luc, t)}</span></span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="text-[11.5px] text-gray-400 border-t border-gray-100 pt-2">{t("Bấm vào một phòng kính để xem từng bộ phận; biểu tượng tin nhắn để trò chuyện và giao việc cho phòng đó.")}</div>
    </div>
  );
}

function PanelPhong({ p, pl, deXuat, tab, setTab, grokCapNhat, onChonMay, onDong }: {
  p: Phong; pl: PhongLive; deXuat: DeXuat[]; tab: "phong" | "chat"; setTab: (t: "phong" | "chat") => void; grokCapNhat: string | null;
  onChonMay: (m: MayChay) => void; onDong: () => void;
}) {
  const { t } = useLang();
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <IconPhong p={p} to={44} />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-gray-900 text-[14px]">{t(p.ten)}</div>
          <div className="text-gray-500">{t(p.moTa)}</div>
        </div>
        <button onClick={onDong} className="text-gray-400 hover:text-gray-700" aria-label={t("Đóng")}><X className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-md bg-gray-100 p-0.5">
        {([["phong", LayoutGrid, "Phòng"], ["chat", MessageCircle, "Trò chuyện"]] as const).map(([v, Ic, nhan]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`inline-flex items-center justify-center gap-1.5 rounded px-2 py-1.5 font-semibold ${tab === v ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>
            <Ic className="w-3.5 h-3.5" /> {t(nhan)}
          </button>
        ))}
      </div>
      {tab === "chat" ? <ChatPhong p={p} /> : (
        <>
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <O so={`${pl.dem.chay}/${pl.dem.may}`} nhan={t("máy chạy")} tone="xanh" />
            <O so={pl.dem.dut} nhan={t("đứt")} tone={pl.dem.dut ? "do" : undefined} />
            <O so={pl.dem.grokChoAnh} nhan={t("chờ anh")} tone={pl.dem.grokChoAnh ? "vang" : undefined} />
            <O so={pl.dem.grokKet} nhan={t("kẹt")} tone={pl.dem.grokKet ? "do" : undefined} />
          </div>
          {deXuat.length > 0 && (
            <div className="space-y-2">
              <div className="font-semibold text-gray-800">{t("Đề xuất sửa chỗ đứt")}</div>
              {deXuat.map((x) => <TheDeXuat key={x.id} dx={x} />)}
            </div>
          )}

          <div>
            <div className="font-semibold text-gray-800 mb-1">{t("Việc MausBot giao")}</div>
            {pl.viecGrok.length ? (
              <ul className="space-y-1.5">
                {pl.viecGrok.slice(0, 10).map((v) => (
                  <li key={v.ma} className="flex gap-2 items-start">
                    <span className="flex-1 min-w-0 text-gray-800">
                      {rutGon(v.moTa || v.ma, 90)}
                      {v.link && <a href={v.link} target="_blank" rel="noreferrer" className="ml-1 text-teal-700 inline-flex items-center gap-0.5 hover:underline">{t("mở")}<ExternalLink className="w-3 h-3" /></a>}
                      <span className="block text-[11px] text-gray-400">{v.ma} · {gioTruoc(v.luc, t)}</span>
                    </span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-semibold ${MAU_GROK[v.trangThai]}`}>{t(CHU_GROK[v.trangThai])}</span>
                  </li>
                ))}
              </ul>
            ) : <div className="text-gray-400">{t("Bảng việc MausBot chưa có việc nào của phòng này")}{grokCapNhat ? ` (${t("cập nhật")} ${gioTruoc(grokCapNhat, t)})` : ""}.</div>}
          </div>

          {pl.daGiao.length > 0 && (
            <div>
              <div className="font-semibold text-gray-800 mb-1">{t("Anh đã giao từ thị trấn")}</div>
              <ul className="space-y-1">
                {pl.daGiao.map((v) => (
                  <li key={v.id} className="flex gap-2 items-start">
                    <span className="flex-1 min-w-0 text-gray-800">{rutGon(v.viec.replace(/^\[[^\]]*\]\s*/, ""), 80)}</span>
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-semibold bg-slate-100 text-slate-700">{t(CHU_CC[v.trangThai]) || v.trangThai}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="font-semibold text-gray-800 mb-1">{t("Bộ phận và máy")}</div>
            {pl.boPhan.map((b) => (
              <div key={b.ten} className="mb-1.5">
                <div className="flex items-center gap-1.5 text-gray-600 text-[12px]">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: p.mau }} />
                  <span className="font-semibold">{t(b.ten)}</span>
                  <span className="text-gray-400">{b.may.filter((m) => m.trangThai === "chay").length}/{b.may.length}</span>
                </div>
                <ul>
                  {b.may.map((m) => (
                    <li key={m.key}>
                      <button onClick={() => onChonMay(m)} className="w-full flex items-start gap-2 rounded-md px-2 py-1 hover:bg-gray-50 text-left">
                        <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: AO[m.trangThai] }} />
                        <span className="flex-1 min-w-0">
                          <span className="text-gray-800 block">{t(m.ten)}</span>
                          {m.ghiChu && <span className={`block text-[11.5px] ${m.trangThai === "chet" ? "text-rose-600" : "text-gray-400"}`}>{rutGon(m.ghiChu, 70)}</span>}
                        </span>
                        {m.noiChay === "mac" ? <Laptop className="w-3.5 h-3.5 text-gray-400 mt-1" /> : <Server className="w-3.5 h-3.5 text-gray-400 mt-1" />}
                      </button>
                    </li>
                  ))}
                  {!b.may.length && <li className="px-2 text-gray-400 text-[11.5px]">{t("Chưa có máy — bộ phận này người làm tay.")}</li>}
                </ul>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5 border-t border-gray-100 pt-2">
            {p.trang.map((x) => (
              <a key={x.href} href={x.href} className="rounded-md border border-gray-200 px-2 py-1 text-gray-700 hover:border-teal-600 hover:text-teal-700">{t(x.nhan)}</a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

type TinChat = {
  ai: "anh" | "phong" | "loi";
  chu: string;
  viec?: string | null;
  giao?: { trangThai: "dang" | "xong" | "loi"; chu: string };
};

const HET_PHIEN = "Phiên đăng nhập đã hết, anh tải lại trang rồi đăng nhập giúp em.";

const GOI_Y = ["Phòng mình đang thế nào?", "Máy nào đứt, sửa thế nào?", "Việc MausBot giao còn gì dở?"];

function ChatPhong({ p }: { p: Phong }) {
  const khoa = `ttm-chat-${p.id}`;
  const [tin, setTin] = useState<TinChat[]>([]);
  const [nhap, setNhap] = useState("");
  const [dang, setDang] = useState(false);
  const cuoiRef = useRef<HTMLDivElement>(null);
  const { t } = useLang();

  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(khoa) || "[]"); if (Array.isArray(v)) setTin(v); } catch {}
  }, [khoa]);
  const luu = (ds: TinChat[]) => {
    setTin(ds);
    try { localStorage.setItem(khoa, JSON.stringify(ds.slice(-30))); } catch {}
  };
  useEffect(() => { cuoiRef.current?.scrollIntoView({ block: "nearest" }); }, [tin, dang]);

  async function gui(cau: string) {
    const c = cau.trim();
    if (!c || dang) return;
    const ds: TinChat[] = [...tin, { ai: "anh", chu: c }];
    luu(ds);
    setNhap("");
    setDang(true);
    try {
      const r = await fetch("/api/thi-tran/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phong: p.id, tin: c, lichSu: tin.filter((x) => x.ai !== "loi").map((x) => ({ ai: x.ai, chu: x.chu })) }),
      });
      const j = await r.json().catch(() => null);
      if (r.redirected || r.status === 401) luu([...ds, { ai: "loi", chu: t(HET_PHIEN) }]);
      else if (!r.ok || !j?.ok) luu([...ds, { ai: "loi", chu: j?.error || t("Phòng chưa trả lời được (mã {n}).").replace("{n}", String(r.status)) }]);
      else luu([...ds, { ai: "phong", chu: j.chu, viec: j.viec }]);
    } catch (e: any) {
      luu([...ds, { ai: "loi", chu: `${t("Gọi hỏng")}: ${String(e?.message || e).slice(0, 120)}` }]);
    } finally { setDang(false); }
  }

  async function giaoViec(i: number, viec: string) {
    const v = viec.replace(/\s+/g, " ").trim();
    const capNhat = (giao: TinChat["giao"]) => setTin((cu) => {
      const ds = cu.map((x, j) => (j === i ? { ...x, viec: v, giao } : x));
      try { localStorage.setItem(khoa, JSON.stringify(ds.slice(-30))); } catch {}
      return ds;
    });
    capNhat({ trangThai: "dang", chu: t("Đang gửi...") });
    try {
      const r = await fetch("/api/thi-tran/giao-viec", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phong: p.id, viec: v }) });
      const j = await r.json().catch(() => null);
      if (r.redirected || r.status === 401) capNhat({ trangThai: "loi", chu: t(HET_PHIEN) });
      else if (!r.ok || !j?.ok) capNhat({ trangThai: "loi", chu: j?.error || t("Giao hỏng (mã {n}).").replace("{n}", String(r.status)) });
      else capNhat({ trangThai: "xong", chu: t("Đã vào hàng việc, mã {id}. Máy chỉ làm sau khi anh gõ /duyet {id} trên Telegram.").replace(/\{id\}/g, String(j.id)) });
    } catch (e: any) {
      capNhat({ trangThai: "loi", chu: `${t("Gọi hỏng")}: ${String(e?.message || e).slice(0, 120)}` });
    }
  }

  function giaoThang() {
    const c = nhap.replace(/\s+/g, " ").trim();
    if (c.length < 8) return;
    luu([...tin, { ai: "anh", chu: c }, { ai: "phong", chu: t("Anh xem lại câu giao việc rồi bấm gửi giúp em."), viec: c }]);
    setNhap("");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-md bg-gray-50 border border-gray-100 p-2 h-[340px] overflow-y-auto space-y-2">
        {!tin.length && (
          <div className="text-gray-500 text-[12px] space-y-2">
            <div>{t("Hỏi {phong} bằng số đo thật của phòng. Câu nào là giao việc, phòng sẽ soạn sẵn thẻ để anh gửi vào hàng việc Claude Code (máy chỉ làm khi anh /duyet).").replace("{phong}", t(p.ngan))}</div>
            <div className="flex flex-wrap gap-1.5">
              {GOI_Y.map((g) => (
                <button key={g} onClick={() => gui(t(g))} className="rounded-md border border-gray-200 bg-white px-2 py-1 text-gray-700 hover:border-teal-600">{t(g)}</button>
              ))}
            </div>
          </div>
        )}
        {tin.map((x, i) => (
          x.ai === "anh" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-lg rounded-br-sm bg-teal-600 text-white px-2.5 py-1.5 whitespace-pre-wrap">{x.chu}</div>
            </div>
          ) : x.ai === "loi" ? (
            <div key={i} className="text-rose-700 text-[12px] px-1">{x.chu}</div>
          ) : (
            <div key={i} className="flex gap-1.5 items-start">
              <IconPhong p={p} to={26} />
              <div className="max-w-[88%] space-y-1.5 min-w-0">
                <div className="rounded-lg rounded-tl-sm bg-white border border-gray-100 px-2.5 py-1.5 text-gray-800 whitespace-pre-wrap">{x.chu}</div>
                {x.viec && <TheGiaoViec viec={x.viec} giao={x.giao} mau={p.mau} onGiao={(v) => giaoViec(i, v)} />}
              </div>
            </div>
          )
        ))}
        {dang && <div className="flex items-center gap-1.5 text-gray-400 text-[12px] px-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t(p.ngan)} {t("đang xem số liệu...")}</div>}
        <div ref={cuoiRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); gui(nhap); }} className="flex gap-1.5">
        <input value={nhap} onChange={(e) => setNhap(e.target.value)} maxLength={800} placeholder={`${t("Hỏi hoặc giao việc cho")} ${t(p.ngan)}...`}
          className="flex-1 min-w-0 rounded-md border border-gray-200 px-2.5 py-1.5 outline-none focus:border-teal-600" />
        <button type="submit" disabled={dang || !nhap.trim()} aria-label={t("Gửi")} className="rounded-md bg-teal-600 text-white px-2.5 disabled:opacity-50"><Send className="w-4 h-4" /></button>
      </form>
      <div className="flex items-center justify-between text-[11.5px]">
        <button onClick={giaoThang} disabled={nhap.trim().length < 8} className="text-teal-700 hover:underline disabled:text-gray-300 disabled:no-underline">{t("Giao thẳng câu này, không hỏi phòng")}</button>
        {tin.length > 0 && <button onClick={() => luu([])} className="inline-flex items-center gap-1 text-gray-400 hover:text-gray-700"><Trash2 className="w-3 h-3" /> {t("Xoá khung chat")}</button>}
      </div>
    </div>
  );
}

function TheGiaoViec({ viec, giao, mau, onGiao }: { viec: string; giao?: TinChat["giao"]; mau: string; onGiao: (v: string) => void }) {
  const [v, setV] = useState(viec);
  const daGui = giao?.trangThai === "xong";
  const { t } = useLang();
  return (
    <div className="rounded-lg border bg-white p-2 space-y-1.5" style={{ borderColor: mau }}>
      <div className="flex items-center gap-1.5 text-[11.5px] font-semibold" style={{ color: mau }}><ClipboardCheck className="w-3.5 h-3.5" /> {t("Thẻ giao việc")}</div>
      <textarea value={v} onChange={(e) => setV(e.target.value)} disabled={daGui || giao?.trangThai === "dang"} rows={3} maxLength={500}
        className="w-full rounded-md border border-gray-200 px-2 py-1 text-[12px] text-gray-800 outline-none focus:border-teal-600 disabled:bg-gray-50" />
      {giao && <div className={`text-[11.5px] ${giao.trangThai === "loi" ? "text-rose-700" : giao.trangThai === "xong" ? "text-emerald-700" : "text-gray-500"}`}>{giao.chu}</div>}
      {!daGui && (
        <button onClick={() => onGiao(v)} disabled={giao?.trangThai === "dang" || v.trim().length < 8}
          className="inline-flex items-center gap-1.5 rounded-md text-white px-2.5 py-1 text-[12px] font-semibold disabled:opacity-50" style={{ background: mau }}>
          {giao?.trangThai === "dang" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} {t("Giao cho phòng")}
        </button>
      )}
    </div>
  );
}

const MAU_VONG: Record<DeXuat["trangThai"], string> = {
  "can-anh": "bg-rose-100 text-rose-700", "xong-van-dut": "bg-rose-100 text-rose-700", "giao-hong": "bg-rose-100 text-rose-700",
  "chay-lai-van-dut": "bg-rose-100 text-rose-700", "qua-han": "bg-rose-100 text-rose-700",
  "cho-duyet": "bg-amber-100 text-amber-800", "dang-sua": "bg-sky-100 text-sky-800", "cho-chay-lai": "bg-sky-100 text-sky-800",
  "de-sau": "bg-slate-100 text-slate-700", "da-gat": "bg-slate-100 text-slate-500",
};

function VongPhanHoi({ d, onMo }: { d: ThiTranData; onMo: (id: MaPhong) => void }) {
  const [moDangXuLy, setMoDangXuLy] = useState(false);
  const [moHet, setMoHet] = useState(false);
  const can = d.vong.deXuat.filter((x) => x.canAnh);
  const dangXuLy = d.vong.deXuat.filter((x) => !x.canAnh);
  const { t } = useLang();
  if (!d.vong.deXuat.length && !d.vong.daSua.length) {
    return <div className="rounded-md bg-emerald-50 text-emerald-800 px-2.5 py-2">{t("Không chỗ nào đứt — không có gì cần anh trả lời.")}</div>;
  }
  return (
    <div className="space-y-2">
      {can.length > 0 && (
        <div className="space-y-2">
          <div className="font-semibold text-rose-700">{t("Cần anh trả lời")} ({can.length})</div>
          {(moHet ? can : can.slice(0, 4)).map((x) => <TheDeXuat key={x.id} dx={x} onMo={() => onMo(x.phong as MaPhong)} />)}
          {can.length > 4 && (
            <button onClick={() => setMoHet((v) => !v)} className="text-teal-700 hover:underline text-[12px]">
              {moHet ? t("Thu gọn") : t("Xem thêm {n} chỗ cần anh").replace("{n}", String(can.length - 4))}
            </button>
          )}
        </div>
      )}
      {dangXuLy.length > 0 && (
        <div>
          <button onClick={() => setMoDangXuLy((v) => !v)} className="font-semibold text-gray-700 hover:text-gray-900">
            {t("Đang xử lý")} ({dangXuLy.length}) {moDangXuLy ? "▴" : "▾"}
          </button>
          {moDangXuLy && <div className="space-y-2 mt-1.5">{dangXuLy.map((x) => <TheDeXuat key={x.id} dx={x} onMo={() => onMo(x.phong as MaPhong)} />)}</div>}
          {!moDangXuLy && (
            <div className="text-[11.5px] text-gray-500">{dangXuLy.map((x) => `${t(x.may[0].ten)}: ${dichTT(t, x.chuTrangThai)}`).slice(0, 3).join(" · ")}</div>
          )}
        </div>
      )}
      {d.vong.daSua.length > 0 && (
        <div className="rounded-md bg-emerald-50 px-2.5 py-2 text-emerald-800">
          <div className="font-semibold">{t("Đã lành sau khi anh xử lý")} ({d.vong.daSua.length})</div>
          <ul className="text-[12px] mt-0.5">
            {d.vong.daSua.map((x) => <li key={x.key}>{t(x.ten)} · {x.hanhDong === "giao" ? t("Claude sửa") : t("chạy lại")} {gioTruoc(x.luc, t)}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function TheDeXuat({ dx, onMo }: { dx: DeXuat; onMo?: () => void }) {
  const router = useRouter();
  const [dang, setDang] = useState<string | null>(null);
  const [kq, setKq] = useState<{ ok: boolean; chu: string } | null>(null);
  const [soViec, setSoViec] = useState(false);
  const [viec, setViec] = useState(dx.viecGoiY);
  const chayLaiDuoc = dx.may.some((m) => m.chayLaiDuoc);
  const lenhTay = dx.may.find((m) => m.lenhTay)?.lenhTay;
  const { t } = useLang();

  async function traLoi(hanhDong: string) {
    setDang(hanhDong);
    setKq(null);
    try {
      const r = await fetch("/api/thi-tran/phan-hoi", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: dx.may.map((m) => m.key), hanhDong, viec }),
      });
      const j = await r.json().catch(() => null);
      if (r.redirected || r.status === 401) setKq({ ok: false, chu: t(HET_PHIEN) });
      else if (!r.ok || !j?.ok) setKq({ ok: false, chu: j?.error || t("Không gửi được (mã {n}).").replace("{n}", String(r.status)) });
      else { setKq({ ok: true, chu: j.ketQua }); setSoViec(false); router.refresh(); }
    } catch (e: any) {
      setKq({ ok: false, chu: `${t("Gọi hỏng")}: ${String(e?.message || e).slice(0, 120)}` });
    } finally { setDang(null); }
  }

  const Nut = ({ hd, children, chinh }: { hd: string; children: React.ReactNode; chinh?: boolean }) => (
    <button onClick={() => (hd === "giao" && !soViec ? setSoViec(true) : traLoi(hd))} disabled={!!dang}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-semibold border disabled:opacity-50 ${chinh ? "bg-teal-600 border-teal-600 text-white" : "border-gray-200 text-gray-700 hover:border-gray-400"}`}>
      {dang === hd && <Loader2 className="w-3 h-3 animate-spin" />}{children}
    </button>
  );

  return (
    <div className={`rounded-lg border p-2.5 space-y-1.5 ${dx.canAnh ? "border-rose-200 bg-rose-50/40" : "border-gray-100"}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <button onClick={onMo} className="font-semibold text-gray-900 text-left hover:underline">
            {dx.may.length > 1 ? `${dx.may.length} ${t("máy cùng một chỗ đứt")}` : t(dx.may[0].ten)}
          </button>
          <span className="text-gray-400"> · {t(timPhong(dx.phong)?.ngan)}</span>
          {dx.may.length > 1 && <div className="text-[11.5px] text-gray-600">{dx.may.map((m) => t(m.ten)).join(" · ")}</div>}
        </div>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-semibold ${MAU_VONG[dx.trangThai]}`}>{dichTT(t, dx.chuTrangThai)}</span>
      </div>
      {dx.lyDo && <div className="text-[12px] text-rose-700">{rutGon(dx.lyDo, 140)}</div>}
      {dx.cachSua && <div className="text-[12px] text-gray-700"><span className="text-gray-400">{t("Đề xuất:")} </span>{rutGon(dx.cachSua, 200)}</div>}
      {dx.phanHoi && <div className="text-[11px] text-gray-400">{dx.phanHoi.boi} {t("trả lời")} {gioTruoc(dx.phanHoi.luc, t)}{dx.taskId ? ` · ${t("việc")} ${dx.taskId}` : ""}</div>}

      {soViec && (
        <textarea value={viec} onChange={(e) => setViec(e.target.value)} rows={4} maxLength={500}
          className="w-full rounded-md border border-gray-200 px-2 py-1 text-[12px] text-gray-800 outline-none focus:border-teal-600" />
      )}
      {!chayLaiDuoc && lenhTay && dx.canAnh && (
        <div className="rounded-md bg-amber-50 border border-amber-100 px-2 py-1 text-[11.5px] text-amber-900">{t("Cần chính tay anh:")} {rutGon(lenhTay, 160)}</div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {dx.canAnh || dx.trangThai === "de-sau" || dx.trangThai === "da-gat" ? (
          <>
            <Nut hd="giao" chinh>{soViec ? t("Gửi việc cho Claude") : t("Giao Claude sửa")}</Nut>
            {chayLaiDuoc && <Nut hd="chay-lai">{t("Chạy lại")}</Nut>}
            {soViec ? <button onClick={() => setSoViec(false)} className="text-[11.5px] text-gray-500 px-1">{t("Huỷ")}</button> : (
              <>
                {dx.trangThai !== "de-sau" && <Nut hd="de-sau">{t("Để sau 1 ngày")}</Nut>}
                {dx.trangThai !== "da-gat" && <Nut hd="bo-qua">{t("Không cần sửa")}</Nut>}
              </>
            )}
          </>
        ) : (
          <Nut hd="mo-lai">{t("Mở lại")}</Nut>
        )}
      </div>
      {kq && <div className={`text-[11.5px] ${kq.ok ? "text-emerald-700" : "text-rose-700"}`}>{kq.chu}</div>}
    </div>
  );
}

function ChiTietMay({ m, phong, onDong }: { m: MayChay; phong?: Phong; onDong: () => void }) {
  const [dang, setDang] = useState(false);
  const [kq, setKq] = useState<{ ok: boolean | null; chu: string } | null>(null);
  useEffect(() => { setKq(null); }, [m.key]);
  const { t } = useLang();

  async function chayLai() {
    setDang(true);
    try {
      const r = await fetch("/api/may/chay-lai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: m.key }) });
      const j = await r.json();
      setKq({ ok: j.ok ?? (j.chay ? null : false), chu: j.thongBao || j.loi || t("Không rõ kết quả") });
    } catch (e: any) {
      setKq({ ok: false, chu: `${t("Gọi hỏng")}: ${String(e?.message || e).slice(0, 120)}` });
    } finally { setDang(false); }
  }

  const tuoi = m.tuoiGio == null ? (m.kieuDo === "tuc-thoi" ? t("đo ngay lúc hỏi") : t("chưa ghi mốc")) : t("{n}h trước (trần {tran}h)").replace("{n}", String(m.tuoiGio)).replace("{tran}", String(m.tranGio));
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <span className="shrink-0"><Nguoi id={phong?.id ?? "kt"} cao={64} /></span>
        <div className="flex-1">
          <div className="font-bold text-gray-900 text-[14px]">{t(m.ten)}</div>
          <div className={m.trangThai === "chet" ? "text-rose-600 font-semibold" : "text-gray-500"}>
            <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: AO[m.trangThai] }} />
            {t(CHU_TT[m.trangThai])} · {m.noiChay === "mac" ? t("máy văn phòng") : t("máy chủ")}
          </div>
        </div>
        <button onClick={onDong} className="text-gray-400 hover:text-gray-700" aria-label={t("Đóng")}><X className="w-4 h-4" /></button>
      </div>
      <dl className="space-y-2">
        <div><dt className="text-gray-400">{t("Lần cuối làm")}</dt><dd className="text-gray-800">{tuoi}</dd></div>
        {m.ghiChu && <div><dt className="text-gray-400">{t("Đang báo")}</dt><dd className="text-gray-800">{m.ghiChu}</dd></div>}
        {m.trangThai === "chet" && m.cachSua && <div><dt className="text-gray-400">{t("Cách sửa")}</dt><dd className="text-gray-800">{m.cachSua}</dd></div>}
      </dl>
      {m.trangThai === "chet" && (
        m.chayLai.kieu === "nguoi" ? (
          <div className="rounded-md bg-amber-50 border border-amber-100 p-2 text-amber-900">
            {t("Cần chính tay anh (captcha/OTP/quét QR, hoặc chạy lại sẽ gửi trùng ra ngoài):")}
            <div className="mt-0.5 text-gray-800">{m.chayLai.lenh}</div>
          </div>
        ) : (
          <button onClick={chayLai} disabled={dang} className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 text-white px-3 py-1.5 disabled:opacity-60">
            {dang ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
            {t("Chạy lại")} {m.chayLai.kieu === "mac" ? t("trên máy văn phòng") : t("trên máy chủ")}
          </button>
        )
      )}
      {kq && <div className={kq.ok === false ? "text-rose-700" : kq.ok ? "text-emerald-700" : "text-gray-600"}>{kq.chu}</div>}
    </div>
  );
}
