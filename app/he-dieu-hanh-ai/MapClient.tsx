"use client";
import { useLang } from "@/components/lang-provider";
import { dichSo } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Network, LayoutGrid, Workflow, ArrowUpRight, PackageCheck, AlertTriangle, CircleDashed, Activity, Bot, UserRound, Building2 } from "lucide-react";
import type { AgentLive, AgentState, AgentTuChu } from "@/lib/ai-map";
import type { LuongLive } from "@/lib/luong";
import LuongPanel from "./LuongPanel";
import SoDoDieuPhoi from "./SoDoDieuPhoi";

type Viec = {
  id: number; agent: string; agent_ten: string | null; viec: string;
  trang_thai: "xong" | "khong_co_gi" | "hong";
  so_luong: number; don_vi: string | null; chi_tiet: string | null; link: string | null;
  created_at: string;
};
type TomTat = { tongLuot: number; tongHong: number; tongKhongCoGi: number; choDuyet: number };

const STATE: Record<AgentState, { dot: string; label: string; text: string }> = {
  live: { dot: "bg-emerald-500", label: "Đang chạy", text: "text-emerald-700" },
  realtime: { dot: "bg-emerald-500", label: "Chạy realtime", text: "text-emerald-700" },
  stale: { dot: "bg-amber-500", label: "Quá hạn", text: "text-amber-700" },
  empty: { dot: "bg-red-500", label: "Chưa có dữ liệu", text: "text-red-700" },
  human: { dot: "bg-slate-400", label: "Người", text: "text-slate-600" },
  notbuilt: { dot: "bg-gray-300", label: "Chưa dựng", text: "text-gray-400" },
};

const TU_CHU: Record<AgentTuChu, { nhan: string; lop: string }> = {
  nguoi: { nhan: "Người quyết", lop: "bg-slate-100 text-slate-600 border-slate-200" },
  doc: { nhan: "Chỉ đọc số", lop: "bg-gray-100 text-gray-500 border-gray-200" },
  "de-xuat": { nhan: "Chỉ đề xuất", lop: "bg-sky-50 text-sky-700 border-sky-200" },
  "cho-duyet": { nhan: "Chờ duyệt", lop: "bg-amber-100 text-amber-700 border-amber-200" },
  "trong-han": { nhan: "Tự làm trong hạn", lop: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

function gio(s: string) {
  return new Date(s).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
}

function Card({ a }: { a: AgentLive }) {
  const { t: tDich } = useLang();
  const s = STATE[a.state];
  const dim = a.state === "notbuilt";
  const sl = a.sanLuong;
  return (
    <div
      className={[
        "rounded-xl border p-3.5 flex flex-col gap-1.5 transition",
        dim ? "border-dashed border-gray-300 bg-gray-50/60" : "border-gray-200 bg-white shadow-sm",
        a.hub ? "ring-2 ring-purple-300 bg-purple-50/40" : "",
        sl && sl.hong > 0 ? "ring-2 ring-red-300" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.dot}`} />
          <span className={`font-semibold text-sm truncate ${dim ? "text-gray-500" : "text-gray-800"}`}>{tDich(a.name)}</span>
        </div>
        {a.maturity === "partial" && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 shrink-0">{tDich("Một phần")}</span>
        )}
        {a.maturity === "notbuilt" && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200 shrink-0">{tDich("Đợt sau")}</span>
        )}
      </div>

      <p className={`text-xs leading-snug ${dim ? "text-gray-400" : "text-gray-500"}`}>{tDich(a.role)}</p>

      {a.phongBan && (
        <span className="text-[11px] text-gray-600 inline-flex items-center gap-1">
          <Building2 className="w-3 h-3 text-gray-400" />{tDich(a.phongBan)}
        </span>
      )}
      {a.canhBaoDb && (
        <span className="text-[11px] text-red-600 font-semibold">{tDich(a.canhBaoDb)}</span>
      )}

      {a.tuChu && (
        <div className="flex items-center gap-1.5">
          <span
            title={tDich(a.chot) || undefined}
            className={`text-[10px] px-1.5 py-0.5 rounded border font-medium cursor-help ${TU_CHU[a.tuChu].lop}`}
          >
            {tDich(TU_CHU[a.tuChu].nhan)}
          </span>
          {!a.chot && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200 font-semibold">
              {tDich("chưa khai chốt")}
            </span>
          )}
        </div>
      )}

      {sl && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-gray-900 text-white font-semibold tabular-nums">
            {sl.sanPham} {tDich(sl.donVi || "việc")}
          </span>
          <span className="text-[11px] text-gray-400">{sl.luot} {tDich("lượt")}</span>
          {sl.khongCoGi > 0 && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 inline-flex items-center gap-1">
              <CircleDashed className="w-3 h-3" />{sl.khongCoGi} {tDich("lượt ra 0")}
            </span>
          )}
          {sl.hong > 0 && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-red-100 text-red-700 font-semibold inline-flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />{sl.hong} {tDich("hỏng")}
            </span>
          )}
        </div>
      )}
      {!sl && a.runKey && !dim && (
        <span className="text-[11px] text-gray-400">{tDich("Chưa chạy lượt nào trong 24h")}</span>
      )}

      {!a.human && a.maturity !== "notbuilt" && (
        a.chu ? (
          <span className="text-[11px] text-gray-500 inline-flex items-center gap-1">
            <UserRound className="w-3 h-3" />{tDich(a.chu)}
          </span>
        ) : (
          <span className="text-[11px] text-red-600 font-semibold inline-flex items-center gap-1">
            <UserRound className="w-3 h-3" />{tDich("Chưa có người giữ")}
          </span>
        )
      )}

      <div className="mt-auto pt-1 flex items-center justify-between gap-2">
        <span className={`text-[11px] font-medium ${s.text}`}>{tDich(a.detail)}</span>
        {a.link && !dim && (
          <a href={a.link} className="text-[11px] text-brand-600 hover:text-brand-700 inline-flex items-center gap-0.5 shrink-0">
            {tDich("Mở")} <ArrowUpRight className="w-3 h-3" />
          </a>
        )}
      </div>
      {dim && tDich(a.note) && <p className="text-[11px] text-gray-400 leading-snug">{tDich(a.note)}</p>}
    </div>
  );
}

export default function MapClient({ agents, nhatKy, choDuyet, tomTat, luong }: {
  agents: AgentLive[]; nhatKy: Viec[]; choDuyet: Viec[]; tomTat: TomTat; luong: LuongLive[];
}) {
  const { t: tDich } = useLang();
  const tiers = Array.from(new Set(agents.map((a) => a.tier))).sort((x, y) => x - y);
  const live = agents.filter((a) => a.state === "live" || a.state === "realtime").length;
  const partial = agents.filter((a) => a.maturity === "partial").length;
  const notbuilt = agents.filter((a) => a.maturity === "notbuilt").length;
  const sanPham24h = agents.reduce((n, a) => n + (a.sanLuong?.sanPham ?? 0), 0);
  const coSo = agents.some((a) => a.sanLuong);
  const choTheoAgent: Record<string, number> = {};
  for (const r of choDuyet) choTheoAgent[r.agent] = (choTheoAgent[r.agent] || 0) + 1;

  const [dang, setDang] = useState<"so-do" | "tang">("so-do");
  useEffect(() => { try { if (localStorage.getItem("hdh-ai-dang") === "tang") setDang("tang"); } catch { } }, []);
  const doiDang = (d: "so-do" | "tang") => { setDang(d); try { localStorage.setItem("hdh-ai-dang", d); } catch { } };

  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 60_000);
    return () => clearInterval(t);
  }, [router]);

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Network className="w-6 h-6 text-brand-600" /> {tDich("Bản đồ Hệ điều hành AI")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {tDich("Mỗi ô là một trợ lý AI thật. Trạng thái đọc từ Watchdog (máy còn thở không), sản lượng đọc từ sổ việc của máy (máy đẻ ra cái gì).")}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs bg-white border border-gray-200 rounded-xl p-3">
        <span className="font-semibold text-gray-900 text-sm tabular-nums">{sanPham24h} {tDich("sản phẩm / 24h")}</span>
        <span className="text-gray-500">{tomTat.tongLuot} {tDich("lượt máy chạy")}</span>
        {tomTat.choDuyet > 0 && <span className="text-violet-700 font-semibold">{tomTat.choDuyet} {tDich("chờ duyệt")}</span>}
        {tomTat.tongKhongCoGi > 0 && <span className="text-amber-700">{tomTat.tongKhongCoGi} {tDich("lượt ra 0")}</span>}
        {tomTat.tongHong > 0 && <span className="text-red-700 font-semibold">{tomTat.tongHong} {tDich("hỏng")}</span>}
        <span className="text-gray-300">|</span>
        <span className="text-gray-600">{live} {tDich("đang chạy")}</span>
        <span className="text-amber-700">{partial} {tDich("một phần")}</span>
        <span className="text-gray-500">{notbuilt} {tDich("chưa dựng")}</span>
      </div>

      <LuongPanel luong={luong} />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
        <div className="space-y-4 min-w-0">
          <div className="flex gap-1">
            {([["so-do", tDich("Sơ đồ điều phối"), Workflow], ["tang", tDich("Theo tầng"), LayoutGrid]] as const).map(([k, ten, Icon]) => (
              <button key={k} onClick={() => doiDang(k)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${dang === k ? "bg-brand-50 text-brand-700 font-semibold" : "text-gray-500 hover:bg-gray-50"}`}>
                <Icon className="w-4 h-4" /> {ten}
              </button>
            ))}
          </div>
          {dang === "so-do" && <SoDoDieuPhoi agents={agents} choTheoAgent={choTheoAgent} />}
          {dang === "tang" && tiers.map((t) => {
            const row = agents.filter((a) => a.tier === t);
            const label = row[0]?.tierLabel || "";
            const hub = row.some((a) => a.hub);
            return (
              <div key={t} className="flex gap-3">
                <div className="w-20 shrink-0 pt-1">
                  <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{tDich("Tầng")} {t}</div>
                  <div className="text-xs text-gray-600">{tDich(label)}</div>
                </div>
                <div className={`flex-1 grid gap-3 ${hub ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
                  {row.map((a) => <Card key={a.id} a={a} />)}
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-4 xl:sticky xl:top-4">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-3.5 py-2.5 border-b border-gray-100 flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-violet-600" />
              <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">{tDich("Máy làm xong, chờ người gật")}</span>
            </div>
            {choDuyet.length === 0 ? (
              <p className="px-3.5 py-4 text-xs text-gray-400">{tDich("Không có gì đang chờ.")}</p>
            ) : (
              <ul className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                {choDuyet.map((r) => (
                  <li key={r.id} className="px-3.5 py-2.5">
                    <div className="text-xs font-semibold text-gray-800">{tDich(r.agent_ten || r.agent)}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{tDich(r.viec)}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-2">
                      <span>{gio(r.created_at)}</span>
                      {r.so_luong > 0 && <span className="text-gray-700 font-medium">{r.so_luong} {tDich(r.don_vi || "")}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <a href="/tasks?view=may" className="block px-3.5 py-2 text-xs font-semibold text-brand-600 hover:bg-gray-50 border-t border-gray-100">
              {tDich("Mở sổ việc của máy để duyệt →")}
            </a>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-3.5 py-2.5 border-b border-gray-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-gray-500" />
              <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">{tDich("Nhật ký hệ thống")}</span>
            </div>
            {nhatKy.length === 0 ? (
              <div className="px-3.5 py-6 text-center">
                <Bot className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-500">
                  {coSo ? tDich("Chưa có lượt nào.") : tDich("Sổ việc của máy chưa có dòng nào — chạy migration 050 rồi cắm ghiViecMay() vào cron.")}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50 max-h-[26rem] overflow-y-auto tabular-nums">
                {nhatKy.map((r) => {
                  const mau = r.trang_thai === "hong" ? "text-red-600" : r.trang_thai === "khong_co_gi" ? "text-amber-600" : "text-emerald-600";
                  return (
                    <li key={r.id} className="px-3.5 py-2 text-[11px] leading-relaxed">
                      <span className="text-gray-400">[{gio(r.created_at)}]</span>{" "}
                      <span className={`font-semibold ${mau}`}>{r.agent}</span>{" "}
                      <span className="text-gray-700">{dichSo(tDich, r.viec)}</span>
                      {r.so_luong > 0 && <span className="text-gray-900 font-semibold"> → {r.so_luong} {tDich(r.don_vi || "")}</span>}
                      {r.trang_thai === "khong_co_gi" && <span className="text-amber-600"> {tDich("→ ra 0")}</span>}
                      {r.trang_thai === "hong" && <span className="text-red-600"> {tDich("→ HỎNG")}{r.chi_tiet ? `: ${dichSo(tDich, r.chi_tiet).slice(0, 120)}` : ""}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        {tDich("Nguyên tắc Hub-and-Spoke: các agent không nói thẳng với nhau — mọi luồng đi qua Dispatch (tầng 3) và qua cửa QA trước khi ra ngoài.\n        Ô nào chưa có sản lượng là chưa cắm sổ việc của máy vào cron của nó, không phải máy đó chết.")}
      </p>
    </div>
  );
}
